import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const activeClientFiles = [
  'src/main.tsx','src/supabase.ts','src/marketplace-client.ts','src/OnCallEntry.tsx','src/OnCallMarketplace.tsx','src/ProviderCommand.tsx','src/ProviderMatchHost.tsx','src/ProviderNoShowHost.tsx','src/CustomerProfileToolsHost.tsx','src/CustomerRealtimeBridge.tsx','src/OperationsCommand.tsx','src/PushRegistrationHost.tsx',
]

test('ON CALL is pinned to the approved shared backend while keeping the oc namespace', () => {
  const client = read('src/supabase.ts')
  assert.match(client, /cxdqkjvtpilvouwtbgdy/)
  assert.match(client, /expectedProjectRef = 'cxdqkjvtpilvouwtbgdy'/)
  assert.match(client, /oc_users/)
  assert.match(client, /oc_provider_profiles/)
  assert.doesNotMatch(client, /from\(['"]sos_(?!get_runtime_secret)/)
})

test('production provider route cannot fall back to the legacy all-in-one app', () => {
  const main = read('src/main.tsx')
  assert.match(main, /const ProviderCommand = lazy/)
  assert.match(main, /pathname === '\/provider'/)
  assert.match(main, /<ProviderCommand\/>/)
  assert.doesNotMatch(main, /import App from ['"]\.\/App/)
})

test('provider service completion is payment-gated, idempotent, and auto-retryable', () => {
  const client = read('src/supabase.ts'), completion = read('supabase/functions/oc-complete-service/index.ts')
  assert.match(client, /assertMarketplacePaymentsReady\(\)/)
  assert.match(client, /oc-complete-service/)
  assert.match(completion, /\["working","completed"\]/)
  assert.match(completion, /Customer payment authorization is required before completion/)
  assert.match(completion, /paymentIntents\.capture/)
  assert.match(completion, /idempotencyKey:`oc-payment-\$\{payment\.id\}-capture-v2`/)
  assert.match(completion, /Automatic capture retry queued/)
  assert.match(completion, /pending_retry/)
  assert.match(completion, /payment capture will retry automatically/i)
  assert.doesNotMatch(completion, /Reopen this completed job/)
})

test('customer payment authorization has a secure hosted fallback when Stripe.js is not configured', () => {
  const client = read('src/supabase.ts')
  const host = read('src/PaymentReadinessHost.tsx')
  const shared = read('supabase/functions/_shared/oc-payments.ts')
  const checkout = read('supabase/functions/oc-create-checkout/index.ts')
  const webhook = read('supabase/functions/stripe-webhook/index.ts')
  assert.match(client, /VITE_STRIPE_PUBLISHABLE_KEY/)
  assert.match(client, /stripeClientPublishableKeyConfigured/)
  assert.match(client, /hostedCheckoutFallbackConfigured = true/)
  assert.match(client, /oc-create-checkout/)
  assert.match(client, /window\.location\.assign\(data\.checkoutUrl\)/)
  assert.match(client, /await assertMarketplacePaymentsReady\(\)/)
  assert.match(host, /stripeClientPublishableKeyConfigured\|\|hostedCheckoutFallbackConfigured/)
  assert.match(host, /NO CHARGE ATTEMPTED/)
  assert.match(checkout, /capture_method:'manual'/)
  assert.match(checkout, /Provider payout setup is incomplete/)
  assert.match(checkout, /stripe_checkout_session_id/)
  assert.match(webhook, /checkout\.session\.completed/)
  assert.match(webhook, /eq\('booking_id',bookingId\)/)
  assert.match(shared,/sos_get_runtime_secret/)
  assert.match(shared,/STRIPE_SECRET_KEY/)
})

test('provider payout onboarding uses Stripe Accounts v2 recipient capability only', () => {
  const connect=read('supabase/functions/oc-connect-onboarding/index.ts')
  const migration=read('supabase/migrations/20260809050000_add_marketplace_stripe_accounts_v2_status.sql')
  assert.match(connect,/2026-06-24\.dahlia/)
  assert.match(connect,/\/v2\/core\/accounts/)
  assert.match(connect,/\/v2\/core\/account_links/)
  assert.match(connect,/configuration:\{recipient:/)
  assert.match(connect,/stripe_transfers:\{requested:true\}/)
  assert.match(connect,/fees_collector:'application'/)
  assert.match(connect,/losses_collector:'application'/)
  assert.match(connect,/dashboard:'express'/)
  assert.match(connect,/stripe_account_api_version:'v2'/)
  assert.match(connect,/stripe_transfer_status/)
  assert.doesNotMatch(connect,/accounts\.create\(/)
  assert.doesNotMatch(connect,/type:\s*["']express["']/)
  assert.doesNotMatch(connect,/charges_enabled/)
  assert.match(migration,/stripe_account_api_version/)
})

test('customer cancellation uses quote then atomic settlement instead of a direct booking mutation', () => {
  const client = read('src/supabase.ts'), marketplace = read('src/marketplace-client.ts'), settlement = read('supabase/functions/oc-cancel-booking/index.ts')
  assert.match(client, /oc-cancel-booking/)
  assert.match(marketplace, /action: 'quote'/)
  assert.match(marketplace, /action: 'cancel'/)
  assert.match(settlement, /oc_customer_cancellation_quote/)
  assert.match(settlement, /amount_to_capture:feeCents/)
  assert.match(settlement, /settlement_type:'customer_cancellation'/)
})

test('customer no-show settlement requires arrival, wait expiry, authorization, and idempotent partial capture', () => {
  const host = read('src/ProviderNoShowHost.tsx'), settlement = read('supabase/functions/oc-customer-no-show/index.ts')
  assert.match(host, /oc-customer-no-show/)
  assert.match(settlement, /b\.status==='on_site'/)
  assert.match(settlement, /remainingSeconds===0/)
  assert.match(settlement, /pay\?\.status==='authorized'/)
  assert.match(settlement, /amount_to_capture:feeCents/)
  assert.match(settlement, /idempotencyKey:`oc-no-show-/)
})

test('Provider Command and floating offer card share one leased-offer source of truth', () => {
  const matchHost = read('src/ProviderMatchHost.tsx'), provider = read('src/ProviderCommand.tsx'), migration = read('supabase/migrations/20260809030500_provider_leased_offer_single_source.sql')
  assert.match(matchHost, /oc_provider_active_offers/)
  assert.match(matchHost, /EXCLUSIVE OFFER WINDOW/)
  assert.match(provider, /oc_provider_opportunities/)
  assert.match(provider, /acceptOffer/)
  assert.match(migration, /from public\.oc_provider_active_offers\(\) a/)
  assert.match(migration, /from public\.oc_booking_offers o[\s\S]*?o\.expires_at>now\(\)/)
  assert.doesNotMatch(migration, /oc_provider_opportunities_v2/)
})

test('customer booking, payment, and assigned provider GPS are realtime-first', () => {
  const main=read('src/main.tsx'),bridge=read('src/CustomerRealtimeBridge.tsx')
  assert.match(main,/CustomerRealtimeBridge/)
  assert.match(bridge,/realtime\.setAuth\(session\.access_token\)/)
  assert.match(bridge,/onAuthStateChange/)
  for(const table of ['oc_bookings','oc_booking_payments','oc_provider_locations']) assert.match(bridge,new RegExp(`table:'${table}'`))
  assert.match(bridge,/PROVIDER LIVE/)
  assert.match(bridge,/oc2-tracker-map iframe/)
  assert.match(bridge,/POLLING FALLBACK/)
})

test('provider applications have an operator-only review and approval surface',()=>{
  const main=read('src/main.tsx'),ops=read('src/OperationsCommand.tsx'),migration=read('supabase/migrations/20260809041000_add_on_call_operations_provider_review.sql')
  assert.match(main,/pathname === '\/ops'/)
  assert.match(main,/OperationsCommand/)
  assert.match(ops,/oc_ops_provider_applications/)
  assert.match(ops,/oc_ops_review_provider_application/)
  assert.match(ops,/Approve provider/)
  assert.match(migration,/private\.marketplace_operators/)
  assert.match(migration,/private\.is_marketplace_operator\(auth\.uid\(\)\)/)
  assert.match(migration,/same email|same-email|Open Provider Command with this same email/i)
  assert.match(migration,/revoke execute on function public\.oc_ops_review_provider_application/)
})

test('visible ON CALL customer profile controls are backed by real tools', () => {
  const main=read('src/main.tsx'), tools=read('src/CustomerProfileToolsHost.tsx'), paymentEdge=read('supabase/functions/oc-payment-methods/index.ts'), migration=read('supabase/migrations/20260809035000_finish_on_call_customer_profile_tools.sql')
  assert.match(main,/CustomerProfileToolsHost/)
  for(const label of ['Saved addresses','Payment methods','Recurring services']) assert.match(tools,new RegExp(label))
  for(const rpc of ['oc_upsert_saved_address','oc_delete_saved_address','oc_set_default_address','oc_customer_set_recurring_status']) assert.match(tools,new RegExp(rpc))
  assert.match(tools,/oc-payment-methods/)
  assert.match(tools,/PaymentElement/)
  assert.match(paymentEdge,/setupIntents\.create/)
  assert.match(paymentEdge,/paymentMethods\.detach/)
  assert.match(migration,/revoke insert,update,delete,references,trigger on public\.oc_saved_addresses from authenticated/)
})

test('authenticated marketplace clients can never TRUNCATE product tables', () => {
  const migration=read('supabase/migrations/20260809034500_revoke_authenticated_product_truncate.sql')
  assert.match(migration,/revoke truncate on table %s\.%s from authenticated/)
  assert.match(migration,/oc\\_%/)
  assert.match(migration,/sos\\_%/)
})

test('background provider offers have service-worker push registration and database alert generation', () => {
  const main=read('src/main.tsx'), host=read('src/PushRegistrationHost.tsx'), worker=read('public/marketplace-sw.js'), migration=read('supabase/migrations/20260809043000_add_on_call_provider_offer_push_trigger.sql'), cadence=read('supabase/migrations/20260809043500_accelerate_marketplace_push_delivery.sql')
  assert.match(main,/PushRegistrationHost/)
  assert.match(host,/marketplace-push-config/)
  assert.match(host,/marketplace_register_push_subscription/)
  assert.match(host,/p_app:'on_call'/)
  assert.match(host,/serviceWorker\.register\('\/marketplace-sw\.js'/)
  assert.match(worker,/addEventListener\('push'/)
  assert.match(worker,/showNotification/)
  assert.match(worker,/notificationclick/)
  assert.match(migration,/after insert on public\.oc_booking_offers/)
  assert.match(migration,/provider_offer/)
  assert.match(migration,/'push'/)
  assert.match(cadence,/schedule:='10 seconds'/)
})

test('desktop layout cannot regress to a universal 460px root shell', () => {
  const premium = read('src/premium-experience.css'), rescue = read('src/root-layout-rescue.css'), main = read('src/main.tsx')
  assert.doesNotMatch(premium, /\.oc-experience\s*>\s*\*\s*\{[^}]*max-width\s*:\s*460px/s)
  assert.match(rescue, /\.oc-experience\s*>\s*\.oc2-app[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.oc-experience\s*>\s*\.ocp-app[\s\S]*?max-width:\s*none\s*!important/)
  const rescueImport = main.indexOf("import './root-layout-rescue.css'"), marketplaceImport = main.indexOf("import './on-call-marketplace.css'"), toolsImport=main.indexOf("import './customer-profile-tools.css'"),opsImport=main.indexOf("import './operations-command.css'")
  assert.ok(rescueImport > marketplaceImport && rescueImport > toolsImport && rescueImport > opsImport, 'root layout rescue must be the last app stylesheet')
})

test('desktop marketplace and Provider Command cannot regress to micro-sized phone typography', () => {
  const rescue = read('src/root-layout-rescue.css')
  assert.match(rescue, /\.oc2-service-list strong,[\s\S]*?font-size:\s*14px\s*!important/)
  assert.match(rescue, /\.oc2-service-list p,[\s\S]*?font-size:\s*12px\s*!important/)
  assert.match(rescue, /\.oc2-nav button small[\s\S]*?font-size:\s*10px\s*!important/)
  assert.match(rescue, /\.ocp-live strong,[\s\S]*?font-size:\s*13px\s*!important/)
  assert.match(rescue, /\.ocp-metrics small,[\s\S]*?font-size:\s*10px\s*!important/)
})

test('active client lifecycle has no n8n dependency', () => {
  const source = activeClientFiles.map(read).join('\n')
  assert.doesNotMatch(source, /n8n/i)
})

test('production provider verification and dispatch truth are reproducible from source', () => {
  const ledger = read('supabase/migrations/20260809054048_on_call_provider_verification_ledger.sql')
  const bridge = read('supabase/migrations/20260809054134_on_call_verification_dispatch_bridge.sql')
  const snapshot = read('supabase/migrations/20260809054202_on_call_truthful_provider_command_snapshot.sql')
  const indexes = read('supabase/migrations/20260809054601_add_on_call_marketplace_fk_indexes.sql')

  assert.match(ledger, /oc_provider_verification_checks/)
  assert.match(ledger, /oc_application_service_matches/)
  assert.match(bridge, /oc_provider_core_dispatch_ready/)
  assert.match(bridge, /oc_provider_service_dispatch_ready/)
  assert.match(bridge, /oc_ops_review_provider_verification/)
  assert.match(snapshot, /verification_required_checks/)
  assert.match(snapshot, /dispatch_ready_services/)
  assert.match(indexes, /marketplace_push_deliveries_subscription_id_idx/)
  assert.match(indexes, /oc_booking_shares_customer_id_idx/)
  assert.match(indexes, /oc_provider_applications_reviewed_by_idx/)
})
