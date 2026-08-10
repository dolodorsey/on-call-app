import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL no-show uses canonical cents quote and atomic DB transition before Stripe',()=>{
  const edge=read('supabase/functions/oc-customer-no-show/index.ts')
  const migration=read('supabase/migrations/20260810084500_make_customer_no_show_db_authoritative.sql')
  assert.match(edge,/oc_customer_cancellation_quote/)
  assert.match(edge,/q\?\.fee_cents/)
  assert.match(edge,/q\?\.provider_compensation_cents/)
  assert.doesNotMatch(edge,/b\.total_price\b/)
  assert.doesNotMatch(edge,/b\.final_price\b/)
  assert.doesNotMatch(edge,/b\.estimated_price\b/)
  assert.ok(edge.indexOf('oc_provider_customer_no_show_v2')<edge.indexOf('paymentIntents.capture'))
  assert.match(edge,/pending_retry/)
  assert.match(migration,/for update/i)
  assert.match(migration,/v_booking\.status <> 'on_site'/)
  assert.match(migration,/make_interval\(mins=>p_wait_minutes\)/)
  assert.match(migration,/provider_id=v_provider/)
})

test('Stripe webhook does not regress ON CALL terminal money states',()=>{
  const hook=read('supabase/functions/stripe-webhook/index.ts')
  assert.match(hook,/const ocCapturedOrLater=/)
  assert.match(hook,/const ocTerminal=/)
  assert.match(hook,/if\(!ocTerminal\(String\(ocPayment\.status\|\|''\)\)\)patch\.status=/)
  assert.match(hook,/if\(!ocCapturedOrLater\(String\(ocPayment\.status\|\|''\)\)\)/)
})
