import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.112.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,''); if(!token)throw new Error('Authentication required');
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}); const {data:{user}}=await admin.auth.getUser(token); if(!user)throw new Error('Authentication required');
  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||''; if(!stripeKey){const{data,error}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(!error&&data)stripeKey=String(data)}
  const {bookingId,action='quote',expectedFeeAmount,reason}=await req.json(); if(typeof bookingId!=='string')return json({error:'bookingId is required'},422);
  const {data:profile}=await admin.from('oc_users').select('id').eq('auth_id',user.id).maybeSingle(); if(!profile)throw new Error('ON CALL account required');
  const {data:booking}=await admin.from('oc_bookings').select('*').eq('id',bookingId).eq('customer_id',profile.id).maybeSingle(); if(!booking)throw new Error('Booking not found');
  const {data:quote,error:qerr}=await admin.rpc('oc_customer_cancellation_quote',{p_booking_id:bookingId}); if(qerr)throw qerr; const q=Array.isArray(quote)?quote[0]:quote;
  const feeCents=Math.max(0,Math.round(Number(q?.fee_cents||0)));
  const providerCents=Math.max(0,Math.round(Number(q?.provider_compensation_cents||0)));
  const platformCents=Math.max(0,feeCents-providerCents);
  const responseQuote={bookingId,status:q.booking_status,canCancel:Boolean(q.can_cancel),feeAmount:feeCents/100,providerCompensation:providerCents/100,reason:String(q.reason||''),policyVersion:Number(q.policy_version||1)};
  if(action==='quote')return json(responseQuote);
  if(action!=='cancel')return json({error:'action must be quote or cancel'},422);
  if(!q?.can_cancel)throw new Error(q?.reason||'Booking cannot be canceled');
  if(expectedFeeAmount!=null&&Math.round(Number(expectedFeeAmount)*100)!==feeCents)throw new Error('Cancellation fee changed. Please review the updated quote.');
  const {data:payment}=await admin.from('oc_booking_payments').select('*').eq('booking_id',bookingId).maybeSingle();
  if(payment?.stripe_payment_intent_id){
   if(!stripeKey)throw new Error('STRIPE_SECRET_KEY is not configured'); const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
   if(feeCents===0){
    if(!['authorization_canceled','canceled','refunded'].includes(payment.status))await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id,{cancellation_reason:'requested_by_customer'},{idempotencyKey:`oc-cancel-booking-${payment.id}-free-v1`});
   }else{
    if(payment.status!=='authorized')throw new Error('Late cancellation fee requires an active payment authorization');
    await admin.from('oc_booking_payments').update({settlement_type:'customer_cancellation',cancellation_fee_cents:feeCents,original_platform_fee:payment.original_platform_fee??payment.platform_fee,original_provider_amount:payment.original_provider_amount??payment.provider_amount,platform_fee:platformCents,provider_amount:providerCents,status:'capture_pending',updated_at:new Date().toISOString()}).eq('id',payment.id);
    await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{amount_to_capture:feeCents,final_capture:true,metadata:{settlement_type:'customer_cancellation',cancellation_fee_cents:String(feeCents)}},{idempotencyKey:`oc-cancel-booking-${payment.id}-${feeCents}-v2`});
   }
  } else if(feeCents>0) throw new Error('Late cancellation fee cannot be settled without an authorization');
  const {data:canceled,error:cerr}=await admin.rpc('oc_customer_cancel_v2',{p_booking_id:bookingId,p_reason:typeof reason==='string'?reason:null}); if(cerr)throw cerr;
  return json({...responseQuote,ok:true,booking:canceled});
 }catch(e){const m=e instanceof Error?e.message:'Unexpected error';const config=m.endsWith('is not configured');return json({error:config?'Payments are not configured for this release.':m},config?503:m==='Authentication required'?401:400)}
});