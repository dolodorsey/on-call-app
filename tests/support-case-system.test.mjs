import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/20260810033000_add_on_call_support_case_system.sql')
const main=read('src/main.tsx')
const support=read('src/SupportCenterRoute.tsx')
const ops=read('src/SupportOpsHost.tsx')

test('ON CALL support records are private-by-default and exposed only through authenticated RPCs',()=>{
 assert.match(migration,/create table if not exists public\.oc_support_tickets/)
 assert.match(migration,/alter table public\.oc_support_tickets enable row level security/)
 assert.match(migration,/revoke all on public\.oc_support_tickets from anon, authenticated/)
 for(const fn of ['oc_open_support_ticket','oc_my_support_tickets','oc_ops_support_tickets','oc_ops_update_support_ticket']) assert.match(migration,new RegExp(`function public\\.${fn}`))
 assert.match(migration,/grant execute on function public\.oc_open_support_ticket[\s\S]*?to authenticated/)
})

test('customers can only attach support cases to their own booking and get push acknowledgement',()=>{
 assert.match(migration,/customer_id=v_user/)
 assert.match(migration,/raise exception 'Booking not found'/)
 assert.match(migration,/support_ticket_opened/)
 assert.match(migration,/action_url,metadata,channel/)
 assert.match(migration,/'\/support'/)
 assert.match(migration,/marketplace_operator_alerts/)
 assert.match(migration,/'support_ticket'/)
})

test('operator support RPCs require marketplace operator identity and notify the customer of status updates',()=>{
 assert.match(migration,/private\.is_marketplace_operator\(auth\.uid\(\)\)/)
 assert.match(migration,/Marketplace operator access required/)
 assert.match(migration,/waiting_customer/)
 assert.match(migration,/support_ticket_'\|\|p_status/)
 assert.match(migration,/needs information from you/)
})

test('support center and operator queue are both mounted in production routes',()=>{
 assert.match(main,/isSupport \? <SupportCenterRoute\/>/)
 assert.match(main,/<SupportOpsHost\/>/)
 assert.match(support,/oc_open_support_ticket/)
 assert.match(support,/oc_my_support_tickets/)
 assert.match(ops,/oc_ops_support_tickets/)
 assert.match(ops,/oc_ops_update_support_ticket/)
 assert.match(ops,/marketplace_operator_check/)
})
