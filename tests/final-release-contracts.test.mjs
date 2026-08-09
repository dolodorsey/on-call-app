import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('ON CALL customer account recovery is mounted and can complete a real password reset', () => {
  const main=read('src/main.tsx'), recovery=read('src/CustomerRecoveryHost.tsx')
  assert.match(main,/CustomerRecoveryHost/)
  assert.match(recovery,/resetPasswordForEmail/)
  assert.match(recovery,/updateUser\(\{ password \}\)/)
  assert.match(recovery,/PASSWORD_RECOVERY/)
  assert.match(recovery,/https:\/\/oncallallday\.com\/\?recovery=1/)
})

test('shared webhook reconciles ON CALL Accounts v2 instead of ignoring them', () => {
  const webhook=read('supabase/functions/stripe-webhook/index.ts')
  assert.match(webhook,/2026-06-24\.dahlia/)
  assert.match(webhook,/\/v2\/core\/accounts\//)
  assert.match(webhook,/stripe_account_api_version==='v2'/)
  assert.match(webhook,/stripe_transfer_status:transfers/)
  assert.match(webhook,/stripe_requirements_due:requirements/)
  assert.match(webhook,/stripe_payouts_enabled:ready/)
  assert.doesNotMatch(webhook,/ignored_legacy_account_snapshot:true/)
})

test('ON CALL iOS delivery is automated and builds the Capacitor SPM xcodeproj', () => {
  const fastlane=read('ios/App/fastlane/Fastfile'), workflow=read('.github/workflows/ios-testflight.yml'), gemfile=read('Gemfile')
  assert.match(fastlane,/project: "App\.xcodeproj"/)
  assert.doesNotMatch(fastlane,/App\.xcworkspace/)
  assert.match(fastlane,/upload_to_testflight/)
  assert.match(fastlane,/allowProvisioningUpdates/)
  assert.match(workflow,/runs-on: macos-latest/)
  assert.match(workflow,/npm run verify/)
  assert.match(workflow,/npx cap sync ios/)
  assert.match(workflow,/bundle exec fastlane ios beta/)
  assert.match(workflow,/ASC_KEY_ID/)
  assert.match(gemfile,/fastlane", "2\.237\.0"/)
})
