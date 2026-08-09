import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL customer profile controls dispatch direct tool events',()=>{
  const customer=read('src/OnCallMarketplace.tsx')
  const host=read('src/CustomerProfileToolsHost.tsx')
  for(const label of ['Saved addresses','Payment methods','Recurring services']) assert.ok(customer.includes(label))
  assert.ok(customer.includes('oncall:open-profile-tool'))
  for(const tool of ['addresses','payments','recurring']) assert.ok(customer.includes(`openProfileTool('${tool}')`),`${tool} control must directly open its tool`)
  assert.ok(host.includes("addEventListener('oncall:open-profile-tool'"))
  assert.doesNotMatch(host,/document\.addEventListener\('click'/)
})
