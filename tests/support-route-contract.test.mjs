import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const main = read('src/main.tsx')
const support = read('src/SupportCenterRoute.tsx')
const links = read('src/LegalLinksHost.tsx')

test('/support renders the dedicated authenticated ON CALL support center', () => {
  assert.match(main, /const isSupport = pathname === '\/support'/)
  assert.match(main, /isSupport \? <SupportCenterRoute\/>/)
  assert.match(main, /import SupportCenterRoute from '\.\/SupportCenterRoute'/)
  assert.match(support, /SUPPORT CENTER/)
  assert.match(support, /Open support case/)
  assert.match(support, /oc_my_support_tickets/)
  assert.match(support, /oc_open_support_ticket/)
})

test('support center uses central auth and real booking choices instead of raw booking IDs', () => {
  assert.match(support, /import \{getBookings,signIn,supabase\}/)
  assert.match(support, /getBookings\(nextSession\.user\.id\)/)
  assert.match(support, /Related booking/)
  assert.match(support, /No booking \/ general account issue/)
  assert.match(support, /\/auth\/reset/)
  assert.doesNotMatch(support, /placeholder="Only if this case is about a booking"/)
})

test('global footer support link opens /support rather than bypassing the support center', () => {
  assert.match(links, /href="\/support"/)
  assert.match(links, /path==='\/support'/)
  assert.doesNotMatch(links, /mailto:[^"']+[^\n]*>SUPPORT</)
})
