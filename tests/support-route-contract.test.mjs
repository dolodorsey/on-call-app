import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.tsx')
const legal = read('src/LegalPage.tsx')
const links = read('src/LegalLinksHost.tsx')

test('/support renders the dedicated ON CALL support center instead of the customer marketplace', () => {
  assert.match(main, /const isSupport = pathname === '\/support'/)
  assert.match(main, /isSupport \? <LegalPage kind="support"\/>/)
  assert.match(legal, /type LegalKind='privacy'\|'terms'\|'support'/)
  assert.match(legal, /Support Center/)
  assert.match(legal, /function Support\(\)/)
})

test('support center routes users to authenticated and provider help paths', () => {
  assert.match(legal, /\/auth\/reset/)
  assert.match(legal, /\/apply/)
  assert.match(legal, /\/provider\/activate/)
  assert.match(legal, /Booking help/)
  assert.match(legal, /Payments and refunds/)
  assert.match(legal, /Account privacy and deletion/)
})

test('global footer support link opens /support rather than bypassing the support center', () => {
  assert.match(links, /href="\/support"/)
  assert.match(links, /path==='\/support'/)
  assert.doesNotMatch(links, /mailto:[^"']+[^\n]*>SUPPORT</)
})
