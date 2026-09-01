-- ON CALL-only privilege hardening.
-- RLS is enabled on these tables, but direct table grants must still follow the
-- product boundary: public clients do not own CRM control-plane writes, and
-- authenticated users need read-only access to active pricing rules.
--
-- Do not change any sos_* object here; S.O.S. is governed separately even
-- though both products currently share infrastructure.

revoke all on table public.oc_crm_links from anon, authenticated;
revoke all on table public.oc_crm_outbox from anon, authenticated;

revoke all on table public.oc_pricing_rules from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.oc_pricing_rules from authenticated;
grant select on table public.oc_pricing_rules to authenticated;
