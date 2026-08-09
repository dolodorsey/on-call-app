import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const ALLOWED_ORIGINS=new Set([
  'https://oncallallday.com','https://www.oncallallday.com','https://khgoncall.com','https://www.khgoncall.com','https://khg-on-call.vercel.app',
  'https://thesuperherosonstandby.com','https://www.thesuperherosonstandby.com','https://superherosonstandby.com','https://www.superherosonstandby.com',
  'capacitor://localhost','http://localhost','https://localhost'
]);
const cors=(origin:string|null)=>({'Access-Control-Allow-Origin':origin&&ALLOWED_ORIGINS.has(origin)?origin:'https://oncallallday.com','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'public, max-age=30, s-maxage=30','Vary':'Origin'});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json; charset=utf-8'}});

Deno.serve(async req=>{
  const origin=req.headers.get('Origin');
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(origin)});
  if(req.method!=='GET')return json({error:'Method not allowed'},405,origin);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:'Origin not allowed'},403,origin);
  const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!service)return json({error:'Coverage status unavailable'},503,origin);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const [oc,sos]=await Promise.all([admin.rpc('oc_public_service_coverage'),admin.rpc('sos_public_service_coverage')]);
  if(oc.error||sos.error){console.error('public coverage snapshot failed',{oc:oc.error?.message,sos:sos.error?.message});return json({error:'Coverage status unavailable'},503,origin);}
  const summarize=(rows:any[]|null)=>{const list=Array.isArray(rows)?rows:[];const covered=list.filter(row=>Boolean(row?.has_verified_supply));return {services_total:list.length,services_with_verified_supply:covered.length,verified_supply_count:covered.reduce((sum,row)=>sum+Number(row?.verified_supply_count||0),0),has_verified_supply:covered.length>0};};
  return json({generated_at:new Date().toISOString(),on_call:summarize(oc.data),sos:summarize(sos.data)},200,origin);
});
