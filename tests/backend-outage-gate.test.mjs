import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('ON CALL operational app fails closed until the exact backend is readable',()=>{
  const gate=read('src/OnCallBackendAvailabilityGate.tsx')
  const main=read('src/main.tsx')
  assert.match(gate,/cxdqkjvtpilvouwtbgdy\.supabase\.co\/functions\/v1\/oncall-health/)
  assert.match(gate,/HEALTH_TIMEOUT_MS=5_000/)
  assert.match(gate,/health\?\.app==='on_call'/)
  assert.match(gate,/software_status!=='unhealthy'/)
  assert.match(gate,/data-oc-backend-gate=\{state\}/)
  assert.match(gate,/No request or charge was attempted/)
  assert.match(main,/OnCallBackendAvailabilityGate/)
  assert.match(main,/function OperationalRoutes\(\)/)
  assert.match(main,/<OnCallBackendAvailabilityGate>[\s\S]*<InteractionContractHost\/>/)
})

test('legal and support surfaces remain available without mounting booking operations',()=>{
  const main=read('src/main.tsx')
  assert.match(main,/isPrivacy \? <LegalPage kind="privacy"\/>/)
  assert.match(main,/isTerms \? <LegalPage kind="terms"\/>/)
  assert.match(main,/isSupport \? <SupportCenterRoute\/>/)
  assert.match(main,/isAuthConfirm \? <OnCallBackendAvailabilityGate><AuthConfirmationRoute\/><\/OnCallBackendAvailabilityGate>/)
})
