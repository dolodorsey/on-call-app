import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source=fs.readFileSync(new URL('../src/MarketplaceLaunchReadinessHost.tsx',import.meta.url),'utf8')

test('launch board keeps software blockers separate from activation blockers',()=>{
 assert.match(source,/const softwareBlockers=/)
 assert.match(source,/const activationBlockers=/)
 assert.match(source,/SOFTWARE READINESS/)
 assert.match(source,/MARKET ACTIVATION/)
 assert.match(source,/Software ≠ market activation/)
 assert.doesNotMatch(source,/No software\/activation blockers detected by this board/)
})

test('launch board reads product health for push and support readiness',()=>{
 assert.match(source,/oncall-health/)
 assert.match(source,/sos-health/)
 assert.match(source,/checks\?\.push\?\.ready/)
 assert.match(source,/checks\?\.support\?\.table_reachable/)
 assert.match(source,/Software green means the deployed product/)
})
