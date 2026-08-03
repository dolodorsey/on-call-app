create sequence if not exists public.oc_provider_application_number_seq;

create table if not exists public.oc_provider_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique default ('OC-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.oc_provider_application_number_seq')::text,6,'0')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  state_code text not null,
  zip_code text,
  services_requested text[] not null,
  years_experience integer not null,
  experience_description text,
  has_vehicle boolean not null default false,
  vehicle_type text,
  background_check_consent boolean not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','approved','rejected','withdrawn')),
  source_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oc_provider_applications enable row level security;
revoke all on public.oc_provider_applications from public, anon, authenticated;
revoke all on sequence public.oc_provider_application_number_seq from public, anon, authenticated;
create index if not exists oc_provider_applications_email_created_idx on public.oc_provider_applications (lower(email), created_at desc);
create index if not exists oc_provider_applications_status_created_idx on public.oc_provider_applications (status, created_at desc);
