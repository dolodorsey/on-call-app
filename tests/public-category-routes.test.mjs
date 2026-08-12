import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entry = readFileSync(new URL('../src/OnCallEntry.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/on-call-public-app-shell.css', import.meta.url), 'utf8')

test('signed-out home is category-first and no longer renders the full service catalog', () => {
  assert.match(entry, /What do you need\?/)
  assert.match(entry, /oce-category-grid/)
  assert.doesNotMatch(entry, /Browse everything/)
  assert.match(entry, /!routeCategory&&/)
  assert.match(entry, /routeCategory&&<section/)
})

test('public categories use distinct URLs with history back and a safe home fallback', () => {
  assert.match(entry, /\/services\/\$\{encodeURIComponent\(id\)\}/)
  assert.match(entry, /history\.pushState\(\{onCallInternal:true\}/)
  assert.match(entry, /history\.state\?\.onCallInternal\?history\.back\(\):goHome\(\)/)
  assert.match(entry, /addEventListener\('popstate'/)
})

test('category cards and service grids collapse across tablet and mobile breakpoints', () => {
  assert.match(shell, /@media\(max-width:900px\).*oce-category-grid\{grid-template-columns:repeat\(2/s)
  assert.match(shell, /@media\(max-width:700px\).*oce-category-grid\{grid-template-columns:1fr\}/s)
  assert.match(shell, /@media\(max-width:700px\).*oce-grid\{grid-template-columns:1fr!important\}/s)
  assert.match(shell, /\.oc-public-utility\{position:relative!important/)
})
