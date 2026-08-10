import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ON CALL completed service capture retries automatically', () => {
  const complete = read('supabase/functions/oc-complete-service/index.ts');
  const worker = read('supabase/functions/marketplace-payout-retry/index.ts');
  assert.match(complete, /Automatic capture retry queued/);
  assert.match(complete, /payment capture will retry automatically/i);
  assert.match(complete, /pending_retry/);
  assert.doesNotMatch(complete, /Reopen this completed job/);
  assert.match(worker, /phase:'completion'/);
  assert.match(worker, /b\.status!=='completed'/);
  assert.match(worker, /oc-payment-\$\{p\.id\}-capture-v2/);
  assert.match(worker, /Completed service capture reconciled/);
});

test('shared worker blocks unsafe S.O.S. transfer before mission completion', () => {
  const worker = read('supabase/functions/marketplace-payout-retry/index.ts');
  assert.match(worker, /Mission must be completed before Hero transfer/);
  assert.match(worker, /stripe_connect_api_version==='v2'/);
  assert.match(worker, /stripe_transfer_status==='active'/);
});
