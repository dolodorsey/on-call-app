import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('dispatch core requires a real authenticated provider identity',()=>{
 const migration=read('supabase/migrations/20260809062000_dispatch_requires_authenticated_provider_identity.sql')
 assert.match(migration,/u\.auth_id is not null/)
 assert.match(migration,/u\.role='provider'/)
 assert.match(migration,/u\.status='active'/)
})
