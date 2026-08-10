import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260810040000_scrub_support_cases_on_account_deletion.sql',import.meta.url),'utf8')
const host=fs.readFileSync(new URL('../src/AccountDeletionHost.tsx',import.meta.url),'utf8')

test('ON CALL account deletion scrubs newly-created support case content',()=>{
 assert.match(migration,/update public\.oc_support_tickets/)
 assert.match(migration,/subject='Deleted account support record'/)
 assert.match(migration,/description=''/)
 assert.match(migration,/operator_note=null/)
 assert.match(migration,/status='closed'/)
 assert.match(migration,/support_cases_scrubbed/)
})

test('ON CALL account deletion still uses the server-side anonymization function before auth removal',()=>{
 assert.match(host,/on-call-delete-account/)
 assert.match(host,/confirm:true/)
 assert.match(host,/Account deletion/)
})
