-- ON CALL home-services marketplace foundation
-- Generated 2026-07-10. Apply in a Supabase development branch first.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.oc_current_user_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.oc_users where auth_id = auth.uid() limit 1
$$;

create or replace function public.oc_current_provider_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select p.id
  from public.oc_provider_profiles p
  join public.oc_users u on u.id = p.user_id
  where u.auth_id = auth.uid()
  limit 1
$$;

revoke all on function public.oc_current_user_id() from public, anon;
revoke all on function public.oc_current_provider_id() from public, anon;
grant execute on function public.oc_current_user_id() to authenticated;
grant execute on function public.oc_current_provider_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Expand the existing booking record into a real job state machine.
-- ---------------------------------------------------------------------------
alter table public.oc_bookings add column if not exists service_id uuid;
alter table public.oc_bookings add column if not exists booking_type text default 'on_demand';
alter table public.oc_bookings add column if not exists estimated_price numeric(12,2);
alter table public.oc_bookings add column if not exists final_price numeric(12,2);
alter table public.oc_bookings add column if not exists platform_fee numeric(12,2);
alter table public.oc_bookings add column if not exists provider_payout numeric(12,2);
alter table public.oc_bookings add column if not exists matched_at timestamptz;
alter table public.oc_bookings add column if not exists accepted_at timestamptz;
alter table public.oc_bookings add column if not exists en_route_at timestamptz;
alter table public.oc_bookings add column if not exists arrived_at timestamptz;
alter table public.oc_bookings add column if not exists started_at timestamptz;
alter table public.oc_bookings add column if not exists cancel_reason text;
alter table public.oc_bookings add column if not exists canceled_by text;
alter table public.oc_bookings add column if not exists version integer not null default 1;

update public.oc_bookings
set estimated_price = coalesce(estimated_price, total_price),
    booking_type = coalesce(booking_type, case when scheduled_at is null then 'on_demand' else 'scheduled' end)
where estimated_price is null or booking_type is null;

-- ---------------------------------------------------------------------------
-- Canonical home-services catalog. Beauty/cosmetic work belongs in LUXE.
-- ---------------------------------------------------------------------------
create table if not exists public.oc_service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.oc_service_categories(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  pricing_model text not null default 'fixed' check (pricing_model in ('fixed','hourly','quote')),
  base_price numeric(12,2),
  minimum_price numeric(12,2),
  duration_minutes integer,
  required_credentials text[] not null default '{}',
  required_tools text[] not null default '{}',
  emergency_eligible boolean not null default false,
  scheduled_eligible boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.oc_provider_profiles(id) on delete cascade,
  service_id uuid not null references public.oc_services(id) on delete cascade,
  custom_price numeric(12,2),
  hourly_rate numeric(12,2),
  approval_status text not null default 'pending',
  credentials jsonb not null default '{}'::jsonb,
  tools_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, service_id)
);

create table if not exists public.oc_provider_locations (
  provider_id uuid primary key references public.oc_provider_profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  accuracy_meters double precision,
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_booking_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.oc_bookings(id) on delete cascade,
  provider_id uuid not null references public.oc_provider_profiles(id) on delete cascade,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','canceled')),
  score numeric(10,2),
  distance_miles numeric(10,2),
  eta_minutes integer,
  payout_amount numeric(12,2),
  offered_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  decline_reason text,
  unique(booking_id, provider_id)
);

