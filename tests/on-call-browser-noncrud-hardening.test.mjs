import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260903154000_on_call_browser_noncrud_privilege_hardening.sql', import.meta.url),
  'utf8',
)

test('ON CALL browser roles lose non-CRUD table capabilities', () => {
  assert.match(migration, /left\(c\.relname, 3\) = 'oc_'/i)
  assert.match(
    migration,
    /REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I\.%I FROM PUBLIC, anon, authenticated/i,
  )
})

test('ON CALL browser non-CRUD hardening preserves normal CRUD contracts', () => {
  assert.doesNotMatch(migration, /REVOKE[^\n]*(INSERT|UPDATE|DELETE|SELECT)/i)
})

test('ON CALL browser privilege hardening does not modify S.O.S. product objects', () => {
  const executable = migration
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')

  assert.doesNotMatch(executable, /\bsos_/i)
})
