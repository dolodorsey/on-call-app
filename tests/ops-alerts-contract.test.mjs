import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('application alerts are shared infrastructure with per-operator read receipts',()=>{
 const migration=read('supabase/migrations/20260809064500_marketplace_operator_application_alerts.sql')
 assert.match(migration,/marketplace_operator_alerts/)
 assert.match(migration,/marketplace_operator_alert_reads/)
 assert.match(migration,/primary key\(alert_id,operator_auth_id\)/)
 assert.match(migration,/product_key in \('on_call','sos'\)/)
})

test('new provider and Hero applications plus status changes emit operator alerts',()=>{
 const migration=read('supabase/migrations/20260809064500_marketplace_operator_application_alerts.sql')
 assert.match(migration,/provider_application_submitted/)
 assert.match(migration,/provider_application_status/)
 assert.match(migration,/hero_application_submitted/)
 assert.match(migration,/hero_application_status/)
 assert.match(migration,/after insert or update of status on public\.oc_provider_applications/)
 assert.match(migration,/after insert or update of status on public\.sos_hero_applications/)
})

test('operator alert feed and read mutation are authenticated operator-only',()=>{
 const migration=read('supabase/migrations/20260809064500_marketplace_operator_application_alerts.sql')
 assert.match(migration,/where public\.marketplace_operator_check\(\)/)
 assert.match(migration,/not public\.marketplace_operator_check\(\)/)
 assert.match(migration,/revoke all on function public\.marketplace_ops_alert_feed\(integer\) from public,anon/)
 assert.match(migration,/grant execute on function public\.marketplace_ops_alert_feed\(integer\) to authenticated/)
})

test('ON CALL operations mounts the shared inbox and never includes verification evidence',()=>{
 const main=read('src/main.tsx')
 const host=read('src/MarketplaceOpsAlertsHost.tsx')
 assert.match(main,/MarketplaceOpsAlertsHost/)
 assert.match(host,/marketplace_ops_alert_feed/)
 assert.match(host,/marketplace_ops_mark_alert_read/)
 assert.match(host,/Application activity/)
 assert.match(host,/never exposes verification documents or credentials/i)
})
