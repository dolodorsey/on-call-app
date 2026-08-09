-- Approval opens Provider Command. This migration makes reviewed verification + payout readiness govern actual dispatch.
alter table public.oc_provider_profiles add column if not exists provider_application_id uuid references public.oc_provider_applications(id) on delete set null;
create index if not exists oc_provider_profiles_application_idx on public.oc_provider_profiles(provider_application_id);

create or replace function private.oc_provider_core_dispatch_ready(p_provider_id uuid)
returns boolean language sql stable security definer set search_path='pg_catalog','public','private' as $$
  select coalesce((select u.role='provider' and u.status='active' and p.approval_status='active'
    and p.stripe_onboarding_complete and p.stripe_payouts_enabled and a.status='approved'
    and not exists(select 1 from public.oc_provider_verification_checks v where v.application_id=a.id and v.required and v.check_type in ('identity','background','skills','service_area') and v.status<>'passed')
    and not exists(select 1 from public.oc_provider_verification_checks v where v.application_id=a.id and v.required and v.check_type='vehicle' and v.status not in ('passed','waived'))
  from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id join public.oc_provider_applications a on a.id=p.provider_application_id where p.id=p_provider_id),false)
$$;
revoke all on function private.oc_provider_core_dispatch_ready(uuid) from public,anon,authenticated;

create or replace function private.oc_provider_service_dispatch_ready(p_provider_id uuid,p_service_id text)
returns boolean language sql stable security definer set search_path='pg_catalog','public','private' as $$
  select private.oc_provider_core_dispatch_ready(p_provider_id) and coalesce((
    select ps.is_active and s.is_active
      and (not s.requires_license or exists(select 1 from public.oc_provider_verification_checks v where v.application_id=p.provider_application_id and v.check_type='license' and v.status in ('passed','waived')))
      and (not s.requires_insurance or exists(select 1 from public.oc_provider_verification_checks v where v.application_id=p.provider_application_id and v.check_type='insurance' and v.status in ('passed','waived')))
    from public.oc_provider_services ps join public.oc_service_catalog s on s.id=ps.service_id join public.oc_provider_profiles p on p.id=ps.provider_id
    where ps.provider_id=p_provider_id and ps.service_id=p_service_id),false)
$$;
revoke all on function private.oc_provider_service_dispatch_ready(uuid,text) from public,anon,authenticated;

create or replace function public.oc_ops_provider_verifications()
returns table(application_id uuid,application_number text,provider_id uuid,first_name text,last_name text,email text,check_type text,required boolean,status text,evidence_urls text[],notes text,reviewed_at timestamptz,profile_value boolean)
language sql security definer set search_path='pg_catalog','public','private' as $$
 select a.id,a.application_number,p.id,a.first_name,a.last_name,a.email,v.check_type,v.required,v.status,v.evidence_urls,v.notes,v.reviewed_at,
   case v.check_type when 'identity' then p.identity_verified when 'background' then p.background_check_status='passed' when 'license' then p.license_verified when 'insurance' then p.insurance_verified when 'service_area' then p.service_area_verified else null end
 from public.oc_provider_applications a join public.oc_provider_verification_checks v on v.application_id=a.id left join public.oc_provider_profiles p on p.provider_application_id=a.id
 where private.is_marketplace_operator(auth.uid()) order by case a.status when 'approved' then 0 when 'reviewing' then 1 else 2 end,a.created_at,v.check_type
$$;
revoke all on function public.oc_ops_provider_verifications() from public,anon; grant execute on function public.oc_ops_provider_verifications() to authenticated;

