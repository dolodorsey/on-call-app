import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('health contract identifies the app and authority', () => {
  const health = JSON.parse(read('public/health.json'))
  assert.equal(health.app, 'on-call-app')
  assert.equal(health.authority, 'MCP Gateway public.oc_*')
  assert.equal(health.schema_version, 1)
})

test('handoff protects booking identity and payment retries', () => {
  const handoff = read('docs/HANDOFF.md')
  assert.match(handoff, /oc_bookings/)
  assert.match(handoff, /duplicate charge/i)
  assert.match(handoff, /role isolation/i)
})
