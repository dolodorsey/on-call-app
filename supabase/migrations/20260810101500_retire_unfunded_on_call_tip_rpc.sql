-- Retire the legacy ON CALL tip RPC until tipping is backed by a real Stripe charge/authorization update.
-- The old function only mutated database totals and could represent money that was never collected.
revoke execute on function public.oc_add_tip(uuid,integer) from public, anon, authenticated, service_role;
