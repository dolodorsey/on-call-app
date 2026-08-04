-- Apply to the Kollective Gateway database after the live catalog snapshot.
-- Candidates remain prospects. A crosswalk never approves a provider.

drop view if exists public.oc_recruiting_service_coverage;
drop table if exists public.oc_recruiting_service_matches cascade;

create table public.oc_recruiting_service_matches (
  candidate_id uuid not null references public.oc_recruiting_candidates(id) on delete cascade,
  service_id text not null references public.oc_live_service_catalog_snapshot(id) on delete cascade,
  match_method text not null check (match_method in ('exact_name','approved_alias','manual')),
  confidence numeric not null check (confidence between 0 and 1),
  reviewed boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(candidate_id,service_id)
);

alter table public.oc_recruiting_service_matches enable row level security;
revoke all on public.oc_recruiting_service_matches from public,anon,authenticated;

create table if not exists public.oc_service_recruiting_aliases (
  source_category text not null,
  service_id text not null references public.oc_live_service_catalog_snapshot(id) on delete cascade,
  confidence numeric not null check (confidence between 0 and 1),
  rationale text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(source_category,service_id)
);

alter table public.oc_service_recruiting_aliases enable row level security;
revoke all on public.oc_service_recruiting_aliases from public,anon,authenticated;

insert into public.oc_service_recruiting_aliases(source_category,service_id,confidence,rationale)
values
('Mobile Detailing','mobile_detail',0.98,'Direct mobile detailing skill'),
('Mobile Ceramic Coating','mobile_detail',0.85,'Higher-skill detailing provider'),
('Battery Replacement','battery_replace',0.98,'Direct battery replacement skill'),
('Flat Tire Change','tire_help',0.98,'Direct roadside tire skill'),
('Mobile Tire Install','tire_help',0.90,'Mobile tire provider'),
('Domestic Mechanic','diagnostic',0.85,'Automotive diagnostic capability'),
('European Mechanic','diagnostic',0.85,'Automotive diagnostic capability'),
('Japanese/Korean Mechanic','diagnostic',0.85,'Automotive diagnostic capability'),
('Exotic Mechanic','diagnostic',0.85,'Automotive diagnostic capability'),
('Diesel Mechanic','diagnostic',0.80,'Automotive diagnostic capability'),
('Classic Car Mechanic','diagnostic',0.80,'Automotive diagnostic capability'),
('Move In/Out Cleaning','move_clean',0.98,'Direct move clean skill'),
('Deep Cleaning','deep_clean',0.98,'Direct deep cleaning skill'),
('Standard Cleaning','standard_clean',0.98,'Direct standard cleaning skill'),
('Muscle-Only Movers','moving_labor',0.98,'Direct moving labor skill'),
('Local Movers with Truck','moving_labor',0.90,'Moving labor and equipment'),
('Storage Pod Loading','moving_labor',0.95,'Loading labor skill'),
('Piano Movers','moving_labor',0.80,'Specialty moving labor'),
('Art & Antiques','moving_labor',0.80,'Specialty moving labor'),
('Junk Removal','junk_removal',0.98,'Direct junk removal skill'),
('Estate Cleanout','haul_dump',0.95,'Haul-away capability'),
('Hoarder Cleanout','haul_dump',0.90,'Haul-away capability'),
('Mowing & Maintenance','lawn_cut',0.95,'Lawn maintenance skill'),
('Landscape Design','landscaping',0.90,'Landscaping capability'),
('Mulch Delivery','landscaping',0.80,'Landscaping supply capability'),
('Sod Installation','landscaping',0.90,'Landscaping installation skill'),
('Hardscape/Patio','landscaping',0.80,'Outdoor construction capability'),
('Pressure Washing','pressure_wash',0.98,'Direct pressure washing skill'),
('Gutter Cleaning','gutter_clean',0.98,'Direct gutter cleaning skill'),
('Leaf Removal','snow_storm',0.90,'Seasonal cleanup skill'),
('Snow Removal','snow_storm',0.95,'Seasonal cleanup skill'),
('General Handyman','handyman',0.98,'Direct handyman skill'),
('Door Repair','handyman',0.85,'General repair provider'),
('Deck Repair','handyman',0.80,'General repair provider'),
('Shelving Install','handyman',0.90,'Handyman installation skill'),
('Caulk & Seal','handyman',0.90,'Handyman repair skill'),
('Paint Touch-Up','handyman',0.80,'Handyman finishing skill'),
('Window Repair','handyman',0.80,'General repair provider'),
('Emergency Plumber','plumbing',0.98,'Licensed plumbing skill'),
('Faucet & Fixture','plumbing',0.95,'Plumbing fixture skill'),
('Drain Cleaning','plumbing',0.95,'Plumbing drain skill'),
('Toilet Repair/Install','plumbing',0.95,'Plumbing fixture skill'),
('Water Heater Repair','plumbing',0.90,'Plumbing water-heater skill'),
('Gas Line Repair','plumbing',0.80,'Specialty licensed plumbing skill'),
('Sewer Camera Inspection','plumbing',0.85,'Specialty plumbing diagnostic skill'),
('Backflow Testing','plumbing',0.80,'Certified plumbing skill'),
('Emergency Electrician','electrician',0.98,'Licensed electrical skill'),
('Outlet & Switch','electrician',0.95,'Electrical fixture skill'),
('Panel Upgrade','electrician',0.90,'Licensed electrical skill'),
('Lighting Installation','electrician',0.95,'Electrical installation skill'),
('Generator Install','electrician',0.85,'Electrical installation skill'),
('EV Charger Install','electrician',0.90,'Electrical installation skill'),
('AC Repair','hvac',0.98,'Direct HVAC skill'),
('Emergency HVAC','hvac',0.98,'Direct HVAC skill'),
('Furnace Repair','hvac',0.95,'HVAC heating skill'),
('Mini Split Install','hvac',0.95,'HVAC installation skill'),
('Heat Pump','hvac',0.95,'HVAC heat-pump skill'),
('Duct Repair','hvac',0.85,'HVAC duct skill'),
('Refrigerator Repair','appliance',0.95,'Appliance repair skill'),
('Washer/Dryer','appliance',0.95,'Appliance repair skill'),
('Microwave','appliance',0.90,'Appliance repair skill'),
('Wine Cooler/Sub-Zero','appliance',0.90,'Specialty appliance repair skill'),
('BBQ/Grill Repair','appliance',0.75,'Appliance repair capability'),
('Furniture Assembly','furniture_assembly',0.98,'Direct assembly skill'),
('Home AV Install','tv_mount',0.80,'Home entertainment installation skill'),
('TV Mounting','tv_mount',0.98,'Direct TV mounting skill'),
('Security Camera Install','smart_home',0.85,'Smart-home installation skill'),
('Alarm System Install','smart_home',0.85,'Smart-home installation skill'),
('Home AV Install','smart_home',0.75,'Smart-home integration skill')
on conflict(source_category,service_id) do update set
  confidence=excluded.confidence,
  rationale=excluded.rationale,
  is_active=true;

