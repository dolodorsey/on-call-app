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
})

test('ON CALL cancellation is DB-authoritative before Stripe and retryable',()=>{
  const edge=read('supabase/functions/oc-cancel-booking/index.ts')
  const cancel=edge.indexOf('oc_customer_cancel_v2'),capture=edge.indexOf('paymentIntents.capture'),cancelIntent=edge.indexOf('paymentIntents.cancel')
  assert.ok(cancel>=0&&capture>cancel,'DB cancellation must precede Stripe capture')
  assert.ok(cancel>=0&&cancelIntent>cancel,'DB cancellation must precede Stripe authorization cancel')
  assert.match(edge,/pending_retry/)
  assert.match(edge,/queued for retry/)
})

test('cancellation RPCs distinguish trusted service_role from customer ownership',()=>{
  const migration=read('supabase/migrations/20260810081359_fix_marketplace_cancellation_service_context.sql')
  assert.match(migration,/auth\.jwt\(\)->>'role',''\)='service_role'/)
  assert.match(migration,/private\.oc_current_user_id\(\)/)
  assert.match(migration,/where id=p_booking_id and customer_id=v_user/)
  assert.match(migration,/where id=p_booking_id and customer_id=uid/)
  assert.doesNotMatch(migration,/current_user\s+(?:in|not\s+in)/i)
})

test('cancellation settlement split preserves the original authorization model',()=>{
  const migration=read('supabase/migrations/20260810082439_fix_cancellation_settlement_split_constraints.sql')
  assert.match(migration,/settlement_type in \('customer_cancellation','customer_no_show'\)/)
  assert.match(migration,/platform_fee \+ provider_amount = cancellation_fee_cents/)
  assert.match(migration,/platform_fee \+ provider_amount \+ tax_cents = amount_authorized/)
})

test('scheduled retry worker uses Vault, v2 payout readiness, and matching Stripe keys',()=>{
  const worker=read('supabase/functions/marketplace-payout-retry/index.ts')
  const schedule=read('supabase/migrations/20260810083127_schedule_marketplace_payout_retry_worker_v2.sql')
  assert.match(worker,/sos_get_runtime_secret/)
  assert.match(worker,/stripe_account_api_version==='v2'/)
  assert.match(worker,/stripe_transfer_status==='active'/)
  assert.match(worker,/oc-payment-\$\{p\.id\}-transfer-v2/)
  assert.match(worker,/customer_no_show/)
  assert.match(worker,/oc-no-show/)
  assert.match(worker,/oc-cancel-booking/)
  assert.doesNotMatch(worker,/retry_worker/)
  assert.match(schedule,/marketplace-payout-retry/)
  assert.match(schedule,/payout_retry_worker_token/)
  assert.match(schedule,/\* \* \* \* \*/)
})

test('legacy direct cancellation and weaker offer feed stay retired',()=>{
  const cancel=read('supabase/migrations/20260810080900_retire_legacy_on_call_customer_cancel.sql')
  const legacy=read('supabase/migrations/20260810081500_retire_legacy_marketplace_paths.sql')
  assert.match(cancel,/revoke execute on function public\.oc_customer_cancel\(uuid\)/i)
  assert.match(legacy,/revoke execute on function public\.oc_available_offers\(\)/i)
})
