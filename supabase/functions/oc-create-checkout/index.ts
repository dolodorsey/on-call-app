import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import Stripe from "npm:stripe@18.5.0";

const ALLOWED_ORIGINS=new Set([
  'https://oncallallday.com','https://www.oncallallday.com','https://khgoncall.com','https://www.khgoncall.com','https://khg-on-call.vercel.app',
  'capacitor://localhost','http://localhost','https://localhost'
]);
const cors=(origin:string|null)=>({
  'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:'https://oncallallday.com',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'
});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const safeReturn=(value:unknown,fallback:string)=>{if(typeof value!=='string'||!value)return fallback;try{const u=new URL(value);return ALLOWED_ORIGINS.has(u.origin)?u.toString():fallback}catch{return fallback}};

Deno.serve(async req=>{
  const origin=req.headers.get('Origin');
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)});
  if(req.method!=='POST')return json({error:'Method not allowed'},405,origin);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'Origin not allowed'},403,origin);
  const supabaseUrl=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!supabaseUrl||!anon||!service)return json({error:'Checkout runtime is unavailable'},503,origin);
  const auth=req.headers.get('Authorization')||'';
  const token=auth.replace(/^Bearer\s+/i,'');
  if(!token)return json({error:'Authentication required'},401,origin);
  const userClient=createClient(supabaseUrl,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:'Authentication required'},401,origin);
  const admin=createClient(supabaseUrl,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({}));
  const bookingId=typeof body?.bookingId==='string'?body.bookingId:'';
  if(!bookingId)return json({error:'bookingId is required'},422,origin);
  const {data:booking,error:bookingError}=await admin.from('oc_bookings').select('id,customer_id,provider_id,service_name,total_price,status,customer:oc_users!oc_bookings_customer_id_fkey(auth_id,email),provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled,stripe_account_api_version,stripe_transfer_status)').eq('id',bookingId).single();
  if(bookingError||!booking||booking.customer?.auth_id!==user.id)return json({error:'Eligible booking not found'},404,origin);
  if(booking.status!=='assigned'||!booking.provider_id)return json({error:'A provider must accept before payment authorization'},409,origin);
  const providerReady=booking.provider?.stripe_account_api_version==='v2'?booking.provider?.stripe_transfer_status==='active':Boolean(booking.provider?.stripe_charges_enabled&&booking.provider?.stripe_payouts_enabled);
  if(!booking.provider?.stripe_account_id||!providerReady)return json({error:'Provider payout setup is incomplete'},409,origin);
  const amount=Math.round(Number(booking.total_price)*100);
  if(!Number.isSafeInteger(amount)||amount<50)return json({error:'Booking total is invalid'},409,origin);
  const feeBps=Number(Deno.env.get('ON_CALL_PLATFORM_FEE_BPS')??'2000');
  if(!Number.isInteger(feeBps)||feeBps<0||feeBps>5000)return json({error:'Platform fee configuration is invalid'},503,origin);
  const platformFee=Math.round(amount*feeBps/10000),providerAmount=amount-platformFee;
  let stripeKey=Deno.env.get('STRIPE_SECRET_KEY')||'';
  if(!stripeKey){const {data}=await admin.rpc('sos_get_runtime_secret',{secret_name:'STRIPE_SECRET_KEY'});if(data)stripeKey=String(data)}
  if(!stripeKey)return json({error:'Secure payments are not configured'},503,origin);
  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
  const {data:existing}=await admin.from('oc_booking_payments').select('*').eq('booking_id',booking.id).maybeSingle();
  if(existing&&['authorized','capture_pending','captured','transfer_pending','transferred'].includes(existing.status))return json({alreadyAuthorized:true,status:existing.status,paymentId:existing.id},200,origin);
  if(existing?.stripe_checkout_session_id){try{const prior=await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id);if(prior.status==='open'&&prior.url)return json({checkoutUrl:prior.url,checkoutSessionId:prior.id,paymentId:existing.id,status:existing.status},200,origin);if(prior.status==='complete')return json({alreadyAuthorized:['authorized','capture_pending','captured','transfer_pending','transferred'].includes(existing.status),status:existing.status,paymentId:existing.id,checkoutSessionId:prior.id},200,origin)}catch(error){console.warn('Prior ON CALL checkout lookup failed',String(error))}}
  if(existing?.stripe_payment_intent_id){try{const intent=await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);if(['requires_payment_method','requires_confirmation','requires_action'].includes(intent.status))await stripe.paymentIntents.cancel(intent.id,{cancellation_reason:'abandoned'});else if(['requires_capture','processing','succeeded'].includes(intent.status))return json({alreadyAuthorized:true,status:existing.status,paymentId:existing.id},200,origin)}catch(error){console.warn('Prior ON CALL PaymentIntent cleanup failed',String(error))}}
  const base='https://oncallallday.com';
  const success=safeReturn(body?.successUrl,`${base}/?payment=authorized`),cancel=safeReturn(body?.cancelUrl,`${base}/?payment=canceled`);
  const session=await stripe.checkout.sessions.create({mode:'payment',success_url:success,cancel_url:cancel,line_items:[{price_data:{currency:'usd',unit_amount:amount,product_data:{name:`ON CALL — ${booking.service_name}`,metadata:{booking_id:booking.id}}},quantity:1}],customer_email:booking.customer?.email||user.email||undefined,payment_intent_data:{capture_method:'manual',transfer_group:`oc_booking_${booking.id}`,metadata:{brand:'ON_CALL',flow:'booking',booking_id:booking.id,customer_id:booking.customer_id,provider_id:booking.provider_id}},metadata:{brand:'ON_CALL',flow:'booking',booking_id:booking.id,customer_id:booking.customer_id,provider_id:booking.provider_id}},{idempotencyKey:`oc-checkout-${booking.id}-${amount}-v1`});
  const paymentPayload={booking_id:booking.id,customer_id:booking.customer_id,provider_id:booking.provider_id,amount_authorized:amount,platform_fee:platformFee,provider_amount:providerAmount,tax_cents:0,currency:'usd',stripe_checkout_session_id:session.id,stripe_payment_intent_id:null,status:'pending_authorization',updated_at:new Date().toISOString()};
  const {data:payment,error:paymentError}=existing?await admin.from('oc_booking_payments').update(paymentPayload).eq('id',existing.id).select('id,status').single():await admin.from('oc_booking_payments').insert(paymentPayload).select('id,status').single();
  if(paymentError){console.error('ON CALL hosted checkout payment ledger failed',paymentError);return json({error:'Payment ledger could not be prepared'},500,origin)}
  return json({checkoutUrl:session.url,checkoutSessionId:session.id,paymentId:payment.id,status:payment.status},200,origin);
});
