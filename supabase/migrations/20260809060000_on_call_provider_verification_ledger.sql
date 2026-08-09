-- Provider application approval is not verification. This ledger records the checks
-- that must actually be reviewed before dispatch can activate.
alter table public.oc_service_catalog
  add column if not exists requires_license boolean not null default false,
  add column if not exists requires_insurance boolean not null default false;

update public.oc_service_catalog set requires_license=false,requires_insurance=false;
update public.oc_service_catalog set requires_license=true where id in ('notary','barber','hair_styling','nails','massage','plumbing','electrician','hvac');
update public.oc_service_catalog set requires_insurance=true where id in (
  'handyman','plumbing','electrician','hvac','appliance','tv_mount','smart_home',
  'oil_change','battery_replace','tire_help','diagnostic',
  'moving_labor','pickup_delivery','courier','haul_dump','assembly_delivery',
  'bartender','private_chef','babysitter','elder_companion','massage'
);

create table if not exists public.oc_application_service_matches (
  application_id uuid not null references public.oc_provider_applications(id) on delete cascade,
  service_id text not null references public.oc_service_catalog(id) on delete cascade,
  match_method text not null check(match_method in ('exact_id','exact_name','manual')),
  approved boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(application_id,service_id)
);

create table if not exists public.oc_provider_verification_checks (
  application_id uuid not null references public.oc_provider_applications(id) on delete cascade,
  check_type text not null check(check_type in ('identity','background','license','insurance','skills','service_area','vehicle')),
  required boolean not null default true,
  status text not null default 'pending' check(status in ('pending','submitted','under_review','passed','failed','waived','expired')),
  evidence_urls text[] not null default '{}',
  expires_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(application_id,check_type)
);

alter table public.oc_application_service_matches enable row level security;
alter table public.oc_provider_verification_checks enable row level security;
revoke all on public.oc_application_service_matches,public.oc_provider_verification_checks from anon,authenticated;
create index if not exists oc_application_matches_service_idx on public.oc_application_service_matches(service_id,approved);
create index if not exists oc_verification_status_idx on public.oc_provider_verification_checks(status,check_type);

create or replace function private.oc_initialize_application_verification(p_application_id uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_app public.oc_provider_applications%rowtype; v_requires_license boolean:=false; v_requires_insurance boolean:=false;
begin
  select * into v_app from public.oc_provider_applications where id=p_application_id;
  if not found then return; end if;
  insert into public.oc_application_service_matches(application_id,service_id,match_method)
  select v_app.id,s.id,case when exists(select 1 from unnest(v_app.services_requested) r where lower(trim(r))=lower(s.id)) then 'exact_id' else 'exact_name' end
  from public.oc_service_catalog s where s.is_active and exists(
    select 1 from unnest(v_app.services_requested) r where lower(regexp_replace(trim(r),'[^a-z0-9]+','','g')) in (lower(regexp_replace(s.id,'[^a-z0-9]+','','g')),lower(regexp_replace(s.name,'[^a-z0-9]+','','g')))
  ) on conflict(application_id,service_id) do nothing;
  select coalesce(bool_or(s.requires_license),false),coalesce(bool_or(s.requires_insurance),false) into v_requires_license,v_requires_insurance
  from public.oc_application_service_matches m join public.oc_service_catalog s on s.id=m.service_id where m.application_id=v_app.id;
  insert into public.oc_provider_verification_checks(application_id,check_type,required) values
    (v_app.id,'identity',true),(v_app.id,'background',true),(v_app.id,'skills',true),(v_app.id,'service_area',true),
    (v_app.id,'license',v_requires_license),(v_app.id,'insurance',v_requires_insurance),(v_app.id,'vehicle',v_app.has_vehicle)
  on conflict(application_id,check_type) do update set required=excluded.required,updated_at=now();
end;$$;
revoke all on function private.oc_initialize_application_verification(uuid) from public,anon,authenticated;

create or replace function public.oc_initialize_application_verification_trigger()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$begin perform private.oc_initialize_application_verification(new.id); return new; end;$$;
revoke all on function public.oc_initialize_application_verification_trigger() from public,anon,authenticated;
drop trigger if exists oc_provider_application_verification_init on public.oc_provider_applications;
create trigger oc_provider_application_verification_init after insert or update of services_requested,has_vehicle on public.oc_provider_applications for each row execute function public.oc_initialize_application_verification_trigger();

do $$ declare r record; begin for r in select id from public.oc_provider_applications loop perform private.oc_initialize_application_verification(r.id); end loop; end $$;
