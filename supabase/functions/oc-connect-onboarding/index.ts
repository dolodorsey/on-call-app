import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const STRIPE_VERSION='2026-06-24.dahlia';
const BASE='https://api.stripe.com';
const cors={"Access-Control-Allow-Origin":"https://oncallallday.com","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`${name} is not configured`);return value};
const admin=()=>createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
async function stripeKey(client:ReturnType<typeof admin>){let key=Deno.env.get('STRIPE_SECRET_KEY')||'';if(!key){const{data,error}=await client.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)key=String(data)}if(!key)throw new Error('STRIPE_SECRET_KEY is not configured');return key}
async function stripeV2(key:string,path:string,init:RequestInit={}){const response=await fetch(`${BASE}${path}`,{...init,headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/json',...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||data?.error||`Stripe v2 request failed (${response.status})`);return data}
const dueList=(account:any)=>account?.requirements?.summary?.currently_due??account?.requirements?.currently_due??[];
const transferStatus=(account:any)=>account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status||'inactive';

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Authentication required'},401);
    const client=admin();const{data:{user},error:authError}=await client.auth.getUser(token);if(authError||!user)return json({error:'Authentication required'},401);
    const{data:provider,error}=await client.from('oc_provider_profiles').select('id,stripe_account_id,user:oc_users!oc_provider_profiles_user_id_fkey(auth_id,email,full_name)').eq('user.auth_id',user.id).single();
    if(error||!provider||provider.user?.auth_id!==user.id)throw new Error('Approved provider account required');
    const key=await stripeKey(client);let accountId=provider.stripe_account_id as string|null;let account:any;
    if(!accountId){
      account=await stripeV2(key,'/v2/core/accounts',{method:'POST',headers:{'Idempotency-Key':`oc-provider-${provider.id}-connect-v2`},body:JSON.stringify({contact_email:provider.user?.email||user.email,display_name:provider.user?.full_name||provider.user?.email||'ON CALL Provider',defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},dashboard:'express',identity:{country:'us'},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},metadata:{brand:'ON_CALL',provider_id:String(provider.id)},include:['configuration.recipient','requirements']})});
      accountId=account.id;
    }else{
      account=await stripeV2(key,`/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient&include[]=requirements`,{method:'GET'});
    }
    const transfers=transferStatus(account);const requirements=dueList(account);const ready=transfers==='active';
    await client.from('oc_provider_profiles').update({stripe_account_id:accountId,stripe_account_api_version:'v2',stripe_transfer_status:transfers,stripe_requirements_due:requirements,stripe_onboarding_complete:ready,stripe_payouts_enabled:ready,updated_at:new Date().toISOString()}).eq('id',provider.id);
    if(ready)return json({connected:true,payout_ready:true,account_id:accountId,transfer_status:transfers,requirements_due:requirements});
    const link=await stripeV2(key,'/v2/core/account_links',{method:'POST',body:JSON.stringify({account:accountId,use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],collection_options:{fields:'eventually_due',future_requirements:'include'},refresh_url:'https://oncallallday.com/provider?payment=refresh',return_url:'https://oncallallday.com/provider?payment=return'}}})});
    return json({url:link.url,connected:true,payout_ready:false,account_id:accountId,transfer_status:transfers,requirements_due:requirements});
  }catch(error){const message=error instanceof Error?error.message:'Unexpected error';const config=message.endsWith('is not configured');return json({error:config?'Payments are not configured for this release.':message},config?503:400)}
});