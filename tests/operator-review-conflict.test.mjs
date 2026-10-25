import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/OperationsCommand.tsx',import.meta.url),'utf8');
const fn=source.match(/ const review=async[^\n]+/)[0];
const code=ts.transpileModule(fn+';globalThis.runReview=review;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const message='duplicate key value violates unique constraint "oc_provider_applications_active_email_unique"';
async function run(error){
 const selected={id:'fixture-id',application_number:'FIXTURE-1',status:'rejected'};
 const seen={calls:[],selected:[],busy:[],error:[],notice:[],loads:0};
 const ctx={selected,notes:'Keep these review notes',statusLabel:s=>s,
  supabase:{rpc:async(name,args)=>{seen.calls.push({name,args});return{error,data:{...selected,status:'reviewing'}}}},
  setBusy:v=>seen.busy.push(v),setError:v=>seen.error.push(v),setNotice:v=>seen.notice.push(v),setSelected:v=>seen.selected.push(v),load:async()=>{seen.loads++}};
 vm.runInNewContext(code,ctx);await ctx.runReview('reviewing');return seen;
}
test('exact active-email conflict gives recovery guidance without retry or lost selection',async()=>{
 const r=await run({code:'23505',message});
 assert.match(r.error.at(-1),/another active application/i);
 assert.match(r.error.at(-1),/authorized operator/i);
 assert.equal(r.calls.length,1);assert.equal(r.loads,0);assert.deepEqual(r.selected,[]);
 assert.deepEqual(r.notice,['']);assert.equal(r.busy.at(-1),'');
 assert.equal(r.calls[0].args.p_notes,'Keep these review notes');
 assert.equal(r.calls[0].name,'oc_ops_review_provider_application');
});
for(const error of [{code:'23505',message:'another unique constraint'},{code:'42501',message},{message:'permission denied'}]){
 test(`unrelated error remains distinct: ${error.code||'unknown'} ${error.message.slice(0,20)}`,async()=>{
  const r=await run(error);assert.equal(r.error.at(-1),error.message);assert.equal(r.calls.length,1);assert.equal(r.loads,0);assert.deepEqual(r.selected,[]);
 });
}
test('successful review preserves normal selection and refresh',async()=>{
 const r=await run(null);assert.equal(r.loads,1);assert.equal(r.selected[0].status,'reviewing');assert.equal(r.notice.at(-1),'FIXTURE-1 marked reviewing.');assert.equal(r.calls.length,1);
});
