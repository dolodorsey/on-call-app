-- ON CALL RPC permission hardening.
-- Public catalog/readiness endpoints remain intentionally aggregate-only.

revoke all on function public.oc_initialize_application_verification() from public,anon,authenticated;
revoke all on function public.oc_refresh_application_service_matches(uuid) from public,anon,authenticated;
revoke all on function public.oc_request_catalog_service(text,text,double precision,double precision,timestamptz,text,text) from public,anon;
revoke all on function public.oc_request_service(text,text,double precision,double precision,timestamptz) from public,anon;

grant execute on function public.oc_initialize_application_verification() to service_role;
grant execute on function public.oc_refresh_application_service_matches(uuid) to service_role;
grant execute on function public.oc_request_catalog_service(text,text,double precision,double precision,timestamptz,text,text) to authenticated,service_role;
grant execute on function public.oc_request_service(text,text,double precision,double precision,timestamptz) to authenticated,service_role;
