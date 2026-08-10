import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL cancellation Edge uses integer cents from Postgres',()=>{
  const edge=read('supabase/functions/oc-cancel-booking/index.ts')
  assert.match(edge,/q\?\.fee_cents/)
  assert.match(edge,/q\?\.provider_compensation_cents/)
  assert.match(edge,/feeAmount:feeCents\/100/)
  assert.match(edge,/providerCompensation:providerCents\/100/)
  assert.match(edge,/Math\.round\(Number\(expectedFeeAmount\)\*100\)!==feeCents/)
  assert.match(edge,/amount_to_capture:feeCents/)
  assert.doesNotMatch(edge,/q\.fee_amount/)
  assert.doesNotMatch(edge,/q\.provider_compensation(?:\W|$)/)
})

test('cancellation RPCs distinguish trusted service_role from customer ownership',()=>{
  const migration=read('supabase/migrations/20260810081359_fix_marketplace_cancellation_service_context.sql')
  assert.match(migration,/auth\.jwt\(\)->>'role',''\)='service_role'/)
  assert.match(migration,/private\.oc_current_user_id\(\)/)
  assert.match(migration,/where id=p_booking_id and customer_id=v_user/)
  assert.match(migration,/where id=p_booking_id and customer_id=uid/)
  assert.doesNotMatch(migration,/current_user\s+(?:in|not\s+in)/i)
})
