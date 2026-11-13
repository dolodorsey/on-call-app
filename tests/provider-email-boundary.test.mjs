import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../supabase/functions/on-call-provider-application/',import.meta.url);
const valid={first_name:'Synthetic',last_name:'QA',email:'qa@example.invalid',phone:'5550100000',city:'Atlanta',state_code:'GA',services_requested:['Cleaning'],years_experience:3,has_vehicle:false,background_check_consent:true,license_attested:true,insurance_attested:true,terms_accepted:true};
async function run(file,body,duplicateResult={data:[],error:null}){
 let handler;const calls=[];let inserted;
 const chain={select:()=>chain,eq:()=>chain,in:()=>chain,order:()=>chain,limit:async()=>{calls.push('duplicate');return duplicateResult},maybeSingle:async()=>{calls.push('status');return {data:null,error:null}},insert:v=>{calls.push('insert');inserted=v;return chain},single:async()=>({data:{id:'fixture',application_number:'QA',status:'submitted'},error:null})};
 const client={from:()=>chain,rpc:async()=>{calls.push('rate_limit');return {data:{allowed:true},error:null}}};
 const src=stripTypeScriptTypes(readFileSync(new URL(file,root),'utf8').replace(/^import .*\n/gm,''));
 vm.runInNewContext(src,{Request,Response,TextEncoder,Uint8Array,crypto:webcrypto,btoa,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},createClient:()=>client,console:{error:()=>{}},fetch:()=>{throw Error('Network forbidden')}});
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify(body)}));
 return {status:response.status,calls,inserted,body:await response.json()};
}
let passed=0;
for(const email of ['', '   ', '\t\n', null, undefined]){
 const r=await run('index.ts',{...valid,email});assert.equal(r.status,400);assert.equal(r.calls.length,0);passed++;
}
const r=await run('index.ts',{...valid,email:'  QA@EXAMPLE.INVALID  '});
assert.equal(r.status,201);assert.equal(r.inserted.email,'qa@example.invalid');passed++;
console.log({checks_passed:passed,external_test_calls:0,real_applications:0});
