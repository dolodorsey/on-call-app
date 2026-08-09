import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const allowedOrigins=new Set(['https://oncallallday.com','https://www.oncallallday.com','https://khgoncall.com','https://www.khgoncall.com','https://khg-on-call.vercel.app','capacitor://localhost','http://localhost','http://localhost:5173']);
const headersFor=(origin:string|null)=>({'Access-Control-Allow-Origin':origin&&allowedOrigins.has(origin)?origin:'https://oncallallday.com','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'});
const reply=(body:unknown,status:number,origin:string|null)=>new Response(JSON.stringify(body),{status,headers:headersFor(origin)});
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};

Deno.serve(async req=>{
 const origin=req.headers.get('origin');if(req.method==='OPTIONS')return new Response('ok',{headers:headersFor(origin)});if(req.method!=='POST')return reply({error:'Method not allowed'},405,origin);if(origin&&!allowedOrigins.has(origin))return reply({error:'Origin not allowed'},403,origin);
 try{
  const body=await req.json();
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body?.action==='status'){
    const applicationNumber=clean(body.application_number,40),trackingToken=clean(body.tracking_token,200);
    if(!applicationNumber||trackingToken.length<30)return reply({error:'Application number and private tracking receipt are required.'},422,origin);
    const hash=await sha256(trackingToken);
    const{data,error}=await supabase.from('oc_provider_applications').select('application_number,status,created_at,updated_at,reviewed_at').eq('application_number',applicationNumber).eq('status_token_hash',hash).maybeSingle();
    if(error)throw error;if(!data)return reply({error:'Application receipt was not recognized.'},404,origin);
    return reply({success:true,application_number:data.application_number,status:data.status,created_at:data.created_at,updated_at:data.updated_at,reviewed_at:data.reviewed_at,next_action:data.status==='approved'?'Create or sign in to Provider Command with the same email to activate your approved application.':data.status==='rejected'?'Application review is closed. Contact ON CALL operations if you believe information should be reconsidered.':'No action is required while operations reviews your application.',provider_url:data.status==='approved'?'/provider':null},200,origin);
  }
  const selected=Array.isArray(body.services_requested)?[...new Set(body.services_requested.filter((item:unknown)=>typeof item==='string'&&item.trim().length>=2&&item.trim().length<=100).map((item:string)=>item.trim()))].slice(0,30):[];
  const firstName=clean(body.first_name,80),lastName=clean(body.last_name,80),email=clean(body.email,254).toLowerCase(),phone=clean(body.phone,40),city=clean(body.city,100),stateCode=clean(body.state_code||body.state,2).toUpperCase();const years=Number.parseInt(String(body.years_experience),10);
  const attest=body.background_check_consent===true&&body.license_attested===true&&body.insurance_attested===true&&body.terms_accepted===true;
  if(firstName.length<2||lastName.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length<7||city.length<2||!/^[A-Z]{2}$/.test(stateCode)||selected.length===0||!Number.isFinite(years)||years<0||years>80||!attest)return reply({error:'Please complete every required application field and eligibility attestation.'},400,origin);
  const{data:recent}=await supabase.from('oc_provider_applications').select('id,application_number,status,status_token_hash').eq('email',email).in('status',['submitted','reviewing','approved']).order('created_at',{ascending:false}).limit(1);if(recent?.length)return reply({success:true,duplicate:true,application_number:recent[0].application_number,status:recent[0].status,message:'An active application already exists for this email. Use the private receipt saved on the original device to track it.'},200,origin);
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const ipHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const trackingToken=token(),statusTokenHash=await sha256(trackingToken);
  const{data,error}=await supabase.from('oc_provider_applications').insert({first_name:firstName,last_name:lastName,email,phone,city,state_code:stateCode,zip_code:clean(body.zip_code,12)||null,services_requested:selected,years_experience:years,experience_description:clean(body.experience_description,2000)||null,has_vehicle:Boolean(body.has_vehicle),vehicle_type:clean(body.vehicle_type,80)||null,background_check_consent:true,license_attested:true,insurance_attested:true,terms_accepted:true,certifications:clean(body.certifications,2000)||null,license_details:clean(body.license_details,2000)||null,insurance_details:clean(body.insurance_details,2000)||null,source_ip_hash:ipHash,status_token_hash:statusTokenHash}).select('id,application_number,status').single();if(error)throw error;
  return reply({success:true,application_number:data.application_number,status:data.status,tracking_token:trackingToken,message:'Application received. Save this device/browser to track review status. Approval does not bypass service-specific verification or payout readiness.'},201,origin);
 }catch(error){console.error('ON CALL provider application failed',error);return reply({error:'Application could not be processed.'},500,origin)}
});