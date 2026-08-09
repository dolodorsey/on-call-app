import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('exclusive provider leases are realtime-first and provider-isolated',()=>{
  const host=read('src/ProviderMatchHost.tsx')
  const migration=read('supabase/migrations/20260809050000_enable_provider_offer_realtime.sql')
  assert.match(host,/realtime\.setAuth\(session\.access_token\)/)
  assert.match(host,/table:'oc_booking_offers'/)
  assert.match(host,/setInterval\(run,8000\)/)
  assert.match(host,/connection==='live'/)
  assert.match(migration,/alter table public\.oc_booking_offers enable row level security/)
  assert.match(migration,/provider_id = private\.oc_current_provider_id\(\)/)
  assert.match(migration,/alter publication supabase_realtime add table public\.oc_booking_offers/)
  assert.match(migration,/revoke all on table public\.oc_booking_offers from anon/)
})
