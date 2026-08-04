-- ON CALL provider supply, verification, and activation controls.
-- No sourced prospect is approved by this migration. A real application,
-- completed checks, a real account, and explicit service-role approval are required.

alter table public.oc_provider_profiles
  add column if not exists approval_status text not null default 'pending',
  add column if not exists identity_verified boolean not null default false,
  add column if not exists license_verified boolean not null default false,
  add column if not exists insurance_verified boolean not null default false,
  add column if not exists service_area_verified boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists deactivated_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='oc_provider_profiles_approval_status_check') then
    alter table public.oc_provider_profiles add constraint oc_provider_profiles_approval_status_check
      check (approval_status in ('pending','verification','approved','active','suspended','rejected'));
  end if;
end $$;

create table if not exists public.oc_application_service_matches (
  application_id uuid not null references public.oc_provider_applications(id) on delete cascade,
  service_id text not null references public.oc_service_catalog(id) on delete cascade,
  match_method text not null check (match_method in ('exact_id','exact_name','manual')),
  approved boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(application_id,service_id)
);

create table if not exists public.oc_provider_verification_checks (
  application_id uuid not null references public.oc_provider_applications(id) on delete cascade,
  check_type text not null check (check_type in ('identity','background','license','insurance','skills','service_area','vehicle','payout_account')),
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','submitted','under_review','passed','failed','waived','expired')),
  evidence_urls text[] not null default '{}',
  expires_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(application_id,check_type)
);

create table if not exists public.oc_service_supply_targets (
  city text not null,
  state_code text not null,
  service_id text not null references public.oc_service_catalog(id) on delete cascade,
  target_approved_providers integer not null default 5 check (target_approved_providers>=1),
  target_on_duty_providers integer not null default 1 check (target_on_duty_providers>=0),
  launch_priority smallint not null default 5 check (launch_priority between 1 and 10),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(city,state_code,service_id)
);

alter table public.oc_application_service_matches enable row level security;
alter table public.oc_provider_verification_checks enable row level security;
alter table public.oc_service_supply_targets enable row level security;
revoke all on public.oc_application_service_matches,public.oc_provider_verification_checks,public.oc_service_supply_targets from anon,authenticated;

create or replace function public.oc_initialize_application_verification()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
begin
  insert into public.oc_provider_verification_checks(application_id,check_type,required)
  values
    (new.id,'identity',true),(new.id,'background',true),(new.id,'skills',true),(new.id,'service_area',true),
    (new.id,'insurance',true),(new.id,'payout_account',true),(new.id,'license',false),(new.id,'vehicle',new.has_vehicle)
  on conflict(application_id,check_type) do update set required=excluded.required,updated_at=now();

  insert into public.oc_application_service_matches(application_id,service_id,match_method)
  select new.id,s.id,
    case when exists(select 1 from unnest(new.services_requested) r where lower(r)=lower(s.id)) then 'exact_id' else 'exact_name' end
  from public.oc_service_catalog s
  where s.is_active and exists (
    select 1 from unnest(new.services_requested) r
    where lower(regexp_replace(r,'[^a-z0-9]+','','g')) in (
      lower(regexp_replace(s.id,'[^a-z0-9]+','','g')),
      lower(regexp_replace(s.name,'[^a-z0-9]+','','g'))
    )
  )
  on conflict(application_id,service_id) do nothing;
  return new;
end;$$;

revoke all on function public.oc_initialize_application_verification() from public;

drop trigger if exists oc_provider_application_supply_init on public.oc_provider_applications;
create trigger oc_provider_application_supply_init
after insert or update of services_requested,has_vehicle on public.oc_provider_applications
for each row execute function public.oc_initialize_application_verification();

insert into public.oc_service_supply_targets(city,state_code,service_id,target_approved_providers,target_on_duty_providers,launch_priority)
select c.city,c.state_code,s.id,
 case when c.city='Atlanta' then 10 else 4 end,
 case when c.city='Atlanta' then 2 else 1 end,
 case when c.city='Atlanta' then 10 else 6 end
