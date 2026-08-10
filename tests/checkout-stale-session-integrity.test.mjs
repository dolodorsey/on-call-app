import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../supabase/functions/oc-create-checkout/index.ts', import.meta.url), 'utf8');

test('ON CALL expires stale-price and orphaned Checkout sessions', () => {
  assert.match(source, /prior\.status==='open'&&Number\(existing\.amount_authorized\)!==amount/);
  assert.match(source, /checkout\.sessions\.expire\(prior\.id\)/);
  assert.match(source, /if\(paymentError\).*checkout\.sessions\.expire\(session\.id\)/s);
  assert.match(source, /No active Checkout was left open/);
});
