import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../supabase/functions/oncall-health/index.ts', import.meta.url), 'utf8');

test('ON CALL health separates software health from founder execution exceptions', () => {
  assert.match(source, /founder_status/);
  assert.match(source, /founder_exceptions/);
  assert.match(source, /stale_crm_backlog_over_4h/);
  assert.match(source, /crm_backlog_zero_attempts/);
  assert.match(source, /zero_verified_provider_supply/);
  assert.match(source, /zero_services_with_provider_supply/);
  assert.match(source, /zero_provider_applications/);
  assert.match(source, /zero_lifetime_bookings/);
});

test('ON CALL founder telemetry remains inside the oc namespace', () => {
  assert.match(source, /oc_crm_outbox/);
  assert.match(source, /oc_provider_profiles/);
  assert.match(source, /oc_provider_applications/);
  assert.match(source, /oc_provider_services/);
  assert.match(source, /oc_bookings/);
  assert.doesNotMatch(source, /sos_(users|heroes|missions|crm_outbox|provider_applications)/);
});
