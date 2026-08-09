import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL customer profile controls dispatch direct tool events',()=>{
  const customer=read('src/OnCallMarketplace.tsx')
  const host=read('src/CustomerProfileToolsHost.tsx')
  for(const label of ['Saved addresses','Payment methods','Recurring services']) assert.match(customer,new RegExp(label))
  assert.match(customer,/oncall:open-profile-tool/)
  for(const tool of ['addresses','payments','recurring']) assert.match(customer,new RegExp(`openProfileTool\('${tool}'\)`))
  assert.match(host,/addEventListener\('oncall:open-profile-tool'/)
  assert.doesNotMatch(host,/document\.addEventListener\('click'/)
})
