create or replace function public.oc_public_service_coverage()
returns table(service_id text,service_name text,has_verified_supply boolean)
language sql stable security definer set search_path='pg_catalog','public','private' as $$
 select s.id,s.name,exists(
   select 1 from public.oc_provider_services ps
   join public.oc_provider_profiles p on p.id=ps.provider_id
   where ps.service_id=s.id and ps.is_active and private.oc_provider_service_dispatch_ready(p.id,s.id)
 )
 from public.oc_service_catalog s where s.is_active order by s.name
$$;
revoke all on function public.oc_public_service_coverage() from public;
grant execute on function public.oc_public_service_coverage() to anon,authenticated;