insert into public.oc_recruiting_service_matches(candidate_id,service_id,match_method,confidence)
select c.id,s.id,'exact_name',0.99
from public.oc_recruiting_candidates c
join public.oc_live_service_catalog_snapshot s on s.is_active
where lower(regexp_replace(coalesce(c.primary_category,''),'[^a-z0-9]+','','g')) in (
  lower(regexp_replace(s.id,'[^a-z0-9]+','','g')),
  lower(regexp_replace(s.name,'[^a-z0-9]+','','g'))
)
on conflict(candidate_id,service_id) do nothing;

insert into public.oc_recruiting_service_matches(candidate_id,service_id,match_method,confidence)
select c.id,a.service_id,'approved_alias',a.confidence
from public.oc_recruiting_candidates c
join public.oc_service_recruiting_aliases a
  on lower(c.primary_category)=lower(a.source_category) and a.is_active
join public.oc_live_service_catalog_snapshot s on s.id=a.service_id and s.is_active
on conflict(candidate_id,service_id) do update set
  confidence=greatest(public.oc_recruiting_service_matches.confidence,excluded.confidence);

-- Remove qualifications created by the obsolete Gateway taxonomy.
update public.oc_recruiting_candidates
set pipeline_stage='prospect',outreach_status='queued',updated_at=now()
where pipeline_stage='qualified' and application_number is null;

-- Controlled first wave: five highest-priority Atlanta prospects per credibly matched live service.
with ranked as (
  select m.candidate_id,m.service_id,
         row_number() over(
           partition by m.service_id
           order by c.priority_score desc,c.source_review_count desc nulls last,c.id
         ) rn
  from public.oc_recruiting_service_matches m
  join public.oc_recruiting_candidates c on c.id=m.candidate_id
  where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80
), wave as (
  select distinct candidate_id from ranked where rn<=5
), sequenced as (
  select c.id,row_number() over(order by c.priority_score desc,c.id) seq
  from public.oc_recruiting_candidates c
  join wave w on w.candidate_id=c.id
)
update public.oc_recruiting_candidates c
set pipeline_stage='qualified',
    outreach_status='queued',
    next_action_at=now()+(s.seq-1)*interval '8 minutes',
    notes=concat_ws(E'\n',nullif(c.notes,''),
      'Mapped to the live 72-service catalog as a recruiting prospect. Human skill review, application and verification remain required.'),
    updated_at=now()
