import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const STRIPE_V2_VERSION='2026-06-24.dahlia'
const allowedSubscriptionStatus=(status:string)=>['active','past_due','canceled','trialing','paused'].includes(status)?status:(status==='unpaid'||status==='incomplete_expired'?'canceled':'past_due')
const period=(subscription:any,key:'start'|'end')=>{const direct=key==='start'?subscription?.current_period_start:subscription?.current_period_end;const item=key==='start'?subscription?.items?.data?.[0]?.current_period_start:subscription?.items?.data?.[0]?.current_period_end;const value=direct||item;return value?new Date(value*1000).toISOString():null}
const dueList=(account:any)=>account?.requirements?.summary?.currently_due??account?.requirements?.currently_due??[]
const transferStatus=(account:any)=>account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status||'inactive'
const fetchV2Account=async(key:string,accountId:string)=>{const response=await fetch(`https://api.stripe.com/v2/core/accounts/${encodeURIComponent(accountId)}?include[]=configuration.recipient&include[]=requirements`,{headers:{Authorization:`Bearer ${key}`,'Stripe-Version':STRIPE_V2_VERSION}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||data?.error||`Stripe v2 account fetch failed (${response.status})`);return data}

Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!url||!service)return new Response('Webhook database runtime is not configured',{status:503})
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
 const readSecret=async(name:string)=>{const env=Deno.env.get(name);if(env)return env;const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:name});return error||!data?'':String(data)}
 const webhookSecret=await readSecret('STRIPE_WEBHOOK_SECRET')||await readSecret('sos_stripe_webhook_secret');if(!webhookSecret)return new Response('Stripe webhook signing secret is unavailable',{status:503})
 const stripeKey=await readSecret('STRIPE_SECRET_KEY');const stripe=new Stripe(stripeKey||'sk_test_webhook_verification_only',{httpClient:Stripe.createFetchHttpClient()})
 const body=await req.text(),sig=req.headers.get('stripe-signature')||'';let event:Stripe.Event
 try{event=await stripe.webhooks.constructEventAsync(body,sig,webhookSecret)}catch{return new Response('Invalid signature',{status:400})}
 const object=event.data.object as any;const intentId=object?.object==='payment_intent'?object.id:(typeof object?.payment_intent==='string'?object.payment_intent:null)
 const accountId=event.type==='account.updated'&&object?.id?String(object.id):null
 const onCallByMetadata=object?.metadata?.brand==='ON_CALL'||object?.metadata?.brand==='on_call'||Boolean(object?.metadata?.booking_id)
 const{data:ocPayment}=intentId?await admin.from('oc_booking_payments').select('*,provider:oc_provider_profiles!oc_booking_payments_provider_id_fkey(stripe_account_id,stripe_payouts_enabled,stripe_account_api_version,stripe_transfer_status)').eq('stripe_payment_intent_id',intentId).maybeSingle():{data:null}
 const [{data:ocAccountProvider},{data:sosAccountHero}]=accountId?await Promise.all([
   admin.from('oc_provider_profiles').select('id,stripe_account_api_version').eq('stripe_account_id',accountId).maybeSingle(),
   admin.from('sos_heroes').select('id,stripe_connect_api_version').eq('stripe_connect_id',accountId).maybeSingle()
 ]):[{data:null},{data:null}]
 const isOnCall=onCallByMetadata||Boolean(ocPayment)||Boolean(ocAccountProvider)||(event.type==='account.updated'&&(object?.metadata?.brand==='ON_CALL'||object?.metadata?.brand==='on_call'))

 if(isOnCall){
  let duplicate=false;const{error:eventError}=await admin.from('oc_payment_events').insert({stripe_event_id:event.id,event_type:event.type,payment_id:ocPayment?.id??null,livemode:event.livemode,payload:event});if(eventError?.code==='23505')duplicate=true;else if(eventError)return new Response('ON CALL event ledger unavailable',{status:500})
  if(event.type==='account.updated'&&accountId){
    const provider=ocAccountProvider
    if(provider?.stripe_account_api_version==='v2'){
      if(!stripeKey)return new Response('ON CALL v2 account event recorded; payout reconciliation awaits Stripe API credential restoration',{status:503})
      try{
        const account=await fetchV2Account(stripeKey,accountId);const transfers=transferStatus(account);const requirements=dueList(account);const ready=transfers==='active'
        await admin.from('oc_provider_profiles').update({stripe_transfer_status:transfers,stripe_requirements_due:requirements,stripe_onboarding_complete:ready,stripe_payouts_enabled:ready,updated_at:new Date().toISOString()}).eq('id',provider.id)
        return Response.json({received:true,duplicate,brand:'ON_CALL',account_api:'v2',payout_ready:ready,transfer_status:transfers,requirements_due:requirements.length})
      }catch(error){console.error('ON CALL v2 account reconciliation failed',error);return new Response('ON CALL payout account reconciliation retry required',{status:503})}
    }
    await admin.from('oc_provider_profiles').update({stripe_charges_enabled:Boolean(object.charges_enabled),stripe_payouts_enabled:Boolean(object.payouts_enabled),stripe_onboarding_complete:Boolean(object.details_submitted&&object.payouts_enabled),updated_at:new Date().toISOString()}).eq('stripe_account_id',accountId)
    return Response.json({received:true,duplicate,brand:'ON_CALL',legacy_account_sync:true})
  }
  if(ocPayment){
   if(event.type==='payment_intent.amount_capturable_updated'){
    let charge:any=null;if(stripeKey&&object.latest_charge){try{charge=await stripe.charges.retrieve(typeof object.latest_charge==='string'?object.latest_charge:object.latest_charge.id)}catch{}}
    await admin.from('oc_booking_payments').update({status:'authorized',authorized_at:new Date().toISOString(),stripe_charge_id:charge?.id??(typeof object.latest_charge==='string'?object.latest_charge:null),capture_by:charge?.payment_method_details?.card?.capture_before?new Date(charge.payment_method_details.card.capture_before*1000).toISOString():null,updated_at:new Date().toISOString()}).eq('id',ocPayment.id)
   }else if(event.type==='payment_intent.succeeded'){
    await admin.from('oc_booking_payments').update({status:'transfer_pending',amount_captured:object.amount_received??object.amount??ocPayment.amount_authorized,captured_at:new Date().toISOString(),stripe_charge_id:typeof object.latest_charge==='string'?object.latest_charge:ocPayment.stripe_charge_id,updated_at:new Date().toISOString()}).eq('id',ocPayment.id)
    const providerReady=ocPayment.provider?.stripe_account_api_version==='v2'?ocPayment.provider?.stripe_transfer_status==='active':ocPayment.provider?.stripe_payouts_enabled
    if(ocPayment.provider?.stripe_account_id&&providerReady&&!ocPayment.stripe_transfer_id){
      if(!stripeKey)return new Response('Payment captured; provider transfer pending Stripe API credential restoration',{status:503})
      try{const transfer=await stripe.transfers.create({amount:ocPayment.provider_amount,currency:ocPayment.currency,destination:ocPayment.provider.stripe_account_id,transfer_group:`oc_booking_${ocPayment.booking_id}`,metadata:{brand:'ON_CALL',booking_id:ocPayment.booking_id,payment_id:ocPayment.id}},{idempotencyKey:`oc-payment-${ocPayment.id}-transfer-v2`});await admin.from('oc_booking_payments').update({status:'transferred',stripe_transfer_id:transfer.id,transferred_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',ocPayment.id)}catch(error){console.error('ON CALL webhook transfer failed',error);return new Response('Provider transfer retry required',{status:503})}
    }
   }else if(event.type==='payment_intent.payment_failed')await admin.from('oc_booking_payments').update({status:'failed',failure_code:object.last_payment_error?.code??null,failure_message:object.last_payment_error?.message??null,updated_at:new Date().toISOString()}).eq('id',ocPayment.id)
   else if(event.type==='payment_intent.canceled')await admin.from('oc_booking_payments').update({status:'authorization_canceled',canceled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',ocPayment.id)
   else if(event.type==='charge.dispute.created')await admin.from('oc_booking_payments').update({status:'disputed',updated_at:new Date().toISOString()}).eq('id',ocPayment.id)
   else if(event.type==='charge.refunded'){const refunded=object.amount_refunded??0;await admin.from('oc_booking_payments').update({amount_refunded:refunded,status:refunded>=ocPayment.amount_captured?'refunded':'partially_refunded',updated_at:new Date().toISOString()}).eq('id',ocPayment.id)}
  }
  return Response.json({received:true,duplicate,brand:'ON_CALL',stripe_api_ready:Boolean(stripeKey)})
 }

 let duplicate=false;const{error:ledgerError}=await admin.from('sos_stripe_events').insert({event_id:event.id,event_type:event.type,livemode:event.livemode,object_id:object?.id,payload:{created:event.created}});if(ledgerError?.code==='23505')duplicate=true;else if(ledgerError)return new Response('Event ledger unavailable',{status:500})
 if(event.type==='account.updated'&&accountId&&sosAccountHero){
   if(sosAccountHero.stripe_connect_api_version==='v2'){
     if(!stripeKey)return new Response('SOS v2 account event recorded; payout reconciliation awaits Stripe API credential restoration',{status:503})
     try{
       const account=await fetchV2Account(stripeKey,accountId);const transfers=transferStatus(account);const requirements=dueList(account);const ready=transfers==='active';const now=new Date().toISOString()
       await admin.from('sos_heroes').update({stripe_transfer_status:transfers,stripe_requirements_due:requirements,payout_method:'stripe_connect',updated_at:now}).eq('id',sosAccountHero.id)
       await admin.from('sos_hero_verification_checks').upsert({hero_id:sosAccountHero.id,check_type:'payout_account',required:true,status:ready?'passed':'submitted',notes:ready?'Stripe transfers active.':`Stripe payout requirements remaining: ${requirements.length}.`,reviewed_by:'stripe',reviewed_at:ready?now:null,updated_at:now},{onConflict:'hero_id,check_type'})
       const{error:recomputeError}=await admin.rpc('sos_recompute_hero_verification_admin',{p_hero_id:sosAccountHero.id});if(recomputeError)console.error('SOS payout verification recompute failed',recomputeError)
       return Response.json({received:true,duplicate,brand:'SOS',account_api:'v2',payout_ready:ready,transfer_status:transfers,requirements_due:requirements.length})
     }catch(error){console.error('SOS v2 account reconciliation failed',error);return new Response('SOS payout account reconciliation retry required',{status:503})}
   }
 }
 const membershipFlow=object?.metadata?.brand==='SOS'&&object?.metadata?.flow==='membership'
 if(membershipFlow&&(event.type==='checkout.session.completed'||event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted')){
  try{
   let subscription:any=object;let userId=String(object?.metadata?.sos_user_id||''),planId=String(object?.metadata?.plan_id||'')
   if(event.type==='checkout.session.completed'){
    if(!object.subscription)throw new Error('Membership subscription missing from Checkout Session')
    if(!stripeKey)return new Response('Membership event recorded; subscription fetch awaits Stripe API credential restoration',{status:503})
    subscription=await stripe.subscriptions.retrieve(typeof object.subscription==='string'?object.subscription:object.subscription.id);userId=String(object.metadata?.sos_user_id||subscription.metadata?.sos_user_id||'');planId=String(object.metadata?.plan_id||subscription.metadata?.plan_id||'')
   }
   if(!userId||!planId)throw new Error('Membership metadata is incomplete');const{data:plan,error:planError}=await admin.from('sos_membership_plans').select('*').eq('id',planId).single();if(planError||!plan)throw new Error('Membership plan not found')
   const status=event.type==='customer.subscription.deleted'?'canceled':allowedSubscriptionStatus(String(subscription.status||'active')),subId=String(subscription.id||object.subscription||'');if(!subId)throw new Error('Membership subscription ID missing')
   const{error:upsertError}=await admin.from('sos_subscriptions').upsert({user_id:userId,plan:plan.id,status,stripe_subscription_id:subId,monthly_price:plan.monthly_price,included_services:plan.included_services,discount_percent:plan.discount_percent,current_period_start:period(subscription,'start')||new Date().toISOString(),current_period_end:period(subscription,'end'),canceled_at:status==='canceled'?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'stripe_subscription_id'});if(upsertError)throw upsertError
   if(['active','trialing'].includes(status))await admin.from('sos_users').update({shield_plan:plan.id,updated_at:new Date().toISOString()}).eq('id',userId);else if(status==='canceled'){const{data:other}=await admin.from('sos_subscriptions').select('plan').eq('user_id',userId).in('status',['active','trialing']).neq('stripe_subscription_id',subId).limit(1).maybeSingle();await admin.from('sos_users').update({shield_plan:other?.plan??null,updated_at:new Date().toISOString()}).eq('id',userId)}
  }catch(error){console.error('SOS membership webhook failed',{eventId:event.id,eventType:event.type,error:String(error)});return new Response('Membership reconciliation failed',{status:500})}
  return Response.json({received:true,duplicate,brand:'SOS',flow:'membership'})
 }
 const missionId=object?.metadata?.mission_id
 if(missionId){const patch:any={updated_at:new Date().toISOString()};if(event.type==='checkout.session.completed'){patch.stripe_checkout_session_id=object.id;patch.stripe_payment_intent_id=typeof object.payment_intent==='string'?object.payment_intent:null}else if(event.type==='payment_intent.amount_capturable_updated'){patch.payment_status='authorized';patch.escrow_status='authorized_hold';patch.authorized_at=new Date().toISOString();patch.stripe_payment_intent_id=object.id;patch.stripe_charge_id=typeof object.latest_charge==='string'?object.latest_charge:object.latest_charge?.id||null}else if(event.type==='payment_intent.succeeded'){patch.payment_status='captured';patch.escrow_status='held_for_release';patch.captured_at=new Date().toISOString();patch.stripe_charge_id=typeof object.latest_charge==='string'?object.latest_charge:null}else if(event.type==='payment_intent.payment_failed'){patch.payment_status='failed';patch.escrow_status='failed';patch.failed_at=new Date().toISOString()}else if(event.type==='payment_intent.canceled'){patch.payment_status='canceled';patch.escrow_status='released_to_customer'}else if(event.type==='charge.dispute.created'){patch.payment_status='disputed';patch.escrow_status='disputed';patch.stripe_dispute_id=object.id;patch.disputed_at=new Date().toISOString()}else if(event.type==='charge.refunded'){patch.payment_status='refunded';patch.escrow_status='released_to_customer';patch.refund_amount=(object.amount_refunded??0)/100;patch.refunded_at=new Date().toISOString()}if(Object.keys(patch).length>1)await admin.from('sos_payments').update(patch).eq('mission_id',missionId)}
 return Response.json({received:true,duplicate,brand:'SOS',stripe_api_ready:Boolean(stripeKey)})
})