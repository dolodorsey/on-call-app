import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED_ORIGINS = new Set([
  "https://oncallallday.com","https://www.oncallallday.com","https://khgoncall.com","https://www.khgoncall.com","https://khg-on-call.vercel.app","capacitor://localhost","http://localhost","https://localhost",
]);
const cors=(origin:string|null)=>({"Access-Control-Allow-Origin":origin&&ALLOWED_ORIGINS.has(origin)?origin:"https://oncallallday.com","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}});

async function removeEvidence(admin:any,authUserId:string){
  const{data:ocUser,error:userLookupError}=await admin.from('oc_users').select('id').eq('auth_id',authUserId).maybeSingle();
  if(userLookupError)throw userLookupError;if(!ocUser?.id)return 0;
  const{data:provider,error:providerError}=await admin.from('oc_provider_profiles').select('id,provider_application_id').eq('user_id',ocUser.id).maybeSingle();
  if(providerError)throw providerError;if(!provider?.provider_application_id)return 0;
  const{data:checks,error:checkError}=await admin.from('oc_provider_verification_checks').select('evidence_urls').eq('application_id',provider.provider_application_id);
  if(checkError)throw checkError;
  const prefix=`on_call/${authUserId}/`;
  const paths=[...new Set((checks||[]).flatMap((row:any)=>Array.isArray(row.evidence_urls)?row.evidence_urls:[]).map((value:any)=>String(value)).filter((value:string)=>value.startsWith(prefix)))];
  for(let i=0;i<paths.length;i+=100){const batch=paths.slice(i,i+100);const{error}=await admin.storage.from('marketplace-verification').remove(batch);if(error)throw error}
  return paths.length;
}

Deno.serve(async(req)=>{
  const origin=req.headers.get("Origin");if(req.method==="OPTIONS")return new Response("ok",{headers:cors(origin)});if(req.method!=="POST")return json({error:"Method not allowed"},405,origin);if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:"Origin not allowed"},403,origin);
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!url||!anon||!service)return json({error:"Account deletion is temporarily unavailable"},503,origin);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!jwt)return json({error:"Authentication required"},401,origin);
  const userClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${jwt}`}}});const{data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json({error:"Invalid or expired session"},401,origin);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  let evidenceDeleted=0;try{evidenceDeleted=await removeEvidence(admin,user.id)}catch(error){console.error("ON CALL verification evidence deletion failed",{authUserId:user.id,message:error instanceof Error?error.message:String(error)});return json({error:"Verification evidence could not be erased safely. Account deletion was stopped before profile anonymization."},500,origin)}
  const{data:erasure,error:erasureError}=await admin.rpc("oc_anonymize_account",{p_auth_id:user.id});if(erasureError){console.error("ON CALL account anonymization failed",{authUserId:user.id,code:erasureError.code,message:erasureError.message});return json({error:"Account data could not be erased safely"},500,origin)}
  const{error:deleteError}=await admin.auth.admin.deleteUser(user.id);if(deleteError){console.error("ON CALL auth deletion failed",{authUserId:user.id,message:deleteError.message});return json({error:"Personal data was anonymized, but the sign-in identity could not be removed",profile_anonymized:true,verification_evidence_deleted:evidenceDeleted},500,origin)}
  return json({ok:true,account_deleted:true,profile_anonymized:Boolean(erasure?.profile_anonymized??erasure?.found),support_cases_scrubbed:Number(erasure?.support_cases_scrubbed||0),provider_applications_deleted:Number(erasure?.provider_applications_deleted||0),verification_evidence_deleted:evidenceDeleted},200,origin);
});