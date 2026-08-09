import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('provider applications create a real verification ledger instead of treating attestations as passed checks',()=>{
 const ledger=read('supabase/migrations/20260809060000_on_call_provider_verification_ledger.sql')
 assert.match(ledger,/create table if not exists public\.oc_provider_verification_checks/)
 for(const check of ['identity','background','skills','service_area','license','insurance']) assert.match(ledger,new RegExp(`'${check}'`))
 assert.match(ledger,/requires_license/)
 assert.match(ledger,/requires_insurance/)
 assert.match(ledger,/oc_provider_application_verification_init/)
})

test('approved application activation copies reviewed verification and never fabricates background passage',()=>{
 const bridge=read('supabase/migrations/20260809061000_on_call_verification_dispatch_bridge.sql')
 assert.match(bridge,/select case when status in \('passed','waived'\) then 'passed'/)
 assert.match(bridge,/background_check_status=excluded\.background_check_status/)
 assert.doesNotMatch(bridge,/background_check_status='passed',approval_status='active'/)
})

test('one service-aware readiness rule governs online status, offers, acceptance, and dispatcher selection',()=>{
 const bridge=read('supabase/migrations/20260809061000_on_call_verification_dispatch_bridge.sql')
 assert.match(bridge,/private\.oc_provider_core_dispatch_ready/)
 assert.match(bridge,/private\.oc_provider_service_dispatch_ready/)
 assert.match(bridge,/create or replace function public\.oc_provider_set_presence/)
 assert.match(bridge,/create or replace function public\.oc_provider_active_offers/)
 assert.match(bridge,/create or replace function public\.oc_accept_offer/)
 assert.match(bridge,/create or replace function private\.oc_dispatch_one_booking/)
 const calls=(bridge.match(/private\.oc_provider_service_dispatch_ready/g)||[]).length
 assert.ok(calls>=6,`expected service readiness to be reused across the lifecycle, found ${calls}`)
})

test('core safety checks cannot be waived and conditional license/insurance can be service-specific',()=>{
 const bridge=read('supabase/migrations/20260809061000_on_call_verification_dispatch_bridge.sql')
 assert.match(bridge,/p_status='waived' and p_check_type in \('identity','background','skills','service_area'\)/)
 assert.match(bridge,/Core safety verification cannot be waived/)
 assert.match(bridge,/requires_license/)
 assert.match(bridge,/requires_insurance/)
})

test('operators and providers both get truthful verification UI',()=>{
 const main=read('src/main.tsx')
 const ops=read('src/ProviderVerificationOpsHost.tsx')
 const readiness=read('src/ProviderVerificationReadinessHost.tsx')
 assert.match(main,/ProviderVerificationOpsHost/)
 assert.match(main,/ProviderVerificationReadinessHost/)
 assert.match(ops,/oc_ops_provider_verifications/)
 assert.match(ops,/oc_ops_review_provider_verification/)
 assert.match(readiness,/oc_provider_verification_status/)
 assert.match(readiness,/dispatch_ready_services/)
 assert.match(readiness,/Identity, background, skills, and service-area checks must pass/)
})
