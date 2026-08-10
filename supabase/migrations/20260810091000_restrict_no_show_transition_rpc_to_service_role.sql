-- No-show settlement amounts are policy-derived by the authenticated Edge Function.
-- Do not allow providers/Heroes to call the transition RPC directly with caller-
-- supplied fee or compensation amounts.
revoke execute on function public.oc_provider_customer_no_show_v2(uuid,uuid,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.oc_provider_customer_no_show_v2(uuid,uuid,integer,integer,integer,integer) to service_role;

revoke execute on function public.sos_hero_customer_no_show_v2(uuid,uuid,numeric,numeric,integer,integer) from public, anon, authenticated;
grant execute on function public.sos_hero_customer_no_show_v2(uuid,uuid,numeric,numeric,integer,integer) to service_role;
