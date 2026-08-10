import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../supabase/functions/oc-cancel-payment/index.ts', import.meta.url), 'utf8');

test('legacy ON CALL payment cancellation cannot bypass booking cancellation', () => {
  assert.match(source, /payment\.booking\?\.status !== "canceled"/);
  assert.match(source, /Cancel the booking through the cancellation workflow before canceling payment authorization/);
  assert.match(source, /authorization_canceled/);
  assert.match(source, /paymentIntents\.cancel/);
});