create table if not exists public.oc_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.oc_bookings(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_user_id uuid references public.oc_users(id) on delete set null,
  actor_type text,
  metadata jsonb not null default '{}'::jsonb,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.oc_job_media (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.oc_bookings(id) on delete cascade,
  uploaded_by uuid not null references public.oc_users(id) on delete restrict,
  media_type text not null check (media_type in ('before','after','issue','receipt','document','other')),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.oc_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.oc_bookings(id) on delete restrict,
  customer_id uuid not null references public.oc_users(id) on delete restrict,
  provider_id uuid references public.oc_provider_profiles(id) on delete restrict,
  amount numeric(12,2) not null,
  platform_fee numeric(12,2) not null default 0,
  provider_payout numeric(12,2) not null default 0,
  tip numeric(12,2) not null default 0,
  refund_amount numeric(12,2) not null default 0,
  status text not null default 'requires_payment_method',
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.oc_provider_profiles(id) on delete restrict,
  booking_id uuid references public.oc_bookings(id) on delete restrict,
  amount numeric(12,2) not null,
  status text not null default 'pending',
  stripe_transfer_id text,
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.oc_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.oc_bookings(id) on delete restrict,
  opened_by uuid not null references public.oc_users(id) on delete restrict,
  reason text not null,
  description text,
  evidence_paths text[] not null default '{}',
  status text not null default 'open',
  resolution text,
  refund_amount numeric(12,2),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.oc_safety_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.oc_bookings(id) on delete set null,
  reported_by uuid not null references public.oc_users(id) on delete restrict,
  event_type text not null,
  description text,
  lat double precision,
  lng double precision,
  status text not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.oc_integration_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  requested_by uuid references public.oc_users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','dead_letter')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oc_bookings_status_created_idx on public.oc_bookings(status, created_at desc);
create index if not exists oc_booking_offers_provider_idx on public.oc_booking_offers(provider_id, status, expires_at);
create index if not exists oc_booking_events_booking_idx on public.oc_booking_events(booking_id, created_at);
create index if not exists oc_provider_services_service_idx on public.oc_provider_services(service_id, approval_status, is_active);
create index if not exists oc_provider_locations_online_idx on public.oc_provider_locations(is_online, updated_at desc);
create index if not exists oc_integration_events_delivery_idx on public.oc_integration_events(status, next_attempt_at);

-- ---------------------------------------------------------------------------
-- Seed the initial home-services-only catalog.
-- ---------------------------------------------------------------------------
insert into public.oc_service_categories (slug, name, description, icon, sort_order)
values
  ('cleaning','Cleaning','Residential cleaning and turnover services','🧹',10),
  ('handyman','Handyman','Repairs, mounting, assembly and installation','🔧',20),
  ('plumbing','Plumbing','Leaks, drains, fixtures and diagnostics','🚿',30),
  ('electrical','Electrical','Residential electrical diagnostics and installation','⚡',40),
  ('hvac','HVAC','Heating and cooling diagnostics, repair and maintenance','❄️',50),
  ('appliances','Appliances','Appliance installation, setup and repair','🧰',60),
  ('exterior','Exterior & Yard','Lawn, pressure washing, junk and exterior work','🌿',70),
  ('moving','Moving & Assembly','Local moving, heavy lifting and furniture assembly','📦',80)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

with category_map as (
  select id, slug from public.oc_service_categories
)
insert into public.oc_services
  (category_id, slug, name, description, pricing_model, base_price, minimum_price, duration_minutes, required_credentials, required_tools, emergency_eligible, sort_order)
select c.id, seed.slug, seed.name, seed.description, seed.pricing_model, seed.base_price, seed.minimum_price, seed.duration_minutes, seed.required_credentials, seed.required_tools, seed.emergency_eligible, seed.sort_order
from category_map c
join (values
  ('cleaning','standard-clean','Standard Cleaning','Routine residential cleaning','fixed',95.00,95.00,120,'{}'::text[],'{cleaning_supplies}'::text[],false,10),
  ('cleaning','deep-clean','Deep Cleaning','Detailed top-to-bottom residential cleaning','fixed',165.00,165.00,240,'{}'::text[],'{cleaning_supplies}'::text[],false,20),
  ('cleaning','move-clean','Move In / Move Out Cleaning','Vacant-home turnover cleaning','quote',null,195.00,300,'{}'::text[],'{cleaning_supplies}'::text[],false,30),
  ('handyman','general-handyman','General Handyman','Minor repairs and household projects','hourly',85.00,85.00,60,'{}'::text[],'{basic_hand_tools}'::text[],false,10),
  ('handyman','tv-mounting','TV Mounting','Wall mounting with cable management options','fixed',125.00,125.00,90,'{}'::text[],'{stud_finder,drill,level}'::text[],false,20),
  ('handyman','furniture-assembly','Furniture Assembly','Assembly of flat-pack and home furniture','hourly',75.00,75.00,90,'{}'::text[],'{basic_hand_tools}'::text[],false,30),
  ('plumbing','plumbing-diagnostic','Plumbing Diagnostic','Leak, pressure and fixture diagnosis','fixed',119.00,119.00,60,'{plumbing_license_if_required}'::text[],'{plumbing_tools}'::text[],true,10),
  ('plumbing','drain-clearing','Drain Clearing','Residential sink, tub and shower drain clearing','fixed',149.00,149.00,90,'{plumbing_license_if_required}'::text[],'{drain_equipment}'::text[],true,20),
  ('electrical','electrical-diagnostic','Electrical Diagnostic','Residential outlet, breaker and fixture diagnosis','fixed',129.00,129.00,60,'{electrical_license_if_required}'::text[],'{electrical_meter,insulated_tools}'::text[],true,10),
  ('electrical','light-fixture-install','Light Fixture Installation','Replace or install a standard light fixture','fixed',145.00,145.00,90,'{electrical_license_if_required}'::text[],'{electrical_meter,insulated_tools,ladder}'::text[],false,20),
  ('hvac','hvac-diagnostic','HVAC Diagnostic','Heating or cooling system diagnosis','fixed',139.00,139.00,75,'{hvac_license_if_required}'::text[],'{hvac_diagnostic_tools}'::text[],true,10),
  ('hvac','hvac-maintenance','HVAC Maintenance','Seasonal inspection and preventive maintenance','fixed',169.00,169.00,120,'{hvac_license_if_required}'::text[],'{hvac_diagnostic_tools}'::text[],false,20),
  ('appliances','appliance-install','Appliance Installation','Install washer, dryer or dishwasher','fixed',159.00,159.00,120,'{trade_license_if_required}'::text[],'{appliance_install_tools}'::text[],false,10),
  ('appliances','appliance-diagnostic','Appliance Diagnostic','In-home appliance fault diagnosis','fixed',109.00,109.00,60,'{}'::text[],'{diagnostic_tools}'::text[],false,20),
  ('exterior','lawn-service','Lawn Service','Mowing, edging and cleanup','fixed',65.00,65.00,75,'{}'::text[],'{mower,trimmer,blower}'::text[],false,10),
  ('exterior','pressure-washing','Pressure Washing','Driveway, patio or exterior surface washing','quote',null,150.00,180,'{}'::text[],'{pressure_washer}'::text[],false,20),
  ('exterior','junk-removal','Junk Removal','Household junk pickup and responsible disposal','quote',null,125.00,120,'{commercial_auto_if_required}'::text[],'{truck,hand_truck}'::text[],false,30),
  ('moving','local-moving-help','Local Moving Help','Labor for loading, unloading and local moves','hourly',95.00,190.00,120,'{commercial_auto_if_required}'::text[],'{moving_dollies,straps,blankets}'::text[],false,10)
) as seed(category_slug, slug, name, description, pricing_model, base_price, minimum_price, duration_minutes, required_credentials, required_tools, emergency_eligible, sort_order)
  on seed.category_slug = c.slug
on conflict (slug) do update
set category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    pricing_model = excluded.pricing_model,
    base_price = excluded.base_price,
    minimum_price = excluded.minimum_price,
    duration_minutes = excluded.duration_minutes,
    required_credentials = excluded.required_credentials,
    required_tools = excluded.required_tools,
    emergency_eligible = excluded.emergency_eligible,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.oc_service_categories enable row level security;
alter table public.oc_services enable row level security;
alter table public.oc_provider_services enable row level security;
alter table public.oc_provider_locations enable row level security;
alter table public.oc_booking_offers enable row level security;
alter table public.oc_booking_events enable row level security;
alter table public.oc_job_media enable row level security;
alter table public.oc_payments enable row level security;
alter table public.oc_payouts enable row level security;
alter table public.oc_disputes enable row level security;
alter table public.oc_safety_events enable row level security;
alter table public.oc_integration_events enable row level security;

drop policy if exists "Public read active OC categories" on public.oc_service_categories;
create policy "Public read active OC categories" on public.oc_service_categories
for select to anon, authenticated using (is_active);

drop policy if exists "Public read active OC services" on public.oc_services;
create policy "Public read active OC services" on public.oc_services
for select to anon, authenticated using (is_active);

drop policy if exists "Providers manage own OC services" on public.oc_provider_services;
create policy "Providers manage own OC services" on public.oc_provider_services
for all to authenticated
using (provider_id = public.oc_current_provider_id())
with check (provider_id = public.oc_current_provider_id());

drop policy if exists "Authenticated read approved OC provider services" on public.oc_provider_services;
create policy "Authenticated read approved OC provider services" on public.oc_provider_services
for select to authenticated
using (is_active and approval_status in ('approved','verified'));

drop policy if exists "Providers manage own OC location" on public.oc_provider_locations;
create policy "Providers manage own OC location" on public.oc_provider_locations
for all to authenticated
using (provider_id = public.oc_current_provider_id())
with check (provider_id = public.oc_current_provider_id());

drop policy if exists "Booking participants read OC offers" on public.oc_booking_offers;
create policy "Booking participants read OC offers" on public.oc_booking_offers
for select to authenticated
using (
  provider_id = public.oc_current_provider_id()
  or exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id and b.customer_id = public.oc_current_user_id()
  )
);

drop policy if exists "Booking participants read OC events" on public.oc_booking_events;
create policy "Booking participants read OC events" on public.oc_booking_events
for select to authenticated
using (
  exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants read OC media" on public.oc_job_media;
create policy "Booking participants read OC media" on public.oc_job_media
for select to authenticated
using (
  exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants upload OC media" on public.oc_job_media;
create policy "Booking participants upload OC media" on public.oc_job_media
for insert to authenticated
with check (
  uploaded_by = public.oc_current_user_id()
  and exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants read OC payments" on public.oc_payments;
create policy "Booking participants read OC payments" on public.oc_payments
for select to authenticated
using (
  customer_id = public.oc_current_user_id()
  or provider_id = public.oc_current_provider_id()
);

drop policy if exists "Providers read own OC payouts" on public.oc_payouts;
create policy "Providers read own OC payouts" on public.oc_payouts
for select to authenticated
using (provider_id = public.oc_current_provider_id());

drop policy if exists "Booking participants read OC disputes" on public.oc_disputes;
create policy "Booking participants read OC disputes" on public.oc_disputes
for select to authenticated
using (
  exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants open OC disputes" on public.oc_disputes;
create policy "Booking participants open OC disputes" on public.oc_disputes
for insert to authenticated
with check (
  opened_by = public.oc_current_user_id()
  and exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants read OC safety events" on public.oc_safety_events;
create policy "Booking participants read OC safety events" on public.oc_safety_events
for select to authenticated
using (
  reported_by = public.oc_current_user_id()
  or exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Users report OC safety events" on public.oc_safety_events;
create policy "Users report OC safety events" on public.oc_safety_events
for insert to authenticated
with check (reported_by = public.oc_current_user_id());

-- Assigned providers can see and update their active bookings.
drop policy if exists "Providers see assigned OC bookings" on public.oc_bookings;
create policy "Providers see assigned OC bookings" on public.oc_bookings
for select to authenticated
using (provider_id = public.oc_current_provider_id());

drop policy if exists "Providers update assigned OC bookings" on public.oc_bookings;
create policy "Providers update assigned OC bookings" on public.oc_bookings
for update to authenticated
using (provider_id = public.oc_current_provider_id())
with check (provider_id = public.oc_current_provider_id());

-- Assignment and integration queues are RPC-only.
revoke insert, update, delete on public.oc_booking_offers from anon, authenticated;
revoke insert, update, delete on public.oc_booking_events from anon, authenticated;
revoke all on public.oc_integration_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dispatch and atomic acceptance
-- ---------------------------------------------------------------------------
create or replace function public.oc_dispatch_booking(
  p_booking_id uuid,
  p_radius_miles double precision default 20,
  p_offer_ttl_seconds integer default 60
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.oc_bookings%rowtype;
  v_count integer := 0;
begin
  select * into v_booking
  from public.oc_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if auth.role() <> 'service_role' and v_booking.customer_id <> public.oc_current_user_id() then
    raise exception 'Not authorized for booking' using errcode = '42501';
  end if;

  if v_booking.provider_id is not null or v_booking.status not in ('pending','requested','matching') then
    raise exception 'Booking cannot be dispatched from status %', v_booking.status;
  end if;

  if v_booking.lat is null or v_booking.lng is null then
    raise exception 'Booking requires latitude and longitude for on-demand dispatch';
  end if;

  update public.oc_bookings
  set status = 'matching', updated_at = now(), version = version + 1
  where id = p_booking_id;

  with candidates as (
    select
      p.id as provider_id,
      round((3959 * acos(least(1, greatest(-1,
        cos(radians(v_booking.lat)) * cos(radians(l.lat)) *
        cos(radians(l.lng) - radians(v_booking.lng)) +
        sin(radians(v_booking.lat)) * sin(radians(l.lat))
      ))))::numeric, 2) as distance_miles,
      p.rating,
      coalesce(ps.custom_price, s.base_price, s.minimum_price, v_booking.total_price, 0) as service_price
    from public.oc_provider_profiles p
    join public.oc_provider_services ps on ps.provider_id = p.id
    join public.oc_services s on s.id = ps.service_id
    join public.oc_provider_locations l on l.provider_id = p.id
    where ps.service_id = v_booking.service_id
      and ps.is_active
      and ps.approval_status in ('approved','verified')
      and p.is_available
      and p.background_check_status in ('approved','cleared','verified')
      and l.is_online
      and l.updated_at > now() - interval '5 minutes'
  ), eligible as (
    select * from candidates
    where distance_miles <= greatest(1, least(p_radius_miles, 50))
    order by distance_miles asc, rating desc nulls last
    limit 20
  )
  insert into public.oc_booking_offers
    (booking_id, provider_id, status, score, distance_miles, eta_minutes, payout_amount, offered_at, expires_at)
  select
    p_booking_id,
    e.provider_id,
    'offered',
    greatest(0, 100 - (e.distance_miles * 2) + (coalesce(e.rating, 0) * 5)),
    e.distance_miles,
    greatest(5, ceil(e.distance_miles * 3)::integer),
    round(e.service_price * 0.75, 2),
    now(),
    now() + make_interval(secs => greatest(20, least(p_offer_ttl_seconds, 180)))
  from eligible e
  on conflict (booking_id, provider_id) do update
  set status = 'offered',
      score = excluded.score,
      distance_miles = excluded.distance_miles,
      eta_minutes = excluded.eta_minutes,
      payout_amount = excluded.payout_amount,
      offered_at = excluded.offered_at,
      expires_at = excluded.expires_at,
      responded_at = null,
      decline_reason = null;

  get diagnostics v_count = row_count;

  insert into public.oc_booking_events
    (booking_id, event_type, old_status, new_status, actor_user_id, actor_type, metadata)
  values
    (p_booking_id, 'dispatch_started', v_booking.status, 'matching',
     case when auth.role() = 'service_role' then null else public.oc_current_user_id() end,
     case when auth.role() = 'service_role' then 'system' else 'customer' end,
     jsonb_build_object('offers_created', v_count, 'radius_miles', p_radius_miles));

  return v_count;
end;
$$;

create or replace function public.oc_accept_booking_offer(p_offer_id uuid)
returns setof public.oc_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.oc_booking_offers%rowtype;
  v_booking public.oc_bookings%rowtype;
  v_provider_id uuid := public.oc_current_provider_id();
begin
  if auth.uid() is null or v_provider_id is null then
    raise exception 'Authenticated provider required' using errcode = '42501';
  end if;

  select * into v_offer
  from public.oc_booking_offers
  where id = p_offer_id
  for update;

  if not found or v_offer.provider_id <> v_provider_id then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'offered' then
    raise exception 'Offer is no longer available';
  end if;

  if v_offer.expires_at is not null and v_offer.expires_at <= now() then
    update public.oc_booking_offers set status = 'expired', responded_at = now() where id = p_offer_id;
    raise exception 'Offer expired';
  end if;

  select * into v_booking
  from public.oc_bookings
  where id = v_offer.booking_id
  for update;

  if v_booking.provider_id is not null or v_booking.status not in ('pending','requested','matching') then
    update public.oc_booking_offers set status = 'expired', responded_at = now() where id = p_offer_id;
    raise exception 'Booking already assigned';
  end if;

  update public.oc_booking_offers
  set status = 'accepted', responded_at = now()
  where id = p_offer_id;

  update public.oc_booking_offers
  set status = 'expired', responded_at = coalesce(responded_at, now())
  where booking_id = v_offer.booking_id and id <> p_offer_id and status = 'offered';

  update public.oc_bookings
  set provider_id = v_provider_id,
      status = 'accepted',
      matched_at = coalesce(matched_at, now()),
      accepted_at = now(),
      provider_payout = v_offer.payout_amount,
      updated_at = now(),
      version = version + 1
  where id = v_offer.booking_id;

  insert into public.oc_booking_events
    (booking_id, event_type, old_status, new_status, actor_user_id, actor_type, metadata)
  values
    (v_offer.booking_id, 'offer_accepted', v_booking.status, 'accepted',
     public.oc_current_user_id(), 'provider',
     jsonb_build_object('offer_id', p_offer_id, 'provider_id', v_provider_id));

  return query select * from public.oc_bookings where id = v_offer.booking_id;
end;
$$;

create or replace function public.oc_decline_booking_offer(p_offer_id uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := public.oc_current_provider_id();
  v_updated integer;
begin
  if auth.uid() is null or v_provider_id is null then
    raise exception 'Authenticated provider required' using errcode = '42501';
  end if;

  update public.oc_booking_offers
  set status = 'declined', responded_at = now(), decline_reason = nullif(trim(p_reason), '')
  where id = p_offer_id and provider_id = v_provider_id and status = 'offered';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.oc_update_provider_location(
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_accuracy_meters double precision default null,
  p_is_online boolean default true
)
returns public.oc_provider_locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid := public.oc_current_provider_id();
  v_location public.oc_provider_locations%rowtype;
begin
  if auth.uid() is null or v_provider_id is null then
    raise exception 'Authenticated provider required' using errcode = '42501';
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into public.oc_provider_locations
    (provider_id, lat, lng, heading, accuracy_meters, is_online, updated_at)
  values
    (v_provider_id, p_lat, p_lng, p_heading, p_accuracy_meters, p_is_online, now())
  on conflict (provider_id) do update
  set lat = excluded.lat,
      lng = excluded.lng,
      heading = excluded.heading,
      accuracy_meters = excluded.accuracy_meters,
      is_online = excluded.is_online,
      updated_at = now()
  returning * into v_location;

  update public.oc_provider_profiles
  set is_available = p_is_online, updated_at = now()
  where id = v_provider_id;

  return v_location;
end;
$$;

create or replace function public.oc_enqueue_integration_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_type is null or length(trim(p_event_type)) < 3 then
    raise exception 'event_type is required';
  end if;

  if pg_column_size(coalesce(p_payload, '{}'::jsonb)) > 65536 then
    raise exception 'Integration payload exceeds 64 KB';
  end if;

  insert into public.oc_integration_events
    (event_type, aggregate_type, aggregate_id, requested_by, payload)
  values
    (trim(p_event_type), nullif(trim(p_aggregate_type), ''), p_aggregate_id,
     public.oc_current_user_id(), coalesce(p_payload, '{}'::jsonb))
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.oc_dispatch_booking(uuid, double precision, integer) from public, anon;
revoke all on function public.oc_accept_booking_offer(uuid) from public, anon;
revoke all on function public.oc_decline_booking_offer(uuid, text) from public, anon;
revoke all on function public.oc_update_provider_location(double precision, double precision, double precision, double precision, boolean) from public, anon;
revoke all on function public.oc_enqueue_integration_event(text, text, uuid, jsonb) from public, anon;
grant execute on function public.oc_dispatch_booking(uuid, double precision, integer) to authenticated;
grant execute on function public.oc_accept_booking_offer(uuid) to authenticated;
grant execute on function public.oc_decline_booking_offer(uuid, text) to authenticated;
grant execute on function public.oc_update_provider_location(double precision, double precision, double precision, double precision, boolean) to authenticated;
grant execute on function public.oc_enqueue_integration_event(text, text, uuid, jsonb) to authenticated;

-- Remove dangerous direct RPC access and stop auto-confirming new accounts.
create or replace function public.oc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.oc_users (auth_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
exception when others then
  raise warning 'oc_handle_new_user failed for %: % [%]', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;
revoke all on function public.oc_handle_new_user() from public, anon, authenticated;

commit;
