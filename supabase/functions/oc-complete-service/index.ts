import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import Stripe from "npm:stripe@18.5.0";

const allowed = new Set(["https://oncallallday.com","https://www.oncallallday.com","https://khg-on-call.vercel.app","capacitor://localhost","http://localhost","http://localhost:5173"]);
const cors=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&allowed.has(origin)?origin:"https://oncallallday.com","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json"}});
const env=(name:string)=>{const v=Deno.env.get(name);if(!v)throw new Error(`${name} is not configured`);return v};

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
  if(req.method!=="POST")return json({error:"Method not allowed"},405,origin);
  if(origin&&!allowed.has(origin))return json({error:"Origin not allowed"},403,origin);
  try{
    const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return json({error:"Authentication required"},401,origin);
    const url=env("SUPABASE_URL"), service=env("SUPABASE_SERVICE_ROLE_KEY");
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await admin.auth.getUser(token);if(authError||!user)return json({error:"Authentication required"},401,origin);
    const input=await req.json().catch(()=>({}));const bookingId=String(input.bookingId||"");if(!/^[0-9a-f-]{36}$/i.test(bookingId))return json({error:"Valid bookingId is required"},422,origin);
    const {data:provider,error:providerError}=await admin.from("oc_provider_profiles").select("id,user:oc_users!oc_provider_profiles_user_id_fkey(auth_id,role,status)").eq("user.auth_id",user.id).single();
    if(providerError||!provider||provider.user?.auth_id!==user.id||provider.user?.role!=="provider"||provider.user?.status!=="active")return json({error:"Active provider account required"},403,origin);
    const {data:booking,error:bookingError}=await admin.from("oc_bookings").select("id,status,provider_id,completed_at").eq("id",bookingId).single();
    if(bookingError||!booking||booking.provider_id!==provider.id)return json({error:"Assigned booking not found"},404,origin);
    if(!["working","completed"].includes(booking.status))return json({error:"Service must be in progress before completion"},409,origin);
    const {data:payment,error:paymentError}=await admin.from("oc_booking_payments").select("*").eq("booking_id",bookingId).single();
    if(paymentError||!payment)return json({error:"Customer payment authorization is required before completion"},409,origin);
    if(!["authorized","capture_pending","transfer_pending","captured","transferred"].includes(payment.status))return json({error:"Customer payment authorization is required before completion"},409,origin);
    const now=new Date().toISOString();
    if(booking.status==="working"){
      const {data:updated,error:updateError}=await admin.from("oc_bookings").update({status:"completed",completed_at:now,updated_at:now}).eq("id",bookingId).eq("provider_id",provider.id).eq("status","working").select("id,status,completed_at").single();
      if(updateError||!updated)return json({error:"Service completion could not be recorded"},409,origin);
      await admin.from("oc_booking_events").insert({booking_id:bookingId,event_type:"status_change",actor_role:"provider",description:"Provider completed service",metadata:{old_status:"working",new_status:"completed",source:"provider_command"}});
      await admin.from("oc_provider_profiles").update({total_jobs:(await admin.from("oc_bookings").select("id",{count:"exact",head:true}).eq("provider_id",provider.id).eq("status","completed")).count||0,updated_at:now}).eq("id",provider.id);
    }
    if(["transfer_pending","captured","transferred"].includes(payment.status))return json({ok:true,booking:{id:bookingId,status:"completed"},payment:{status:payment.status,captured:true}},200,origin);
    if(!payment.stripe_payment_intent_id)return json({error:"Authorized payment is missing its Stripe reference"},409,origin);
    let stripeKey=Deno.env.get("STRIPE_SECRET_KEY")||"";if(!stripeKey){const{data,error}=await admin.rpc("sos_get_runtime_secret",{secret_name:"STRIPE_SECRET_KEY"});if(!error&&data)stripeKey=String(data)}if(!stripeKey)throw new Error("STRIPE_SECRET_KEY is not configured");
    const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
    await admin.from("oc_booking_payments").update({status:"capture_pending",updated_at:now}).eq("id",payment.id).in("status",["authorized","capture_pending"]);
    try{const intent=await stripe.paymentIntents.capture(payment.stripe_payment_intent_id,{},{idempotencyKey:`oc-payment-${payment.id}-capture-v2`});return json({ok:true,booking:{id:bookingId,status:"completed"},payment:{status:intent.status,captured:true}},200,origin);}catch(error){console.error("ON CALL service capture failed",{bookingId,paymentId:payment.id,error:String(error)});await admin.from("oc_booking_payments").update({status:"authorized",failure_message:"Capture retry required",updated_at:new Date().toISOString()}).eq("id",payment.id).eq("status","capture_pending");return json({ok:false,booking:{id:bookingId,status:"completed"},payment:{status:"authorized",captured:false},error:"Service is complete, but payment capture needs retry. Reopen this completed job and retry payment capture."},409,origin);}
  }catch(error){const message=error instanceof Error?error.message:"Unexpected error";return json({error:message.endsWith("is not configured")?"Payments are not configured for this release.":message},message.endsWith("is not configured")?503:400,origin);}
});