create or replace function public.oc_ops_review_provider_verification(p_application_id uuid,p_check_type text,p_status text,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_check public.oc_provider_verification_checks%rowtype; v_provider_id uuid;
begin
 if auth.uid() is null or not private.is_marketplace_operator(auth.uid()) then raise exception 'Marketplace operator access required' using errcode='42501'; end if;
 if p_status not in ('pending','submitted','under_review','passed','failed','waived','expired') then raise exception 'Invalid verification status'; end if;
 if p_check_type not in ('identity','background','license','insurance','skills','service_area','vehicle') then raise exception 'Invalid verification check'; end if;
 if p_status='waived' and p_check_type in ('identity','background','skills','service_area') then raise exception 'Core safety verification cannot be waived'; end if;
 update public.oc_provider_verification_checks set status=p_status,notes=nullif(left(trim(coalesce(p_notes,'')),2000),''),reviewed_by=auth.uid(),reviewed_at=case when p_status in ('passed','failed','waived','expired') then now() else reviewed_at end,updated_at=now()
 where application_id=p_application_id and check_type=p_check_type returning * into v_check;
 if not found then raise exception 'Verification check not found'; end if;
 select id into v_provider_id from public.oc_provider_profiles where provider_application_id=p_application_id limit 1;
 if v_provider_id is not null then
   update public.oc_provider_profiles set
    identity_verified=case when p_check_type='identity' then p_status='passed' else identity_verified end,
    background_check_status=case when p_check_type='background' then case when p_status='passed' then 'passed' when p_status='failed' then 'failed' else 'pending' end else background_check_status end,
    license_verified=case when p_check_type='license' then p_status in ('passed','waived') else license_verified end,
    insurance_verified=case when p_check_type='insurance' then p_status in ('passed','waived') else insurance_verified end,
    service_area_verified=case when p_check_type='service_area' then p_status='passed' else service_area_verified end,
    is_available=case when p_status in ('failed','expired') and v_check.required then false else is_available end,updated_at=now()
   where id=v_provider_id;
 end if;
 return jsonb_build_object('application_id',p_application_id,'check_type',p_check_type,'required',v_check.required,'status',p_status,'provider_id',v_provider_id,'core_dispatch_ready',case when v_provider_id is null then false else private.oc_provider_core_dispatch_ready(v_provider_id) end);
end;$$;
revoke all on function public.oc_ops_review_provider_verification(uuid,text,text,text) from public,anon; grant execute on function public.oc_ops_review_provider_verification(uuid,text,text,text) to authenticated;

create or replace function public.oc_provider_activate_approved_application()
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_user public.oc_users%rowtype; v_app public.oc_provider_applications%rowtype; v_provider_id uuid; v_bg text:='pending'; v_identity boolean:=false; v_license boolean:=false; v_insurance boolean:=false; v_area boolean:=false;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_user from public.oc_users where auth_id=auth.uid() limit 1; if not found then raise exception 'ON CALL account not found' using errcode='P0002'; end if;
 select * into v_app from public.oc_provider_applications where lower(email)=lower(coalesce(v_user.email,'')) order by created_at desc limit 1 for update;
 if not found then raise exception 'Submit a provider application first' using errcode='P0002'; end if;
 if v_app.status<>'approved' then return jsonb_build_object('activated',false,'application_number',v_app.application_number,'application_status',v_app.status); end if;
 perform private.oc_initialize_application_verification(v_app.id);
 select case when status in ('passed','waived') then 'passed' when status='failed' then 'failed' else 'pending' end into v_bg from public.oc_provider_verification_checks where application_id=v_app.id and check_type='background';
 select coalesce(bool_or(status in ('passed','waived')) filter(where check_type='identity'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='license'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='insurance'),false),coalesce(bool_or(status in ('passed','waived')) filter(where check_type='service_area'),false)
 into v_identity,v_license,v_insurance,v_area from public.oc_provider_verification_checks where application_id=v_app.id;
 update public.oc_users set role='provider',first_name=coalesce(nullif(v_app.first_name,''),first_name),last_name=coalesce(nullif(v_app.last_name,''),last_name),full_name=trim(concat(v_app.first_name,' ',v_app.last_name)),phone=coalesce(nullif(v_app.phone,''),phone),city=coalesce(nullif(v_app.city,''),city),state_code=coalesce(nullif(v_app.state_code,''),state_code),updated_at=now() where id=v_user.id;
 insert into public.oc_provider_profiles(user_id,provider_application_id,skills,service_area_radius,is_available,background_check_status,approval_status,identity_verified,license_verified,insurance_verified,service_area_verified,vehicle_type,activated_at,updated_at)
 values(v_user.id,v_app.id,coalesce(v_app.services_requested,'{}'::text[]),25,false,coalesce(v_bg,'pending'),'active',v_identity,v_license,v_insurance,v_area,v_app.vehicle_type,now(),now())
 on conflict(user_id) do update set provider_application_id=excluded.provider_application_id,skills=excluded.skills,background_check_status=excluded.background_check_status,approval_status='active',identity_verified=excluded.identity_verified,license_verified=excluded.license_verified,insurance_verified=excluded.insurance_verified,service_area_verified=excluded.service_area_verified,vehicle_type=coalesce(excluded.vehicle_type,public.oc_provider_profiles.vehicle_type),activated_at=coalesce(public.oc_provider_profiles.activated_at,now()),is_available=false,updated_at=now() returning id into v_provider_id;
 insert into public.oc_provider_services(provider_id,service_id,is_active) select v_provider_id,m.service_id,true from public.oc_application_service_matches m join public.oc_service_catalog c on c.id=m.service_id and c.is_active where m.application_id=v_app.id on conflict(provider_id,service_id) do update set is_active=true;
 return jsonb_build_object('activated',true,'provider_id',v_provider_id,'application_number',v_app.application_number,'application_status',v_app.status,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_provider_id),'dispatch_ready_services',(select count(*) from public.oc_provider_services ps where ps.provider_id=v_provider_id and ps.is_active and private.oc_provider_service_dispatch_ready(v_provider_id,ps.service_id)));
