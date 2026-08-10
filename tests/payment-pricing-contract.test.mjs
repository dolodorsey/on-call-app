import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [name,path] of [
  ['hosted checkout','supabase/functions/oc-create-checkout/index.ts'],
  ['direct card authorization','supabase/functions/oc-create-payment/index.ts'],
]) {
  test(`ON CALL ${name} uses confirmed cents pricing and tax`, () => {
    const source = read(path);
    assert.match(source, /final_price_cents/);
    assert.match(source, /tax_amount_cents/);
    assert.match(source, /pricing_status/);
    assert.match(source, /serviceAmount/);
    assert.match(source, /taxCents/);
    assert.match(source, /amount\s*=\s*serviceAmount\s*\+\s*taxCents/);
    assert.match(source, /platformFee\s*=.*serviceAmount/);
    assert.match(source, /tax_cents:\s*taxCents/);
    assert.doesNotMatch(source, /\btotal_price\b/);
  });
}
