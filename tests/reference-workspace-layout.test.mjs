import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const marketplace = readFileSync(new URL('../src/OnCallMarketplace.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/on-call-reference-upgrade.css', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('reference workspace styles load last and preserve the ON CALL dark system', () => {
  assert.match(entry, /on-call-public-app-shell\.css'\s*\nimport '\.\/on-call-reference-upgrade\.css'/)
  assert.match(styles, /var\(--oc2-line\)/)
  assert.match(styles, /#07111e/)
})

test('desktop workspace exposes location, search, bookings, and account navigation', () => {
  for (const label of ['Set location', 'Search', 'Bookings', 'Account']) assert.match(marketplace, new RegExp(label))
  assert.match(styles, /\.oc2-desktop-actions\{display:flex/)
})

test('home, catalog, booking sheet, and tracker receive responsive desktop layouts', () => {
  assert.match(marketplace, /What do you need done\?/)
  assert.match(marketplace, /Get Help Now/)
  assert.match(marketplace, /Schedule for Later/)
  assert.match(marketplace, /Browse Services/)
  assert.match(styles, /\.oc2-service-list\{grid-template-columns:repeat\(4/)
  assert.match(styles, /\.oc2-service-sheet\{display:grid/)
  assert.match(styles, /\.oc2-tracker\{[^}]*display:grid!important/s)
  assert.match(styles, /@media\(max-width:599px\)/)
})
