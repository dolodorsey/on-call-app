create or replace function public.oc_public_service_coverage_v2()
returns table(
  service_id text,
  service_name text,
  verified_supply_count bigint,
  live_supply_count bigint,
  has_verified_supply boolean,
  has_live_supply boolean
)
language sql
stable security definer
set search_path to 'pg_catalog','public','auth'
as $function$
with eligible as (
  select distinct
    ps.service_id,
    p.id as provider_id,
    (
      coalesce(p.is_available,false)
      and exists (
        select 1
        from public.oc_provider_locations l
        where l.provider_id=p.id
          and coalesce(l.is_on_duty,false)
          and l.updated_at >= now() - interval '15 minutes'
      )
    ) as live_now
  from public.oc_provider_services ps
  join public.oc_provider_profiles p
    on p.id=ps.provider_id
   and coalesce(ps.is_active,false)
   and p.approval_status='approved'
   and coalesce(p.identity_verified,false)
   and p.background_check_status in ('passed','cleared','approved')
   and coalesce(p.service_area_verified,false)
   and p.stripe_account_api_version='v2'
   and p.stripe_transfer_status='active'
  join public.oc_users u
    on u.id=p.user_id
   and u.status='active'
   and u.auth_id is not null
  join auth.users au
    on au.id=u.auth_id
   and coalesce((au.raw_app_meta_data->>'test_account')::boolean,false)=false
   and coalesce((au.raw_app_meta_data->>'enterprise_test_account')::boolean,false)=false
  join public.oc_service_catalog c
    on c.id=ps.service_id
   and c.is_active
   and (not coalesce(c.requires_license,false) or coalesce(p.license_verified,false))
   and (not coalesce(c.requires_insurance,false) or coalesce(p.insurance_verified,false))
)
select
  c.id,
  c.name,
  count(distinct e.provider_id)::bigint as verified_supply_count,
  count(distinct e.provider_id) filter(where e.live_now)::bigint as live_supply_count,
  (count(distinct e.provider_id)>0) as has_verified_supply,
  (count(distinct e.provider_id) filter(where e.live_now)>0) as has_live_supply
from public.oc_service_catalog c
left join eligible e on e.service_id=c.id
where c.is_active
group by c.id,c.name;
$function$;
revoke all on function public.oc_public_service_coverage_v2() from public;
grant execute on function public.oc_public_service_coverage_v2() to anon,authenticated;

create or replace function private.oc_enforce_customer_booking_supply()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_is_customer_request boolean:=false;
  v_verified bigint:=0;
  v_live bigint:=0;
begin
  if auth.uid() is null then return new; end if;
  select exists(
    select 1 from public.oc_users u
    where u.id=new.customer_id
      and u.auth_id=auth.uid()
      and u.role='customer'
      and u.status='active'
  ) into v_is_customer_request;
  if not v_is_customer_request then return new; end if;

  select coalesce(c.verified_supply_count,0),coalesce(c.live_supply_count,0)
  into v_verified,v_live
  from public.oc_public_service_coverage_v2() c
  where c.service_id=new.service_id;

  if v_verified<=0 then
    raise exception 'No verified ON CALL provider can fulfill this service yet. No booking was created.' using errcode='P0001';
  end if;
  if coalesce(new.request_type,new.booking_type,'on_demand')='on_demand' and v_live<=0 then
    raise exception 'No verified ON CALL provider is on duty for this service right now. No booking was created.' using errcode='P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists oc_customer_booking_supply_guard on public.oc_bookings;
create trigger oc_customer_booking_supply_guard
before insert on public.oc_bookings
for each row execute function private.oc_enforce_customer_booking_supply();
