import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const component=readFileSync(new URL('../components/ProviderApply.jsx',import.meta.url),'utf8');
const submit=component.match(/ const submit=async\(\)=>\{[\s\S]*?(?=\n const clearReceipt=)/)?.[0];
assert.ok(submit,'actual submit function must be found');
const endpoint=component.match(/const APPLICATION_ENDPOINT=('.*?');/)[1];
const receiptKey=component.match(/const RECEIPT_KEY=('.*?');/)[1];
const edge=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/on-call-provider-application/index.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,''));
const base={first_name:'Synthetic',last_name:'QA',email:'qa@example.invalid',phone:'5550100000',city:'Atlanta',state:'GA',services_requested:['Cleaning'],years_experience:'0',has_vehicle:false,background_check_consent:true,license_attested:true,insurance_attested:true,terms_accepted:true};
async function exercise({form=base,busy=false,failure=null}={}){
 const seen={requests:0,inserts:[],steps:[],errors:[],busy:[],receipts:[],storage:[]};let handler;
 const chain={select:()=>chain,eq:()=>chain,in:()=>chain,order:()=>chain,limit:async()=>({data:[]}),insert:value=>{seen.inserts.push(value);return chain},single:async()=>({data:{id:'fixture',application_number:'QA-ONLY',status:'submitted'}})};
 vm.runInNewContext(edge,{Request,Response,TextEncoder,Uint8Array,crypto:webcrypto,btoa,Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},createClient:()=>({from:()=>chain,rpc:async()=>({data:{allowed:true}})}),console:{error:()=>{}},fetch:()=>{throw Error('External network forbidden')}});
 const ctx={form,submitting:busy,Error,JSON,setSubmitting:v=>seen.busy.push(v),setError:v=>seen.errors.push(v),setResult:v=>seen.result=v,setStep:v=>seen.steps.push(v),setReceipt:v=>seen.receipts.push(v),localStorage:{setItem:(k,v)=>seen.storage.push([k,JSON.parse(v)])},fetch:async(url,init)=>{seen.requests++;assert.equal(url,'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/on-call-provider-application');seen.payload=JSON.parse(init.body);if(failure==='network')throw Error('fixture network failure');if(failure==='nonsuccess')return new Response(JSON.stringify({success:false,error:'fixture refusal'}));return handler(new Request(url,init));}};
 await vm.runInNewContext(`const APPLICATION_ENDPOINT=${endpoint};const RECEIPT_KEY=${receiptKey};${submit};submit();`,ctx);
 return seen;
}
for(const years of ['0','1','3','5','10'])test(`actual caller preserves experience select ${years} and private receipt`,async()=>{
 const r=await exercise({form:{...base,years_experience:years}});assert.equal(r.requests,1);assert.equal(r.payload.state_code,'GA');assert.equal(r.inserts[0].years_experience,Number(years));assert.equal(r.inserts[0].has_vehicle,false);assert.deepEqual(r.steps,[4]);assert.equal(r.storage.length,1);assert.equal(r.storage[0][0],'on_call_provider_application_receipt');assert.ok(r.storage[0][1].tracking_token.length>=30);assert.equal(r.storage[0][1].tracking_token,r.receipts[0].tracking_token);assert.deepEqual(r.busy,[true,false]);
});
test('invalid experience retains error state without receipt or success step',async()=>{const r=await exercise({form:{...base,years_experience:'3years'}});assert.equal(r.inserts.length,0);assert.equal(r.storage.length,0);assert.deepEqual(r.steps,[]);assert.match(r.errors.at(-1),/required application field/);assert.equal(r.busy.at(-1),false)});
test('busy snapshot prevents submit',async()=>{const r=await exercise({busy:true});assert.equal(r.requests,0);assert.deepEqual(r.busy,[])});
for(const failure of ['network','nonsuccess'])test(`${failure} does not advance or save receipt`,async()=>{const r=await exercise({failure});assert.deepEqual(r.steps,[]);assert.equal(r.storage.length,0);assert.equal(r.inserts.length,0);assert.match(r.errors.at(-1),/fixture/);assert.equal(r.busy.at(-1),false)});
