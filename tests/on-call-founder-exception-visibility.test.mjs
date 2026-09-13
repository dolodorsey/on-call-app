import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../supabase/functions/oncall-founder-status/index.ts', import.meta.url), 'utf8');
const publicHealth = await readFile(new URL('../supabase/functions/oncall-health/index.ts', import.meta.url), 'utf8');

test('ON CALL founder execution telemetry is operator-only and authenticated', () => {
  assert.match(source, /authorization/);
  assert.match(source, /authentication_required/);
  assert.match(source, /marketplace_operator_check/);
  assert.match(source, /operator_access_required/);
  assert.match(source, /visibility: "operator_only"/);
  assert.match(source, /founder_status/);
  assert.match(source, /founder_exceptions/);
});

test('ON CALL founder telemetry reports execution failures from the oc namespace only', () => {
  assert.match(source, /stale_crm_backlog_over_4h/);
  assert.match(source, /crm_backlog_zero_attempts/);
  assert.match(source, /zero_verified_provider_supply/);
  assert.match(source, /zero_services_with_provider_supply/);
  assert.match(source, /zero_provider_applications/);
  assert.match(source, /zero_lifetime_bookings/);
  assert.match(source, /oc_crm_outbox/);
  assert.match(source, /oc_provider_profiles/);
  assert.match(source, /oc_provider_applications/);
  assert.match(source, /oc_provider_services/);
  assert.match(source, /oc_bookings/);
  assert.doesNotMatch(source, /sos_(users|heroes|missions|crm_outbox|provider_applications)/);
});

test('public ON CALL health remains business-volume private', () => {
  assert.doesNotMatch(publicHealth, /founder_status/);
  assert.doesNotMatch(publicHealth, /active_services:/);
  assert.doesNotMatch(publicHealth, /total_bookings:/);
  assert.doesNotMatch(publicHealth, /pending_zero_attempts:/);
});
