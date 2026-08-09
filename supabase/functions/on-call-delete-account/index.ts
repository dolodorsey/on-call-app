import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED_ORIGINS = new Set([
  "https://oncallallday.com",
  "https://www.oncallallday.com",
  "https://khgoncall.com",
  "https://www.khgoncall.com",
  "https://khg-on-call.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);
const cors=(origin:string|null)=>({
  "Access-Control-Allow-Origin": origin&&ALLOWED_ORIGINS.has(origin)?origin:"https://oncallallday.com",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}});

Deno.serve(async(req)=>{
  const origin=req.headers.get("Origin");
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});
  if(req.method!=="POST")return json({error:"Method not allowed"},405,origin);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:"Origin not allowed"},403,origin);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!service)return json({error:"Account deletion is temporarily unavailable"},503,origin);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!jwt)return json({error:"Authentication required"},401,origin);
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${jwt}`}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:"Invalid or expired session"},401,origin);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:erasure,error:erasureError}=await admin.rpc("oc_anonymize_account",{p_auth_id:user.id});
  if(erasureError){console.error("ON CALL account anonymization failed",{authUserId:user.id,code:erasureError.code,message:erasureError.message});return json({error:"Account data could not be erased safely"},500,origin);}
  const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);
  if(deleteError){console.error("ON CALL auth deletion failed",{authUserId:user.id,message:deleteError.message});return json({error:"Personal data was anonymized, but the sign-in identity could not be removed",profile_anonymized:true},500,origin);}
  return json({ok:true,account_deleted:true,profile_anonymized:Boolean(erasure?.profile_anonymized??erasure?.found)},200,origin);
});
