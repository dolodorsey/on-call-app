import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const truth = read('src/MarketplaceTruthHost.tsx')
const main = read('src/main.tsx')

test('ON CALL marketplace truth host stays mounted globally', () => {
  assert.match(main, /import MarketplaceTruthHost/)
  assert.match(main, /<MarketplaceTruthHost\/>/)
})

test('service availability copy is driven per service, not by one global supply flag', () => {
  assert.match(truth, /button\.dataset\.verifiedCoverage/)
  assert.match(truth, /state==='active'/)
  assert.match(truth, /Verified provider coverage/)
  assert.match(truth, /state==='activating'/)
  assert.match(truth, /Verified coverage activating/)
  assert.match(truth, /Checking verified coverage/)
  assert.match(truth, /attributeFilter:\['data-verified-coverage','src'\]/)
})

test('signed-out and home copy never promises universal live booking', () => {
  assert.match(truth, /Browse services now, then book where verified provider coverage is active\./)
  assert.match(truth, /Booking unlocks service-by-service as verified coverage activates\./)
})

test('tracker hides the Atlanta fallback when a manual-address booking has no coordinates', () => {
  assert.match(truth, /marker=33\.749%2C-84\.388/)
  assert.match(truth, /trackerFrame\.style\.visibility='hidden'/)
  assert.match(truth, /address-without-coordinates/)
  assert.match(truth, /pin\.style\.visibility='hidden'/)
  assert.match(truth, /booking-coordinates/)
})
