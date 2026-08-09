import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('authenticated customer booking is rejected when no verified provider can perform the service',()=>{
 const migration=read('supabase/migrations/20260809063500_customer_requests_require_verified_supply.sql')
 assert.match(migration,/oc_customer_request_supply_guard/)
 assert.match(migration,/auth\.uid\(\) is null then return new/)
 assert.match(migration,/role='customer'/)
 assert.match(migration,/private\.oc_provider_service_dispatch_ready\(p\.id,new\.service_id\)/)
 assert.match(migration,/verified provider coverage is not active for this service yet\. No booking was created/)
})

test('coverage guard does not require provider to be online, only genuinely dispatch-ready for the service',()=>{
 const migration=read('supabase/migrations/20260809063500_customer_requests_require_verified_supply.sql')
 assert.doesNotMatch(migration,/p\.is_available/)
 assert.doesNotMatch(migration,/oc_provider_locations/)
 assert.match(migration,/oc_provider_services ps/)
})
