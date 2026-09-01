import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260901194730_on_call_revoke_public_crm_table_grants.sql',import.meta.url),'utf8')

test('ON CALL CRM control-plane tables are not client-writable',()=>{
  assert.match(migration,/revoke all on table public\.oc_crm_links from anon, authenticated;/i)
  assert.match(migration,/revoke all on table public\.oc_crm_outbox from anon, authenticated;/i)
})

test('ON CALL pricing remains authenticated read-only',()=>{
  assert.match(migration,/revoke all on table public\.oc_pricing_rules from anon;/i)
  assert.match(migration,/revoke insert, update, delete, truncate, references, trigger[\s\S]*public\.oc_pricing_rules from authenticated;/i)
  assert.match(migration,/grant select on table public\.oc_pricing_rules to authenticated;/i)
})

test('ON CALL grant hardening does not modify S.O.S. product objects',()=>{
  const executable=migration
    .split('\n')
    .filter((line)=>!line.trim().startsWith('--'))
    .join('\n')
  assert.doesNotMatch(executable,/\bsos_/i)
})
