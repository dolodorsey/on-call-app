import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ON CALL does not expose an unfunded tip RPC', () => {
  const migration = read('supabase/migrations/20260810101500_retire_unfunded_on_call_tip_rpc.sql');
  const client = read('src/supabase.ts');
  assert.match(migration, /revoke execute on function public\.oc_add_tip\(uuid,integer\) from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(client, /oc_add_tip/);
});
