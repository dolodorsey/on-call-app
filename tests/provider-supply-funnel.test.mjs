import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL provider application collects screening attestations before approval',()=>{
 const apply=read('components/ProviderApply.jsx')
 const ops=read('src/OperationsCommand.tsx')
 const edge=read('supabase/functions/on-call-provider-application/index.ts')
 const migration=read('supabase/migrations/20260809055000_strengthen_provider_application_screening.sql')
 for(const field of ['background_check_consent','license_attested','insurance_attested','terms_accepted']){
  assert.match(apply,new RegExp(field));assert.match(edge,new RegExp(field));assert.match(migration,new RegExp(field));assert.match(ops,new RegExp(field))
 }
 assert.match(apply,/License requirement attestation/)
 assert.match(apply,/Insurance requirement attestation/)
 assert.match(ops,/SCREENING ATTESTATIONS/)
 assert.match(migration,/Approval is blocked/)
 assert.doesNotMatch(edge,/ON_CALL_PROVIDER_WEBHOOK/)
})

test('ON CALL approval still separates application approval from provider readiness',()=>{
 const migration=read('supabase/migrations/20260809055000_strengthen_provider_application_screening.sql')
 const provider=read('src/ProviderCommand.tsx')
 assert.match(migration,/Verification and payout readiness are still required before accepting work/)
 assert.match(provider,/background/)
 assert.match(provider,/payout/i)
 assert.match(provider,/oc_provider_activate_approved_application/)
})