end;$$;
revoke all on function public.oc_provider_activate_approved_application() from public,anon; grant execute on function public.oc_provider_activate_approved_application() to authenticated;

create or replace function public.oc_provider_verification_status()
returns jsonb language plpgsql stable security definer set search_path='pg_catalog','public','private' as $$
declare v_provider public.oc_provider_profiles%rowtype; v_app public.oc_provider_applications%rowtype; v_checks jsonb:='[]'::jsonb; v_ready integer:=0; v_services integer:=0; v_license_required boolean:=false; v_insurance_required boolean:=false;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.* into v_provider from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' limit 1;
 if not found then return jsonb_build_object('state','not_provider'); end if;
 if v_provider.provider_application_id is not null then select * into v_app from public.oc_provider_applications where id=v_provider.provider_application_id; select coalesce(jsonb_agg(jsonb_build_object('check_type',v.check_type,'required',v.required,'status',v.status,'notes',v.notes,'reviewed_at',v.reviewed_at) order by v.check_type),'[]'::jsonb) into v_checks from public.oc_provider_verification_checks v where v.application_id=v_provider.provider_application_id; end if;
 select count(*),count(*) filter(where private.oc_provider_service_dispatch_ready(v_provider.id,ps.service_id)),coalesce(bool_or(s.requires_license),false),coalesce(bool_or(s.requires_insurance),false) into v_services,v_ready,v_license_required,v_insurance_required from public.oc_provider_services ps join public.oc_service_catalog s on s.id=ps.service_id where ps.provider_id=v_provider.id and ps.is_active;
 return jsonb_build_object('state','provider','application_id',v_provider.provider_application_id,'application_number',v_app.application_number,'application_status',v_app.status,'core_dispatch_ready',private.oc_provider_core_dispatch_ready(v_provider.id),'services',v_services,'dispatch_ready_services',v_ready,'license_required',v_license_required,'insurance_required',v_insurance_required,'stripe_onboarding_complete',v_provider.stripe_onboarding_complete,'stripe_payouts_enabled',v_provider.stripe_payouts_enabled,'checks',v_checks);
end;$$;
revoke all on function public.oc_provider_verification_status() from public,anon; grant execute on function public.oc_provider_verification_status() to authenticated;

