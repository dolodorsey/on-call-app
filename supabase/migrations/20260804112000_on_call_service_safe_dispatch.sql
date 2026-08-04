-- ON CALL service-safe dispatch and booking-readiness control plane.
-- Additive/reversible operational hardening. No provider or booking data is fabricated.

create index if not exists oc_provider_services_service_active_idx
  on public.oc_provider_services(service_id,provider_id)
  where is_active;
create index if not exists oc_provider_profiles_dispatch_ready_idx
  on public.oc_provider_profiles(id)
  where approval_status='active'
    and background_check_status='passed'
    and identity_verified
    and insurance_verified
    and service_area_verified
    and stripe_onboarding_complete
    and stripe_charges_enabled
    and stripe_payouts_enabled
    and activated_at is not null;
create index if not exists oc_provider_applications_email_city_idx
  on public.oc_provider_applications(lower(email),lower(city),upper(state_code));
create index if not exists oc_bookings_open_service_idx
  on public.oc_bookings(service_id,created_at)
  where status in ('pending','matching') and provider_id is null;

create or replace function public.oc_provider_is_dispatch_ready(p_provider_id uuid,p_require_available boolean default true)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public'
as $function$
  select exists(
    select 1
    from public.oc_provider_profiles p
    join public.oc_users u on u.id=p.user_id
    where p.id=p_provider_id
      and u.role='provider'
      and p.approval_status='active'
      and p.background_check_status='passed'
      and p.identity_verified
      and p.insurance_verified
      and p.service_area_verified
      and p.stripe_onboarding_complete
      and p.stripe_charges_enabled
      and p.stripe_payouts_enabled
      and p.activated_at is not null
      and (not p_require_available or p.is_available)
  );
$function$;

create or replace function public.oc_reconcile_provider_activation()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_has_service boolean;
  v_ready boolean;
begin
  select exists(
    select 1 from public.oc_provider_services ps
    where ps.provider_id=new.id and ps.is_active
  ) into v_has_service;

  v_ready:=
    new.background_check_status='passed'
    and new.identity_verified
    and new.insurance_verified
    and new.service_area_verified
    and new.stripe_onboarding_complete
    and new.stripe_charges_enabled
    and new.stripe_payouts_enabled
    and v_has_service;

  if new.approval_status in ('suspended','rejected') then
    new.is_available:=false;
    new.deactivated_at:=coalesce(new.deactivated_at,now());
  elsif v_ready then
    new.approval_status:='active';
    new.activated_at:=coalesce(new.activated_at,now());
    new.deactivated_at:=null;
  else
    if new.approval_status not in ('pending','verification') then
      new.approval_status:='approved';
    end if;
    new.is_available:=false;
    if old.id is not null and old.approval_status='active' then
      new.deactivated_at:=now();
    end if;
    new.activated_at:=null;
  end if;
  return new;
end;
$function$;

drop trigger if exists oc_reconcile_provider_activation_trigger on public.oc_provider_profiles;
create trigger oc_reconcile_provider_activation_trigger
before insert or update of background_check_status,approval_status,identity_verified,insurance_verified,
  service_area_verified,stripe_onboarding_complete,stripe_charges_enabled,stripe_payouts_enabled,is_available,updated_at
on public.oc_provider_profiles
for each row execute function public.oc_reconcile_provider_activation();