from sequenced s
where c.id=s.id;

create table if not exists public.oc_service_recruiting_tasks (
  service_id text primary key references public.oc_live_service_catalog_snapshot(id) on delete cascade,
  category_id text not null,
  service_name text not null,
  target_atlanta_candidates integer not null default 10,
  mapped_atlanta_candidates integer not null default 0,
  recruiting_gap integer not null default 10,
  status text not null default 'queued' check(status in ('queued','sourcing','review','covered','blocked')),
  sourcing_strategy text not null,
  priority smallint not null default 5 check(priority between 1 and 10),
  next_action_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oc_service_recruiting_tasks enable row level security;
revoke all on public.oc_service_recruiting_tasks from public,anon,authenticated;

insert into public.oc_service_recruiting_tasks(
  service_id,category_id,service_name,target_atlanta_candidates,mapped_atlanta_candidates,
  recruiting_gap,status,sourcing_strategy,priority,next_action_at
)
select s.id,s.category_id,s.name,10,
       count(distinct c.id) filter(where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80),
       greatest(10-count(distinct c.id) filter(where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80),0),
       case when count(distinct c.id) filter(where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80)>=10
            then 'covered' else 'queued' end,
       case s.category_id
         when 'auto' then 'Recruit mobile auto technicians, detailers and roadside specialists through trade shops and local operator directories.'
         when 'business' then 'Recruit insured independent operators through staffing networks, notary directories and event-business communities.'
         when 'events' then 'Recruit bartenders, servers, chefs and event crews through hospitality staffing communities.'
         when 'family_pet' then 'Recruit background-checked caregivers and pet professionals through licensed/local care networks.'
         when 'home_care' then 'Recruit insured cleaning and home-care operators through local service directories.'
         when 'moving' then 'Recruit insured movers, couriers and delivery operators with vehicle verification.'
         when 'outdoor' then 'Recruit insured lawn, landscaping and exterior-maintenance operators.'
         when 'personal' then 'Recruit licensed beauty and personal-service providers specifically for ON CALL; do not import LUXE accounts.'
         when 'premium' then 'Recruit experienced concierge and estate-support professionals with references.'
         when 'repairs' then 'Recruit licensed or insured trade providers with service-specific credential checks.'
         when 'tech' then 'Recruit mobile IT and installation providers with skills tests and equipment verification.'
         when 'wellness' then 'Recruit licensed or certified wellness professionals with insurance and credential verification.'
         else 'Source qualified local independent providers with service-specific verification.' end,
       case when count(distinct c.id) filter(where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80)=0 then 10
            when count(distinct c.id) filter(where lower(coalesce(c.city,''))='atlanta' and m.confidence>=0.80)<5 then 8
            else 6 end,
       now()
from public.oc_live_service_catalog_snapshot s
left join public.oc_recruiting_service_matches m on m.service_id=s.id
left join public.oc_recruiting_candidates c on c.id=m.candidate_id
where s.is_active
group by s.id,s.category_id,s.name
on conflict(service_id) do update set
  category_id=excluded.category_id,
  service_name=excluded.service_name,
  mapped_atlanta_candidates=excluded.mapped_atlanta_candidates,
  recruiting_gap=excluded.recruiting_gap,
  status=excluded.status,
  sourcing_strategy=excluded.sourcing_strategy,
  priority=excluded.priority,
  next_action_at=excluded.next_action_at,
  updated_at=now();

create or replace view public.oc_recruiting_service_coverage
with (security_invoker=true)
as
select s.id service_id,s.name service_name,s.category_id,
       count(distinct m.candidate_id)::integer mapped_candidates,
       count(distinct m.candidate_id) filter(where lower(coalesce(c.city,''))='atlanta')::integer atlanta_candidates,
       count(distinct m.candidate_id) filter(where c.pipeline_stage='qualified')::integer qualified_candidates,
       t.target_atlanta_candidates,t.recruiting_gap,t.status recruiting_status,t.priority
from public.oc_live_service_catalog_snapshot s
left join public.oc_recruiting_service_matches m on m.service_id=s.id
left join public.oc_recruiting_candidates c on c.id=m.candidate_id
left join public.oc_service_recruiting_tasks t on t.service_id=s.id
where s.is_active
group by s.id,s.name,s.category_id,
  t.target_atlanta_candidates,t.recruiting_gap,t.status,t.priority;

revoke all on public.oc_recruiting_service_coverage from public,anon,authenticated;

create index if not exists oc_live_recruiting_matches_service_idx
  on public.oc_recruiting_service_matches(service_id,confidence desc,reviewed);
create index if not exists oc_service_recruiting_tasks_queue_idx
  on public.oc_service_recruiting_tasks(status,priority desc,next_action_at);
