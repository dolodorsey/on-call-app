-- Public clients consume aggregate coverage through the allowlisted
-- marketplace-public-coverage Edge Function. Keep the privileged aggregate
-- RPCs server-only instead of exposing SECURITY DEFINER functions directly.
revoke execute on function public.oc_public_service_coverage_v2() from public, anon, authenticated;
grant execute on function public.oc_public_service_coverage_v2() to service_role;

revoke execute on function public.sos_public_service_coverage() from public, anon, authenticated;
grant execute on function public.sos_public_service_coverage() to service_role;
