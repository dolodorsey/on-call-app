import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const STRIPE_VERSION='2026-06-24.dahlia';
const DESTINATION_NAME='Marketplace Accounts v2';
const EVENTS=['v2.core.account.created','v2.core.account.updated','v2.core.account.closed','v2.core.account[requirements].updated','v2.core.account[future_requirements].updated','v2.core.account[configuration.recipient].updated','v2.core.account[configuration.recipient].capability_status_updated'];
const cors={"Access-Control-Allow-Origin":"https://oncallallday.com","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
async function stripeV2(key:string,path:string,init:RequestInit={}){const r=await fetch(`https://api.stripe.com${path}`,{...init,headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/json',...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||`Stripe v2 request failed (${r.status})`);return d}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!anon||!service)return json({error:'Runtime configuration unavailable'},503);
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Authentication required'},401);
  const scoped=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});const{data:{user},error:authError}=await scoped.auth.getUser();if(authError||!user)return json({error:'Authentication required'},401);
  const{data:isOperator,error:opError}=await scoped.rpc('marketplace_operator_check');if(opError||!isOperator)return json({error:'Marketplace operator access required'},403);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});const readSecret=async(name:string)=>{const runtime=Deno.env.get(name);if(runtime)return runtime;const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:name});return error||!data?'':String(data)};
  const stripeKey=await readSecret('STRIPE_SECRET_KEY');if(!stripeKey)return json({ready:false,error:'Stripe server credential is not configured. Restore that credential, then run bootstrap again.'},503);
  const endpoint=`${url}/functions/v1/stripe-v2-account-webhook`;
  const list=await stripeV2(stripeKey,'/v2/core/event_destinations?include%5B0%5D=webhook_endpoint.url&limit=100',{method:'GET'});let existing=(list.data||[]).find((d:any)=>d.name===DESTINATION_NAME||d?.webhook_endpoint?.url===endpoint);
  const storedThinSecret=await readSecret('STRIPE_V2_ACCOUNT_WEBHOOK_SECRET');
  if(existing&&storedThinSecret)return json({ready:true,created:false,event_destination_id:existing.id,status:existing.status,endpoint});
  if(existing&&!storedThinSecret){await stripeV2(stripeKey,`/v2/core/event_destinations/${encodeURIComponent(existing.id)}`,{method:'DELETE'});existing=null;}
  const created=await stripeV2(stripeKey,'/v2/core/event_destinations',{method:'POST',headers:{'Idempotency-Key':'marketplace-accounts-v2-event-destination-v1'},body:JSON.stringify({name:DESTINATION_NAME,description:'Synchronizes ON CALL provider and S.O.S. Hero Stripe Accounts v2 recipient readiness.',enabled_events:EVENTS,events_from:['other_accounts'],type:'webhook_endpoint',webhook_endpoint:{url:endpoint},event_payload:'thin',include:['webhook_endpoint.signing_secret','webhook_endpoint.url'],metadata:{system:'marketplace',products:'on_call,sos'}})});
  const signingSecret=String(created?.webhook_endpoint?.signing_secret||'');if(!signingSecret)throw new Error('Stripe did not return the thin webhook signing secret during destination creation');
  const{error:storeError}=await admin.rpc('marketplace_store_runtime_secret',{p_name:'STRIPE_V2_ACCOUNT_WEBHOOK_SECRET',p_value:signingSecret,p_description:'Stripe thin event destination signing secret for marketplace Accounts v2'});if(storeError)throw storeError;
  return json({ready:true,created:true,event_destination_id:created.id,status:created.status,endpoint,enabled_events:EVENTS});
 }catch(error){const message=error instanceof Error?error.message:'Unexpected bootstrap failure';return json({ready:false,error:message},400)}
});