from (values
 ('Atlanta','GA'),('Houston','TX'),('Dallas','TX'),('Miami','FL'),('Charlotte','NC'),
 ('Washington','DC'),('New York','NY'),('Los Angeles','CA'),('Phoenix','AZ'),('Las Vegas','NV')
) c(city,state_code)
cross join public.oc_service_catalog s
where s.is_active
on conflict(city,state_code,service_id) do update set
 target_approved_providers=excluded.target_approved_providers,
 target_on_duty_providers=excluded.target_on_duty_providers,
 launch_priority=excluded.launch_priority,
 is_active=true,
 updated_at=now();

create or replace view public.oc_provider_activation_readiness
with (security_invoker=true)
as
select a.id as application_id,a.application_number,a.first_name,a.last_name,a.email,a.city,a.state_code,a.status as application_status,
 count(distinct m.service_id)::integer as mapped_services,
 count(*) filter (where v.required)::integer as required_checks,
 count(*) filter (where v.required and v.status='passed')::integer as passed_checks,
 coalesce(bool_and(case when v.required then v.status='passed' else true end),false) as verification_complete,
 p.id as provider_id,p.approval_status,p.stripe_onboarding_complete,p.activated_at
from public.oc_provider_applications a
left join public.oc_application_service_matches m on m.application_id=a.id
left join public.oc_provider_verification_checks v on v.application_id=a.id
left join public.oc_users u on lower(u.email)=lower(a.email)
left join public.oc_provider_profiles p on p.user_id=u.id
group by a.id,p.id;
revoke all on public.oc_provider_activation_readiness from anon,authenticated;

create or replace function public.oc_approve_and_map_provider(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_application public.oc_provider_applications%rowtype;
  v_user public.oc_users%rowtype;
  v_provider_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into v_application from public.oc_provider_applications where id=p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if exists(select 1 from public.oc_provider_verification_checks where application_id=p_application_id and required and status<>'passed') then
    raise exception 'All required verification checks must pass';
  end if;
  if not exists(select 1 from public.oc_application_service_matches where application_id=p_application_id) then
    raise exception 'Application has no catalog service mappings';
  end if;
  select * into v_user from public.oc_users where lower(email)=lower(v_application.email) limit 1;
  if not found then raise exception 'Applicant must create an ON CALL account before activation'; end if;

  update public.oc_users set role='provider',updated_at=now() where id=v_user.id;
  insert into public.oc_provider_profiles(
    user_id,skills,is_available,background_check_status,approval_status,
    identity_verified,license_verified,insurance_verified,service_area_verified,activated_at
  ) values (
    v_user.id,v_application.services_requested,false,'approved','active',true,
    coalesce((select status='passed' from public.oc_provider_verification_checks where application_id=p_application_id and check_type='license'),false),
    true,true,now()
  )
  on conflict(user_id) do update set
    skills=excluded.skills,
    background_check_status='approved',
    approval_status='active',
    identity_verified=true,
    license_verified=excluded.license_verified,
    insurance_verified=true,
    service_area_verified=true,
    activated_at=coalesce(public.oc_provider_profiles.activated_at,now()),
    updated_at=now()
  returning id into v_provider_id;

  insert into public.oc_provider_services(provider_id,service_id,is_active)
  select v_provider_id,m.service_id,true
  from public.oc_application_service_matches m
  where m.application_id=p_application_id
  on conflict(provider_id,service_id) do update set is_active=true;

  update public.oc_application_service_matches set approved=true,reviewed_at=now() where application_id=p_application_id;
  update public.oc_provider_applications set status='approved',updated_at=now() where id=p_application_id;
  return v_provider_id;
end;$$;

revoke all on function public.oc_approve_and_map_provider(uuid) from public;
grant execute on function public.oc_approve_and_map_provider(uuid) to service_role;

create unique index if not exists oc_provider_profiles_user_uidx on public.oc_provider_profiles(user_id) where user_id is not null;
create index if not exists oc_application_matches_service_idx on public.oc_application_service_matches(service_id,approved);
create index if not exists oc_verification_status_idx on public.oc_provider_verification_checks(status,check_type);
create index if not exists oc_supply_targets_priority_idx on public.oc_service_supply_targets(launch_priority desc,city,service_id);