create or replace function public.oc_provider_set_presence(p_available boolean,p_lat double precision default null,p_lng double precision default null,p_accuracy_meters double precision default null,p_heading double precision default null,p_speed_mph double precision default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_provider public.oc_provider_profiles%rowtype; v_location_id integer; v_ready_services integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.* into v_provider from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' limit 1; if not found then raise exception 'ON CALL provider account required' using errcode='42501'; end if;
 if p_available and not private.oc_provider_core_dispatch_ready(v_provider.id) then raise exception 'Complete identity, background, skills, service-area, and payout verification before going online'; end if;
 if p_available then select count(*) into v_ready_services from public.oc_provider_services ps where ps.provider_id=v_provider.id and ps.is_active and private.oc_provider_service_dispatch_ready(v_provider.id,ps.service_id); if v_ready_services=0 then raise exception 'No approved service is dispatch-ready. Complete any required license or insurance verification.'; end if; end if;
 if p_lat is not null and (p_lat < -90 or p_lat > 90) then raise exception 'Invalid latitude'; end if; if p_lng is not null and (p_lng < -180 or p_lng > 180) then raise exception 'Invalid longitude'; end if;
 update public.oc_provider_profiles set is_available=p_available,updated_at=now() where id=v_provider.id;
 select id into v_location_id from public.oc_provider_locations where provider_id=v_provider.id order by updated_at desc nulls last,id desc limit 1;
 if p_lat is not null and p_lng is not null then if v_location_id is null then insert into public.oc_provider_locations(provider_id,lat,lng,accuracy_meters,heading,speed_mph,is_on_duty,updated_at) values(v_provider.id,p_lat,p_lng,p_accuracy_meters,p_heading,p_speed_mph,p_available,now()); else update public.oc_provider_locations set lat=p_lat,lng=p_lng,accuracy_meters=p_accuracy_meters,heading=p_heading,speed_mph=p_speed_mph,is_on_duty=p_available,updated_at=now() where id=v_location_id; end if; elsif v_location_id is not null then update public.oc_provider_locations set is_on_duty=p_available,updated_at=now() where id=v_location_id; end if;
 return jsonb_build_object('provider_id',v_provider.id,'available',p_available,'dispatch_ready_services',v_ready_services,'updated_at',now());
end;$$;

-- Every provider-facing offer path and the dispatcher use the same service-level readiness helper.
create or replace function public.oc_provider_active_offers()
returns table(offer_id integer,booking_id uuid,service_name text,category_name text,request_type text,market_city text,market_state text,scheduled_at timestamptz,customer_total numeric,estimated_provider_payout numeric,created_at timestamptz,distance_miles numeric,eta_minutes integer,match_score numeric,expires_at timestamptz,seconds_remaining integer)
language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_provider public.oc_provider_profiles%rowtype;
begin
 if auth.uid() is null then return; end if; select p.* into v_provider from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' and p.is_available limit 1; if not found or not private.oc_provider_core_dispatch_ready(v_provider.id) then return; end if;
 return query select o.id,b.id,b.service_name,b.category_name,b.request_type,coalesce(b.market_city,b.service_city),coalesce(b.market_state,b.service_state),b.scheduled_at,coalesce(b.total_price,b.estimated_price,0),round(coalesce(b.total_price,b.estimated_price,0)*0.80,2),b.created_at,o.distance_miles,o.estimated_arrival_min,round(greatest(0,100-(coalesce(o.distance_miles,0)/greatest(coalesce(b.match_radius_miles,15),1))*55)+least(25,coalesce(v_provider.rating,5)/5*25)+least(10,coalesce(v_provider.total_jobs,0)::numeric/5),1),o.expires_at,greatest(0,ceil(extract(epoch from(o.expires_at-now())))::integer)
 from public.oc_booking_offers o join public.oc_bookings b on b.id=o.booking_id where o.provider_id=v_provider.id and o.status='pending' and o.expires_at>now() and b.provider_id is null and b.status in ('pending','matching') and private.oc_provider_service_dispatch_ready(v_provider.id,b.service_id) order by o.expires_at,o.offered_at;
end;$$;

create or replace function public.oc_provider_opportunities_v2()
returns table(booking_id uuid,service_name text,category_name text,request_type text,market_city text,market_state text,scheduled_at timestamptz,customer_total numeric,estimated_provider_payout numeric,created_at timestamptz,distance_miles numeric,eta_minutes integer,match_score numeric)
language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_provider_id uuid;
begin
 select p.id into v_provider_id from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id where u.auth_id=auth.uid() and u.role='provider' and u.status='active' and p.is_available limit 1; if v_provider_id is null or not private.oc_provider_core_dispatch_ready(v_provider_id) then return; end if;
 return query select b.id,b.service_name,b.category_name,b.request_type,coalesce(b.market_city,b.service_city),coalesce(b.market_state,b.service_state),b.scheduled_at,coalesce(b.total_price,b.estimated_price,0),round(coalesce(b.total_price,b.estimated_price,0)*0.80,2),b.created_at,o.distance_miles,o.estimated_arrival_min,round(greatest(0,100-(coalesce(o.distance_miles,0)/greatest(coalesce(b.match_radius_miles,15),1))*55)+least(25,coalesce(p.rating,5)/5*25)+least(10,coalesce(p.total_jobs,0)::numeric/5),1) from public.oc_booking_offers o join public.oc_bookings b on b.id=o.booking_id join public.oc_provider_profiles p on p.id=o.provider_id where o.provider_id=v_provider_id and o.status='pending' and o.expires_at>now() and b.provider_id is null and b.status in ('pending','matching') and private.oc_provider_service_dispatch_ready(v_provider_id,b.service_id) order by o.expires_at,o.offered_at;
end;$$;

create or replace function public.oc_accept_offer(p_booking_id uuid)
returns public.oc_bookings language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_provider_id uuid; v_booking public.oc_bookings%rowtype; v_distance numeric; v_eta integer; v_offer_id integer; v_auth uuid:=auth.uid();
begin
 if v_auth is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select o.id,o.provider_id into v_offer_id,v_provider_id from public.oc_booking_offers o join public.oc_provider_profiles p on p.id=o.provider_id join public.oc_users u on u.id=p.user_id join public.oc_bookings b on b.id=o.booking_id where o.booking_id=p_booking_id and o.status='pending' and o.expires_at>now() and u.auth_id=v_auth and p.is_available and private.oc_provider_service_dispatch_ready(p.id,b.service_id) for update of o limit 1;
 if v_provider_id is null then raise exception 'Active dispatch-ready leased offer required' using errcode='42501'; end if;
 select distance_miles,estimated_arrival_min into v_distance,v_eta from public.oc_booking_offers where id=v_offer_id;
 update public.oc_bookings b set provider_id=v_provider_id,status='assigned',accepted_at=now(),matched_at=coalesce(matched_at,now()),updated_at=now() where b.id=p_booking_id and b.status in ('pending','matching') and b.provider_id is null returning b.* into v_booking; if not found then raise exception 'Offer is no longer available'; end if;
 update public.oc_booking_offers set status=case when id=v_offer_id then 'accepted' else 'expired' end,responded_at=now() where booking_id=p_booking_id and status='pending';
 update public.oc_booking_payments set provider_id=v_provider_id,settlement_type=case when settlement_type='provider_reassignment' then 'service' else settlement_type end,updated_at=now() where booking_id=p_booking_id and status in ('pending_authorization','requires_action','authorized','capture_pending');
 insert into public.oc_dispatch_log(booking_id,provider_id,response,responded_at,distance_miles,eta_minutes) values(v_booking.id,v_provider_id,'accepted',now(),v_distance,v_eta);
 insert into public.oc_booking_events(booking_id,event_type,actor_id,actor_role,description,metadata) values(v_booking.id,'provider_accepted',private.oc_current_user_id(),'provider','Provider accepted service request',jsonb_build_object('provider_id',v_provider_id,'distance_miles',v_distance,'eta_minutes',v_eta,'offer_id',v_offer_id)); return v_booking;
end;$$;

-- Keep this dispatcher synchronized with the provider-facing eligibility rule.
create or replace function private.oc_dispatch_one_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare b public.oc_bookings%rowtype;c record;v_radius integer;v_offer_id integer;v_score numeric;v_next_radius integer;
begin
 select * into b from public.oc_bookings where id=p_booking_id for update; if not found or b.provider_id is not null or b.status not in ('pending','matching') then return jsonb_build_object('result','not_dispatchable'); end if;
 if b.request_type<>'on_demand' and b.scheduled_at is not null and b.scheduled_at>now()+interval '45 minutes' then return jsonb_build_object('result','scheduled_not_ready'); end if;
 if exists(select 1 from public.oc_booking_offers o where o.booking_id=b.id and o.status='pending' and o.expires_at>now()) then return jsonb_build_object('result','active_offer_exists'); end if;
 v_radius:=greatest(5,least(coalesce(b.match_radius_miles,5),50));
 select p.id provider_id,u.id user_id,u.full_name,u.first_name,round((public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)::numeric,1) distance_miles,greatest(3,ceil((public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)*3)::integer) eta_minutes,p.rating,p.total_jobs,l.updated_at into c
 from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id join lateral(select lat,lng,updated_at from public.oc_provider_locations where provider_id=p.id and is_on_duty and updated_at>=now()-interval '5 minutes' order by updated_at desc limit 1) l on true
 where p.is_available and private.oc_provider_service_dispatch_ready(p.id,b.service_id) and not exists(select 1 from public.oc_booking_offers old where old.booking_id=b.id and old.provider_id=p.id) and b.lat is not null and b.lng is not null and (public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)<=least(v_radius,greatest(p.service_area_radius,1))
 order by public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision)),p.rating desc nulls last,p.total_jobs desc limit 1;
 if c.provider_id is null then v_next_radius:=private.oc_next_dispatch_radius(v_radius); if v_next_radius>v_radius then update public.oc_bookings set status='matching',match_radius_miles=v_next_radius,updated_at=now() where id=b.id; insert into public.oc_booking_events(booking_id,event_type,actor_role,description,metadata) values(b.id,'dispatch_radius_expanded','system','No eligible provider accepted in current radius',jsonb_build_object('from_radius',v_radius,'to_radius',v_next_radius)); return jsonb_build_object('result','radius_expanded','radius',v_next_radius); end if; return jsonb_build_object('result','no_provider_at_max_radius','radius',50); end if;
 v_score:=round(greatest(0,100-(c.distance_miles/greatest(v_radius,1))*55)+least(25,coalesce(c.rating,5)/5*25)+least(10,coalesce(c.total_jobs,0)::numeric/5),1);
 insert into public.oc_booking_offers(booking_id,provider_id,status,offered_at,expires_at,distance_miles,estimated_arrival_min) values(b.id,c.provider_id,'pending',now(),now()+interval '45 seconds',c.distance_miles,c.eta_minutes) on conflict(booking_id,provider_id) do nothing returning id into v_offer_id; if v_offer_id is null then return jsonb_build_object('result','provider_already_tried'); end if;
 update public.oc_bookings set status='matching',match_attempts=coalesce(match_attempts,0)+1,providers_notified=coalesce(providers_notified,0)+1,match_radius_miles=v_radius,updated_at=now() where id=b.id;
 insert into public.oc_dispatch_log(booking_id,provider_id,response,distance_miles,eta_minutes) values(b.id,c.provider_id,'offered',c.distance_miles,c.eta_minutes);
 insert into public.oc_notifications(user_id,booking_id,type,title,body,action_url,metadata) values(c.user_id,b.id,'provider_offer','New ON CALL opportunity',b.service_name||' · about '||coalesce(c.distance_miles::text,'?')||' mi away · est. payout $'||round(coalesce(b.total_price,b.estimated_price,0)*0.80,2)::text,'/provider',jsonb_build_object('offer_id',v_offer_id,'expires_at',now()+interval '45 seconds','distance_miles',c.distance_miles,'eta_minutes',c.eta_minutes,'match_score',v_score)); return jsonb_build_object('result','offer_created','offer_id',v_offer_id,'provider_id',c.provider_id,'radius',v_radius,'expires_seconds',45);
end;$$;
