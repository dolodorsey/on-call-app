-- Retire obsolete client-callable marketplace paths after verifying production
-- callers use the controlled replacements.
-- ON CALL providers consume leased/scoped offers through oc_provider_active_offers
-- and oc_provider_opportunities; the legacy feed used weaker eligibility checks.
revoke execute on function public.oc_available_offers() from public, anon, authenticated, service_role;

-- S.O.S. customer cancellation is mediated by sos-cancel-mission and
-- sos_cancel_own_mission_v2, which applies the cancellation quote, fee,
-- Hero compensation, policy version, offer cleanup, payment settlement, and audit.
revoke execute on function public.sos_cancel_own_mission(uuid,text) from public, anon, authenticated, service_role;
