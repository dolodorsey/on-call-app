import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const STRIPE_VERSION='2026-06-24.dahlia';
const SUPPORTED=new Set([
  'v2.core.account.created','v2.core.account.updated','v2.core.account.closed',
  'v2.core.account[requirements].updated','v2.core.account[future_requirements].updated',
  'v2.core.account[configuration.recipient].updated','v2.core.account[configuration.recipient].capability_status_updated',
]);
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
async function verify(raw:string,header:string,secret:string){const parts=header.split(',').map(p=>p.trim());const timestamp=parts.find(p=>p.startsWith('t='))?.slice(2)||'';const signatures=parts.filter(p=>p.startsWith('v1=')).map(p=>p.slice(3));if(!timestamp||!signatures.length)return false;const ts=Number(timestamp);if(!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${raw}`)));return signatures.some(sig=>safeEqual(sig,digest))}
async function stripeV2(key:string,path:string){const r=await fetch(`https://api.stripe.com${path}`,{headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_VERSION}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`Stripe account fetch failed (${r.status})`);return d}
const transferStatus=(a:any)=>a?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status||'inactive';
const due=(a:any)=>a?.requirements?.summary?.currently_due??a?.requirements?.currently_due??[];

Deno.serve(async req=>{
  if(req.method!=='POST')return response({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!service)return response({error:'Database runtime unavailable'},503);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const readSecret=async(name:string)=>{const runtime=Deno.env.get(name);if(runtime)return runtime;const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:name});return error||!data?'':String(data)};
  const secret=await readSecret('STRIPE_V2_ACCOUNT_WEBHOOK_SECRET');if(!secret)return response({error:'Stripe v2 webhook secret is not configured'},503);
  const raw=await req.text();const signature=req.headers.get('stripe-signature')||'';if(!(await verify(raw,signature,secret)))return response({error:'Invalid signature'},400);
  const event=JSON.parse(raw);if(!SUPPORTED.has(String(event.type||'')))return response({received:true,ignored:true});
  const accountId=String(event?.related_object?.id||event?.data?.object?.id||'');if(!accountId)return response({received:true,ignored:true,reason:'No account reference'});
  const{data:isNew,error:ledgerError}=await admin.rpc('marketplace_record_stripe_v2_event',{p_event_id:String(event.id),p_event_type:String(event.type),p_account_id:accountId,p_livemode:Boolean(event.livemode)});if(ledgerError)return response({error:'Event ledger unavailable'},500);if(!isNew)return response({received:true,duplicate:true});
  if(event.type==='v2.core.account.closed'){
    const now=new Date().toISOString();
    await Promise.all([
      admin.from('oc_provider_profiles').update({stripe_account_api_version:'v2',stripe_transfer_status:'inactive',stripe_requirements_due:[],stripe_onboarding_complete:false,stripe_payouts_enabled:false,updated_at:now}).eq('stripe_account_id',accountId),
      admin.from('sos_heroes').update({stripe_connect_api_version:'v2',stripe_transfer_status:'inactive',stripe_requirements_due:[],updated_at:now}).eq('stripe_connect_id',accountId),
    ]);
    return response({received:true,account_id:accountId,transfer_status:'inactive'});
  }
  const stripeKey=await readSecret('STRIPE_SECRET_KEY');if(!stripeKey)return response({error:'Stripe server credential is required to fetch current v2 account state'},503);
  const account=await stripeV2(stripeKey,`/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient&include[]=requirements`);const status=transferStatus(account),requirements=due(account),ready=status==='active',now=new Date().toISOString();
  await Promise.all([
    admin.from('oc_provider_profiles').update({stripe_account_api_version:'v2',stripe_transfer_status:status,stripe_requirements_due:requirements,stripe_onboarding_complete:ready,stripe_payouts_enabled:ready,updated_at:now}).eq('stripe_account_id',accountId),
    admin.from('sos_heroes').update({stripe_connect_api_version:'v2',stripe_transfer_status:status,stripe_requirements_due:requirements,updated_at:now}).eq('stripe_connect_id',accountId),
  ]);
  return response({received:true,account_id:accountId,transfer_status:status,payout_ready:ready,requirements_due:requirements.length});
});