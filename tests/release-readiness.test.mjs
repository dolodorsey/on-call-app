import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const activeClientFiles = [
  'src/main.tsx',
  'src/supabase.ts',
  'src/marketplace-client.ts',
  'src/OnCallEntry.tsx',
  'src/OnCallMarketplace.tsx',
  'src/ProviderCommand.tsx',
  'src/ProviderMatchHost.tsx',
  'src/ProviderNoShowHost.tsx',
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

test('provider service completion is payment-gated and idempotent', () => {
  const client = read('src/supabase.ts')
  const completion = read('supabase/functions/oc-complete-service/index.ts')
  assert.match(client, /assertMarketplacePaymentsReady\(\)/)
  assert.match(client, /oc-complete-service/)
  assert.match(completion, /\["working","completed"\]/)
  assert.match(completion, /Customer payment authorization is required before completion/)
  assert.match(completion, /paymentIntents\.capture/)
  assert.match(completion, /idempotencyKey:`oc-payment-\$\{payment\.id\}-capture-v2`/)
  assert.match(completion, /Capture retry required/)
})

test('customer cancellation uses quote then atomic settlement instead of a direct booking mutation', () => {
  const client = read('src/supabase.ts')
  const marketplace = read('src/marketplace-client.ts')
  const settlement = read('supabase/functions/oc-cancel-booking/index.ts')
  assert.match(client, /oc-cancel-booking/)
  assert.match(marketplace, /action: 'quote'/)
  assert.match(marketplace, /action: 'cancel'/)
  assert.match(settlement, /oc_customer_cancellation_quote/)
  assert.match(settlement, /amount_to_capture:feeCents/)
  assert.match(settlement, /settlement_type:'customer_cancellation'/)
})

test('customer no-show settlement requires arrival, wait expiry, authorization, and idempotent partial capture', () => {
  const host = read('src/ProviderNoShowHost.tsx')
  const settlement = read('supabase/functions/oc-customer-no-show/index.ts')
  assert.match(host, /oc-customer-no-show/)
  assert.match(settlement, /b\.status==='on_site'/)
  assert.match(settlement, /remainingSeconds===0/)
  assert.match(settlement, /pay\?\.status==='authorized'/)
  assert.match(settlement, /amount_to_capture:feeCents/)
  assert.match(settlement, /idempotencyKey:`oc-no-show-/)
})

test('Provider Command and floating offer card share one leased-offer source of truth', () => {
  const matchHost = read('src/ProviderMatchHost.tsx')
  const provider = read('src/ProviderCommand.tsx')
  const migration = read('supabase/migrations/20260809030500_provider_leased_offer_single_source.sql')
  assert.match(matchHost, /oc_provider_active_offers/)
  assert.match(matchHost, /EXCLUSIVE OFFER WINDOW/)
  assert.match(provider, /oc_provider_opportunities/)
  assert.match(provider, /acceptOffer/)
  assert.match(migration, /from public\.oc_provider_active_offers\(\) a/)
  assert.match(migration, /from public\.oc_booking_offers o[\s\S]*?o\.expires_at>now\(\)/)
  assert.doesNotMatch(migration, /oc_provider_opportunities_v2/)
})

test('desktop layout cannot regress to a universal 460px root shell', () => {
  const premium = read('src/premium-experience.css')
  const rescue = read('src/root-layout-rescue.css')
  const main = read('src/main.tsx')
  assert.doesNotMatch(premium, /\.oc-experience\s*>\s*\*\s*\{[^}]*max-width\s*:\s*460px/s)
  assert.match(rescue, /\.oc-experience\s*>\s*\.oc2-app[\s\S]*?max-width:\s*none\s*!important/)
  assert.match(rescue, /\.oc-experience\s*>\s*\.ocp-app[\s\S]*?max-width:\s*none\s*!important/)
  const rescueImport = main.indexOf("import './root-layout-rescue.css'")
  const marketplaceImport = main.indexOf("import './on-call-marketplace.css'")
  const eliteImport = main.indexOf("import './elite-ui.css'")
  assert.ok(rescueImport > marketplaceImport && rescueImport > eliteImport, 'root layout rescue must be the last app stylesheet')
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
