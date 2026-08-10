import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL public health exposes readiness booleans, not business-volume telemetry',()=>{
  const health=read('supabase/functions/oncall-health/index.ts')
  assert.match(health,/catalog:\{ready:catalogReady\}/)
  assert.match(health,/verified_supply:Boolean\(/)
  assert.match(health,/live_supply:Boolean\(/)
  assert.match(health,/payments:\{ready:paymentsReady/)
  assert.doesNotMatch(health,/credential_sources/)
  assert.doesNotMatch(health,/active_services:/)
  assert.doesNotMatch(health,/active_zones:/)
  assert.doesNotMatch(health,/pending_payments:/)
  assert.doesNotMatch(health,/subscriptions:/)
  assert.doesNotMatch(health,/delivery_rows:/)
  assert.doesNotMatch(health,/active_cases:/)
})

test('ON CALL public provider intake is size-limited and rate-limited before new writes',()=>{
  const edge=read('supabase/functions/on-call-provider-application/index.ts')
  assert.match(edge,/MAX_BODY_BYTES=32768/)
  assert.match(edge,/Application request must be valid JSON/)
  assert.match(edge,/marketplace_consume_intake_rate_limit/)
  assert.match(edge,/p_app:'on_call_provider'/)
  assert.match(edge,/p_limit:8/)
  assert.match(edge,/p_window_minutes:60/)
  assert.match(edge,/Too many new applications from this network/)
  assert.ok(edge.indexOf(".in('status',['submitted','reviewing','approved'])")<edge.indexOf('marketplace_consume_intake_rate_limit'),'duplicate check must occur before consuming rate limit')
})

test('serialized intake limiter is service-role only and race-safe',()=>{
  const migration=read('supabase/migrations/20260810093000_serialize_marketplace_public_intake_rate_limit.sql')
  assert.match(migration,/service_role/)
  assert.match(migration,/pg_advisory_xact_lock/)
  assert.match(migration,/hashtextextended/)
})
