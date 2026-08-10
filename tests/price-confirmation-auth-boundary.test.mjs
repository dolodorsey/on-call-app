import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('price confirmation cannot confuse SECURITY DEFINER owner with server caller',()=>{
  const migration=read('supabase/migrations/20260810075555_fix_oc_confirm_booking_price_invoker_auth.sql')
  assert.match(migration,/auth\.jwt\(\)->>'role'/)
  assert.match(migration,/= 'service_role'/)
  assert.doesNotMatch(migration,/current_user\s+(?:in|not\s+in)/i)
  assert.match(migration,/auth\.uid\(\) is null/)
  assert.match(migration,/private\.oc_current_provider_id\(\)/)
  assert.match(migration,/v_booking\.provider_id is distinct from v_provider_id/)
  assert.match(migration,/revoke execute on function public\.oc_confirm_booking_price\(uuid,integer,uuid\) from public, anon/i)
})
