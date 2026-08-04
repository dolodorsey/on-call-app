create table if not exists public.oc_service_categories (
  id text primary key,
  name text not null,
  description text,
  icon_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_service_catalog (
  id text primary key,
  category_id text not null references public.oc_service_categories(id),
  name text not null unique,
  description text,
  base_price numeric(10,2) not null check (base_price >= 0),
  pricing_unit text not null default 'starting',
  duration_minutes integer,
  on_demand_available boolean not null default false,
  scheduled_available boolean not null default true,
  recurring_available boolean not null default false,
  icon_key text,
  image_url text,
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oc_provider_services (
  provider_id uuid not null references public.oc_provider_profiles(id) on delete cascade,
  service_id text not null references public.oc_service_catalog(id) on delete cascade,
  is_active boolean not null default true,
  price_override numeric(10,2),
  created_at timestamptz not null default now(),
  primary key(provider_id, service_id)
);

alter table public.oc_bookings add column if not exists service_id text references public.oc_service_catalog(id);
alter table public.oc_bookings add column if not exists request_type text not null default 'on_demand';
alter table public.oc_bookings add column if not exists recurring_rule text;
alter table public.oc_bookings add column if not exists pricing_unit text;
alter table public.oc_bookings add column if not exists duration_minutes integer;
alter table public.oc_bookings add column if not exists customer_notes text;

alter table public.oc_service_categories enable row level security;
alter table public.oc_service_catalog enable row level security;
alter table public.oc_provider_services enable row level security;

drop policy if exists oc_categories_public_read on public.oc_service_categories;
create policy oc_categories_public_read on public.oc_service_categories for select to anon, authenticated using (is_active);
drop policy if exists oc_catalog_public_read on public.oc_service_catalog;
create policy oc_catalog_public_read on public.oc_service_catalog for select to anon, authenticated using (is_active);
drop policy if exists oc_provider_services_provider_read on public.oc_provider_services;
create policy oc_provider_services_provider_read on public.oc_provider_services for select to authenticated using (
  provider_id in (
    select pp.id from public.oc_provider_profiles pp
    join public.oc_users u on u.id=pp.user_id
    where u.auth_id=auth.uid()
  )
);

grant select on public.oc_service_categories, public.oc_service_catalog to anon, authenticated;
grant select on public.oc_provider_services to authenticated;

insert into public.oc_service_categories(id,name,description,icon_key,sort_order) values
('home_care','Home Care','Cleaning, organization, laundry, and household upkeep','home',10),
('repairs','Repairs & Maintenance','Trusted repairs, installations, and preventative maintenance','tools',20),
('outdoor','Outdoor & Property','Lawn, landscaping, exterior cleaning, and seasonal care','leaf',30),
('auto','Auto & Mobile','Mobile vehicle care, diagnostics, detailing, and roadside support','car',40),
('moving','Moving & Delivery','Moving labor, hauling, delivery, assembly, and logistics','truck',50),
('personal','Personal Care','Mobile grooming, beauty, wardrobe, and personal assistance','sparkles',60),
('family_pet','Family & Pet','Childcare, elder assistance, pet care, and household help','heart',70),
('events','Events & Hospitality','Staffing, bartending, chefs, setup, cleanup, and guest service','glass',80),
('business','Business Support','Admin help, runners, merchandising, staffing, and operations','briefcase',90),
('tech','Tech & Installation','Wi-Fi, smart-home, TV mounting, device setup, and troubleshooting','wifi',100),
('wellness','Wellness & Fitness','Mobile massage, trainers, recovery, yoga, and wellness support','wellness',110),
('premium','Premium Concierge','White-glove lifestyle, household, travel, and urgent request management','crown',120)
on conflict(id) do update set name=excluded.name,description=excluded.description,icon_key=excluded.icon_key,sort_order=excluded.sort_order,is_active=true,updated_at=now();

create or replace function public.oc_request_catalog_service(
  p_service_id text,
  p_address text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_scheduled_at timestamptz default null,
  p_recurring_rule text default null,
  p_notes text default null
)
returns public.oc_bookings
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_customer public.oc_users%rowtype;
  v_service public.oc_service_catalog%rowtype;
  v_category public.oc_service_categories%rowtype;
  v_booking public.oc_bookings%rowtype;
  v_request_type text;
begin
  select * into v_customer from public.oc_users where auth_id=auth.uid() and role='customer' and status='active';
  if not found then raise exception 'Active customer account required' using errcode='42501'; end if;
  select * into v_service from public.oc_service_catalog where id=p_service_id and is_active;
  if not found then raise exception 'Selected service is unavailable'; end if;
  select * into v_category from public.oc_service_categories where id=v_service.category_id and is_active;
  if not found then raise exception 'Service category is unavailable'; end if;
  if coalesce(length(trim(p_address)),0)<3 then raise exception 'A service address is required'; end if;
  if p_lat is not null and (p_lat < -90 or p_lat > 90) then raise exception 'Invalid latitude'; end if;
  if p_lng is not null and (p_lng < -180 or p_lng > 180) then raise exception 'Invalid longitude'; end if;
  if p_recurring_rule is not null and not v_service.recurring_available then raise exception 'Recurring booking is unavailable for this service'; end if;
  if p_scheduled_at is null and not v_service.on_demand_available then raise exception 'This service must be scheduled'; end if;
  if p_scheduled_at is not null and not v_service.scheduled_available then raise exception 'Scheduled booking is unavailable for this service'; end if;
  v_request_type:=case when p_recurring_rule is not null then 'recurring' when p_scheduled_at is not null then 'scheduled' else 'on_demand' end;
  insert into public.oc_bookings(customer_id,service_id,service_name,category_name,status,address,lat,lng,total_price,scheduled_at,request_type,recurring_rule,pricing_unit,duration_minutes,customer_notes,notes)
  values(v_customer.id,v_service.id,v_service.name,v_category.name,'pending',trim(p_address),p_lat,p_lng,v_service.base_price,p_scheduled_at,v_request_type,p_recurring_rule,v_service.pricing_unit,v_service.duration_minutes,left(nullif(trim(p_notes),''),2000),left(nullif(trim(p_notes),''),2000))
  returning * into v_booking;
  return v_booking;
end;
$function$;

revoke all on function public.oc_request_catalog_service(text,text,double precision,double precision,timestamptz,text,text) from public;
grant execute on function public.oc_request_catalog_service(text,text,double precision,double precision,timestamptz,text,text) to authenticated;

create index if not exists oc_catalog_category_idx on public.oc_service_catalog(category_id,is_active,sort_order);
create index if not exists oc_bookings_service_idx on public.oc_bookings(service_id,created_at desc);

-- Seed `supabase/seeds/oc_service_catalog.csv` through the normal release seed step.
