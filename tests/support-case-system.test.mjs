import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const baseMigration=read('supabase/migrations/20260810033000_add_on_call_support_case_system.sql')
const roleMigration=read('supabase/migrations/20260810034500_allow_provider_support_booking_links.sql')
const migration=baseMigration+'\n'+roleMigration
const main=read('src/main.tsx')
const support=read('src/SupportCenterRoute.tsx')
const ops=read('src/SupportOpsHost.tsx')

test('ON CALL support records are private-by-default and exposed only through authenticated RPCs',()=>{
 assert.match(migration,/create table if not exists public\.oc_support_tickets/)
 assert.match(migration,/alter table public\.oc_support_tickets enable row level security/)
 assert.match(migration,/revoke all on public\.oc_support_tickets from anon, authenticated/)
 for(const fn of ['oc_open_support_ticket','oc_my_support_tickets','oc_ops_support_tickets','oc_ops_update_support_ticket','oc_my_supportable_bookings']) assert.match(migration,new RegExp(`function public\\.${fn}`))
 assert.match(migration,/grant execute on function public\.oc_open_support_ticket[\s\S]*?to authenticated/)
})

test('support booking links accept only the signed-in customer or assigned provider',()=>{
 assert.match(roleMigration,/left join public\.oc_provider_profiles p on p\.id=b\.provider_id/)
 assert.match(roleMigration,/b\.customer_id=v_user or p\.user_id=v_user/)
 assert.match(roleMigration,/raise exception 'Booking not found'/)
 assert.match(roleMigration,/case when b\.customer_id=me\.user_id then 'customer'::text else 'provider'::text end/)
 assert.match(support,/oc_my_supportable_bookings/)
 assert.match(support,/Provider job/)
 assert.match(support,/Customer booking/)
})

test('support cases create customer push acknowledgement and operator alerts',()=>{
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