create or replace function public.oc_approve_and_map_provider(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_application public.oc_provider_applications%rowtype;
  v_user public.oc_users%rowtype;
  v_provider_id uuid;
  v_required integer;
  v_passed integer;
  v_identity boolean;
  v_background boolean;
  v_license boolean;
  v_insurance boolean;
  v_service_area boolean;
begin
  if auth.role()<>'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into v_application
  from public.oc_provider_applications
  where id=p_application_id
  for update;
  if not found then raise exception 'Application not found'; end if;
  if not coalesce(v_application.background_check_consent,false) then
    raise exception 'Background-check consent is required';
  end if;

  select count(*) filter(where required),
         count(*) filter(where required and status='passed'),
         bool_or(check_type='identity' and status='passed'),
         bool_or(check_type='background' and status='passed'),
         bool_or(check_type='license' and status='passed'),
         bool_or(check_type='insurance' and status='passed'),
         bool_or(check_type='service_area' and status='passed')
    into v_required,v_passed,v_identity,v_background,v_license,v_insurance,v_service_area
  from public.oc_provider_verification_checks
  where application_id=p_application_id;

  if coalesce(v_required,0)<5 then
    raise exception 'Application verification checklist is incomplete';
  end if;
  if coalesce(v_passed,0)<>coalesce(v_required,0) then
    raise exception 'All required verification checks must pass';
  end if;
  if not coalesce(v_identity,false) or not coalesce(v_background,false)
     or not coalesce(v_insurance,false) or not coalesce(v_service_area,false) then
    raise exception 'Identity, background, insurance and service-area verification are required';
  end if;
  if not exists(
    select 1 from public.oc_application_service_matches
    where application_id=p_application_id
  ) then
    raise exception 'Application has no catalog service mappings';
  end if;

  select * into v_user
  from public.oc_users
  where lower(email)=lower(v_application.email)
  limit 1;
  if not found then
    raise exception 'Applicant must create an ON CALL account before approval';
  end if;

  update public.oc_users set role='provider',updated_at=now() where id=v_user.id;

  insert into public.oc_provider_profiles(
    user_id,skills,is_available,background_check_status,approval_status,
    identity_verified,license_verified,insurance_verified,service_area_verified,
    activated_at,updated_at
  ) values(
    v_user.id,v_application.services_requested,false,'passed','approved',
    true,coalesce(v_license,false),true,true,null,now()
  )
  on conflict(user_id) do update set
    skills=excluded.skills,
    background_check_status='passed',
    approval_status=case when public.oc_provider_profiles.approval_status in ('suspended','rejected')
                         then public.oc_provider_profiles.approval_status else 'approved' end,
    identity_verified=true,
    license_verified=excluded.license_verified,
    insurance_verified=true,
    service_area_verified=true,
    is_available=false,
    updated_at=now()
  returning id into v_provider_id;

  update public.oc_application_service_matches
  set approved=true,reviewed_at=now()
  where application_id=p_application_id;

  insert into public.oc_provider_services(provider_id,service_id,is_active)
  select v_provider_id,m.service_id,true
  from public.oc_application_service_matches m
  join public.oc_service_catalog s on s.id=m.service_id and s.is_active
  where m.application_id=p_application_id and m.approved
  on conflict(provider_id,service_id) do update set is_active=true;

  -- Re-evaluate activation after service mappings exist. Stripe readiness remains a hard gate.
  update public.oc_provider_profiles set updated_at=now() where id=v_provider_id;
  update public.oc_provider_applications set status='approved',updated_at=now() where id=p_application_id;
  return v_provider_id;
end;
$function$;

create or replace function public.oc_available_offers()
returns table(
  id uuid,service_name text,category_name text,total_price numeric,
  scheduled_at timestamptz,created_at timestamptz
)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $function$
  with current_provider as (
    select pp.id
    from public.oc_provider_profiles pp
    join public.oc_users u on u.id=pp.user_id
    where u.auth_id=auth.uid()
      and public.oc_provider_is_dispatch_ready(pp.id,true)
    limit 1
  )
  select b.id,b.service_name,b.category_name,b.total_price,b.scheduled_at,b.created_at
  from public.oc_bookings b
  join current_provider cp on true
  join public.oc_provider_services ps
    on ps.provider_id=cp.id and ps.service_id=b.service_id and ps.is_active
  where b.status in ('pending','matching')
    and b.provider_id is null
    and b.service_id is not null
  order by b.created_at
  limit 20;
$function$;

create or replace function public.oc_accept_offer(p_booking_id uuid)
returns public.oc_bookings
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_provider_id uuid;
  v_booking public.oc_bookings%rowtype;
begin
  select pp.id into v_provider_id
  from public.oc_provider_profiles pp
  join public.oc_users u on u.id=pp.user_id
  where u.auth_id=auth.uid()
    and public.oc_provider_is_dispatch_ready(pp.id,true)
  limit 1;
  if v_provider_id is null then
    raise exception 'Active, payout-ready and available provider account required' using errcode='42501';
  end if;

  update public.oc_bookings b
  set provider_id=v_provider_id,status='assigned',updated_at=now()
  where b.id=p_booking_id
    and b.status in ('pending','matching')
    and b.provider_id is null
    and b.service_id is not null
    and exists(
      select 1 from public.oc_provider_services ps
      where ps.provider_id=v_provider_id and ps.service_id=b.service_id and ps.is_active
    )
  returning b.* into v_booking;

  if not found then
    raise exception 'Offer is unavailable or outside this provider service catalog';
  end if;
  return v_booking;
end;
$function$;

create or replace function public.oc_provider_transition(p_booking_id uuid,p_status text)
returns public.oc_bookings
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_provider_id uuid;
  v_current text;
  v_payment_status text;
  v_booking public.oc_bookings%rowtype;
begin
  select pp.id into v_provider_id
  from public.oc_provider_profiles pp
  join public.oc_users u on u.id=pp.user_id
  where u.auth_id=auth.uid()
    and public.oc_provider_is_dispatch_ready(pp.id,false)
  limit 1;
  if v_provider_id is null then
    raise exception 'Active payout-ready provider account required' using errcode='42501';
  end if;

  select status into v_current
  from public.oc_bookings
  where id=p_booking_id and provider_id=v_provider_id
    and exists(
      select 1 from public.oc_provider_services ps
      where ps.provider_id=v_provider_id
        and ps.service_id=public.oc_bookings.service_id
        and ps.is_active
    )
  for update;
  if not found then raise exception 'Assigned qualified booking not found'; end if;

  if v_current='assigned' and p_status='en_route' then
    select status into v_payment_status
    from public.oc_booking_payments where booking_id=p_booking_id;
    if v_payment_status is distinct from 'authorized' then
      raise exception 'Customer payment authorization is required before travel';
    end if;
  end if;

  if not ((v_current='assigned' and p_status='en_route') or
          (v_current='en_route' and p_status='on_site') or
          (v_current='on_site' and p_status='working') or
          (v_current='working' and p_status='completed')) then
    raise exception 'Invalid booking transition';
  end if;

  update public.oc_bookings
  set status=p_status,updated_at=now(),
      completed_at=case when p_status='completed' then now() else completed_at end
  where id=p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$function$;

create or replace view public.oc_service_booking_readiness
with (security_invoker=true)
as
with provider_supply as (
  select lower(a.city) city_key,upper(a.state_code) state_code,ps.service_id,
         count(distinct p.id) filter(where public.oc_provider_is_dispatch_ready(p.id,false))::integer approved_providers,
         count(distinct p.id) filter(where public.oc_provider_is_dispatch_ready(p.id,true))::integer on_duty_providers
  from public.oc_provider_profiles p
  join public.oc_users u on u.id=p.user_id
  join public.oc_provider_applications a on lower(a.email)=lower(u.email)
  join public.oc_provider_services ps on ps.provider_id=p.id and ps.is_active
  group by lower(a.city),upper(a.state_code),ps.service_id
)
select t.city,t.state_code,t.service_id,s.name service_name,s.category_id,
       t.target_approved_providers,t.target_on_duty_providers,t.launch_priority,
       coalesce(p.approved_providers,0) approved_providers,
       coalesce(p.on_duty_providers,0) on_duty_providers,
       greatest(t.target_approved_providers-coalesce(p.approved_providers,0),0) approved_gap,
       greatest(t.target_on_duty_providers-coalesce(p.on_duty_providers,0),0) on_duty_gap,
       case
         when coalesce(p.approved_providers,0)=0 then 'no_approved_supply'
         when coalesce(p.approved_providers,0)<t.target_approved_providers then 'approved_supply_gap'
         when coalesce(p.on_duty_providers,0)<t.target_on_duty_providers then 'on_duty_gap'
         else 'ready'
       end readiness_status,
       now() evaluated_at
from public.oc_service_supply_targets t
join public.oc_service_catalog s on s.id=t.service_id and s.is_active
left join provider_supply p
  on p.city_key=lower(t.city) and p.state_code=upper(t.state_code) and p.service_id=t.service_id
where t.is_active;

create or replace function public.oc_get_public_booking_readiness(p_city text default 'Atlanta',p_state_code text default 'GA')
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public'
as $function$
  select jsonb_build_object(
    'city',initcap(lower(p_city)),
    'state_code',upper(p_state_code),
    'service_count',count(*),
    'ready_services',count(*) filter(where readiness_status='ready'),
    'services_with_approved_supply',count(*) filter(where approved_providers>0),
    'services_with_on_duty_supply',count(*) filter(where on_duty_providers>0),
    'total_approved_gap',coalesce(sum(approved_gap),0),
    'total_on_duty_gap',coalesce(sum(on_duty_gap),0),
    'readiness_pct',case when count(*)=0 then 0 else round(100.0*count(*) filter(where readiness_status='ready')/count(*),2) end,
    'evaluated_at',now()
  )
  from public.oc_service_booking_readiness
  where lower(city)=lower(p_city) and upper(state_code)=upper(p_state_code);
$function$;

revoke all on function public.oc_provider_is_dispatch_ready(uuid,boolean) from public,anon,authenticated;
revoke all on function public.oc_reconcile_provider_activation() from public,anon,authenticated;
revoke all on function public.oc_approve_and_map_provider(uuid) from public,anon,authenticated;
revoke all on function public.oc_available_offers() from public,anon;
revoke all on function public.oc_accept_offer(uuid) from public,anon;
revoke all on function public.oc_provider_transition(uuid,text) from public,anon;
revoke all on function public.oc_get_public_booking_readiness(text,text) from public;

grant execute on function public.oc_provider_is_dispatch_ready(uuid,boolean) to service_role;
grant execute on function public.oc_reconcile_provider_activation() to service_role;
grant execute on function public.oc_approve_and_map_provider(uuid) to service_role;
grant execute on function public.oc_available_offers() to authenticated,service_role;
grant execute on function public.oc_accept_offer(uuid) to authenticated,service_role;
grant execute on function public.oc_provider_transition(uuid,text) to authenticated,service_role;
grant execute on function public.oc_get_public_booking_readiness(text,text) to anon,authenticated,service_role;

revoke all on public.oc_service_booking_readiness from public,anon,authenticated;
grant select on public.oc_service_booking_readiness to service_role;
