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
for(const value of ['3years','3.5','3e2',[3],3.5]){
 const a=await run('index.ts',{...valid,years_experience:value});assert.equal(a.status,400);assert.equal(a.calls.length,0);passed++;
}
for(const value of ['false',1,{},[],null]){
 const a=await run('index.ts',{...valid,has_vehicle:value});assert.equal(a.status,400);assert.equal(a.calls.length,0);passed++;
}
for(const value of [null,[],true,7]){
 const a=await run('index.ts',value);assert.equal(a.status,400);assert.equal(a.calls.length,0);passed++;
}
for(const value of [0,80,'0','80',' 3 ']){
 const a=await run('index.ts',{...valid,years_experience:value});assert.equal(a.status,201);assert.equal(a.inserted.years_experience,Number(value));assert.equal(a.inserted.has_vehicle,false);passed++;
}
for(const value of [-1,81,'',null,{},true]){
 const a=await run('index.ts',{...valid,years_experience:value});assert.equal(a.status,400);assert.equal(a.calls.length,0);passed++;
}
for(const value of [true,undefined]){
 const a=await run('index.ts',{...valid,has_vehicle:value});assert.equal(a.status,201);assert.equal(a.inserted.has_vehicle,value===true);passed++;
}
const status=await run('index.ts',{action:'status',application_number:'QA',tracking_token:'x'.repeat(32)});assert.equal(status.status,404);assert.deepEqual(status.calls,['status']);passed++;
// Failed duplicate reads must stop before rate limiting or persistence, even with stale data.
for(const data of [null,[],[{application_number:'QA-EXISTING',status:'submitted'}]]){
 const a=await run('index.ts',valid,{data,error:{message:'Synthetic lookup failure'}});
 assert.equal(a.status,500);assert.deepEqual(a.calls,['duplicate']);assert.equal(a.inserted,undefined);assert.notEqual(a.body.success,true);passed++;
}
const duplicate=await run('index.ts',valid,{data:[{application_number:'QA-EXISTING',status:'submitted',status_token_hash:'synthetic-hash'}],error:null});
assert.equal(duplicate.status,200);assert.deepEqual(duplicate.calls,['duplicate']);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.tracking_token,undefined);assert.equal(duplicate.body.status_token_hash,undefined);passed++;
console.log({checks_passed:passed,network_calls:0,real_applications:0});
