import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../components/ProviderApply.jsx',import.meta.url),'utf8');
const clear=source.match(/ const clearReceipt=\(\)=>\{[^\n]+/)[0];
function run(fails){
 const seen={receipt:[],result:[],step:[],warning:[],removed:[]};
 vm.runInNewContext(`${clear};clearReceipt();`,{RECEIPT_KEY:'fixture',localStorage:{removeItem:k=>{if(fails)throw Error('fixture denied');seen.removed.push(k)}},setReceipt:v=>seen.receipt.push(v),setResult:v=>seen.result.push(v),setStep:v=>seen.step.push(v),setError:()=>{},setReceiptWarning:v=>seen.warning.push(v)});
 return seen;
}
test('failed receipt removal preserves current receipt and explains retry',()=>{
 const r=run(true);assert.deepEqual(r.receipt,[]);assert.deepEqual(r.result,[]);assert.deepEqual(r.step,[]);assert.match(r.warning.at(-1),/could not clear/);assert.match(r.warning.at(-1),/still available/);
});
test('successful receipt removal resets saved application view',()=>{
 const r=run(false);assert.deepEqual(r.removed,['fixture']);assert.deepEqual(r.receipt,[null]);assert.deepEqual(r.result,[null]);assert.deepEqual(r.step,[0]);assert.deepEqual(r.warning,['']);
});
