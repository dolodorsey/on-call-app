import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('provider application stores only a SHA-256 tracking hash',()=>{
 const migration=read('supabase/migrations/20260809063000_private_application_tracking_receipts.sql')
 const edge=read('supabase/functions/on-call-provider-application/index.ts')
 assert.match(migration,/status_token_hash/)
 assert.match(migration,/Raw token is never stored/)
 assert.match(edge,/crypto\.subtle\.digest\('SHA-256'/)
 assert.match(edge,/status_token_hash:statusTokenHash/)
 assert.match(edge,/tracking_token:trackingToken/)
 assert.doesNotMatch(edge,/status_token_hash:trackingToken/)
})

test('provider status lookup requires application number plus private receipt, never email alone',()=>{
 const edge=read('supabase/functions/on-call-provider-application/index.ts')
 assert.match(edge,/body\?\.action==='status'/)
 assert.match(edge,/application_number/)
 assert.match(edge,/tracking_token/)
 assert.match(edge,/\.eq\('application_number',applicationNumber\)\.eq\('status_token_hash',hash\)/)
 const statusBranch=edge.slice(edge.indexOf("if(body?.action==='status')"),edge.indexOf('const selected='))
 assert.doesNotMatch(statusBranch,/\.eq\('email'/)
})

test('duplicate active application never returns a new tracking token',()=>{
 const edge=read('supabase/functions/on-call-provider-application/index.ts')
 const duplicate=edge.match(/if\(recent\?\.length\)return reply\(([^;]+);/)?.[1]||''
 assert.ok(duplicate.length>0)
 assert.doesNotMatch(duplicate,/tracking_token/)
})

test('provider application UI persists receipt, polls status, and routes approved applicants to Provider Command',()=>{
 const ui=read('components/ProviderApply.jsx')
 assert.match(ui,/on_call_provider_application_receipt/)
 assert.match(ui,/localStorage\.setItem\(RECEIPT_KEY/)
 assert.match(ui,/action:'status'/)
 assert.match(ui,/setInterval\(\(\)=>refreshStatus\(receipt\),30000\)/)
 assert.match(ui,/Activate Provider Command/)
 assert.match(ui,/href="\/provider"/)
})
