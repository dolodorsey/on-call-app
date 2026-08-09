-- Shared marketplace launch-readiness coverage functions.
-- Counts only real, authenticated, fully verified, payout-ready supply.

create or replace function public.oc_public_service_coverage()
returns table(service_id text, service_name text, has_verified_supply boolean, verified_supply_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    c.id as service_id,
    c.name as service_name,
    (count(p.id) > 0) as has_verified_supply,
    count(p.id)::bigint as verified_supply_count
  from public.oc_service_catalog c
  left join public.oc_provider_services ps
    on ps.service_id = c.id and coalesce(ps.is_active,false)
  left join public.oc_provider_profiles p
    on p.id = ps.provider_id
   and p.approval_status = 'approved'
   and coalesce(p.identity_verified,false)
   and p.background_check_status in ('passed','cleared','approved')
   and coalesce(p.service_area_verified,false)
   and (not coalesce(c.requires_license,false) or coalesce(p.license_verified,false))
   and (not coalesce(c.requires_insurance,false) or coalesce(p.insurance_verified,false))
   and p.stripe_account_api_version = 'v2'
   and p.stripe_transfer_status = 'active'
  left join public.oc_users u
    on u.id = p.user_id and u.status = 'active' and u.auth_id is not null
  left join auth.users au
    on au.id = u.auth_id
   and coalesce((au.raw_app_meta_data->>'test_account')::boolean,false) = false
   and coalesce((au.raw_app_meta_data->>'enterprise_test_account')::boolean,false) = false
  where c.is_active
    and (p.id is null or (u.id is not null and au.id is not null))
  group by c.id,c.name;
$$;

create or replace function public.sos_public_service_coverage()
returns table(service_id text, service_name text, has_verified_supply boolean, verified_supply_count bigint)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    s.id as service_id,
    s.name as service_name,
    (count(h.id) > 0) as has_verified_supply,
    count(h.id)::bigint as verified_supply_count
  from public.sos_subcategories s
  left join public.sos_heroes h
    on s.id = any(h.services_enabled)
   and coalesce(h.is_demo,false) = false
   and h.verification_status = 'verified'
   and coalesce(h.id_verified,false)
   and coalesce(h.background_cleared,false)
   and coalesce(h.license_verified,false)
   and coalesce(h.insurance_verified,false)
   and coalesce(h.test_mission_passed,false)
   and h.stripe_connect_api_version = 'v2'
   and h.stripe_transfer_status = 'active'
  left join public.sos_users u
    on u.id = h.user_id
   and coalesce(u.is_demo,false) = false
   and u.status = 'active'
   and u.auth_id is not null
  left join auth.users au
    on au.id = u.auth_id
   and coalesce((au.raw_app_meta_data->>'test_account')::boolean,false) = false
   and coalesce((au.raw_app_meta_data->>'enterprise_test_account')::boolean,false) = false
  where s.is_active
    and (h.id is null or (u.id is not null and au.id is not null))
  group by s.id,s.name;
$$;

revoke all on function public.oc_public_service_coverage() from public, anon, authenticated;
revoke all on function public.sos_public_service_coverage() from public, anon, authenticated;
