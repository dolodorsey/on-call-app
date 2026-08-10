create or replace function public.oc_provider_customer_no_show_v2(
  p_booking_id uuid,
  p_actor_auth_id uuid,
  p_fee_cents integer,
  p_provider_compensation_cents integer,
  p_policy_version integer,
  p_wait_minutes integer
)
returns public.oc_bookings
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  v_auth uuid;
  v_user uuid;
  v_provider uuid;
  v_booking public.oc_bookings%rowtype;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  v_auth:=case when v_is_server then p_actor_auth_id else auth.uid() end;
  if v_auth is null then raise exception 'Provider authentication required' using errcode='42501'; end if;
  select u.id,p.id into v_user,v_provider
  from public.oc_users u join public.oc_provider_profiles p on p.user_id=u.id
  where u.auth_id=v_auth and u.role='provider' and u.status='active'
  order by p.created_at desc limit 1;
  if v_provider is null then raise exception 'Provider account required' using errcode='42501'; end if;
  if p_wait_minutes is null or p_wait_minutes < 1 or p_wait_minutes > 120 then raise exception 'Invalid no-show wait period'; end if;
  if p_fee_cents is null or p_fee_cents < 0 or p_provider_compensation_cents is null or p_provider_compensation_cents < 0 or p_provider_compensation_cents > p_fee_cents then raise exception 'Invalid no-show settlement amounts'; end if;
  select * into v_booking from public.oc_bookings where id=p_booking_id and provider_id=v_provider for update;
  if not found then raise exception 'Assigned booking not found' using errcode='P0002'; end if;
  if v_booking.status <> 'on_site' or v_booking.arrived_at is null then raise exception 'No-show settlement requires provider arrival'; end if;
  if v_booking.arrived_at > now() - make_interval(mins=>p_wait_minutes) then raise exception 'No-show wait period is still active'; end if;
  update public.oc_bookings set
    status='canceled',cancelled_by='customer_no_show',
    cancellation_reason='Customer no-show after provider arrival',
    cancellation_fee_cents=p_fee_cents,
    cancellation_provider_compensation_cents=p_provider_compensation_cents,
    cancellation_policy_version=coalesce(p_policy_version,1),
    cancelled_at=now(),canceled_at=now(),updated_at=now()
  where id=p_booking_id and provider_id=v_provider and status='on_site'
  returning * into v_booking;
  if not found then raise exception 'Booking state changed before no-show settlement'; end if;
  update public.oc_booking_offers set status='canceled',responded_at=coalesce(responded_at,now()) where booking_id=p_booking_id and status='pending';
  insert into public.oc_booking_events(booking_id,event_type,actor_id,actor_role,description,metadata)
  values(p_booking_id,'customer_no_show',v_user,'provider','Provider confirmed customer no-show',jsonb_build_object('wait_minutes',p_wait_minutes,'cancellation_fee_cents',p_fee_cents,'provider_compensation_cents',p_provider_compensation_cents,'policy_version',coalesce(p_policy_version,1)));
  return v_booking;
end
$function$;

create or replace function public.sos_hero_customer_no_show_v2(
  p_mission_id uuid,
  p_actor_auth_id uuid,
  p_fee_amount numeric,
  p_hero_compensation numeric,
  p_policy_version integer,
  p_wait_minutes integer
)
returns public.sos_missions
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  v_auth uuid;
  v_user uuid;
  v_hero uuid;
  v_mission public.sos_missions%rowtype;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  v_auth:=case when v_is_server then p_actor_auth_id else auth.uid() end;
  if v_auth is null then raise exception 'Hero authentication required' using errcode='42501'; end if;
  select u.id,h.id into v_user,v_hero
  from public.sos_users u join public.sos_heroes h on h.user_id=u.id
  where u.auth_id=v_auth and u.role='hero' and u.status='active' and coalesce(u.is_demo,false)=false and coalesce(h.is_demo,false)=false
  order by h.created_at desc limit 1;
  if v_hero is null then raise exception 'Hero account required' using errcode='42501'; end if;
  if p_wait_minutes is null or p_wait_minutes < 1 or p_wait_minutes > 120 then raise exception 'Invalid no-show wait period'; end if;
  if p_fee_amount is null or p_fee_amount < 0 or p_hero_compensation is null or p_hero_compensation < 0 or p_hero_compensation > p_fee_amount then raise exception 'Invalid no-show settlement amounts'; end if;
  select * into v_mission from public.sos_missions where id=p_mission_id and hero_id=v_hero for update;
  if not found then raise exception 'Assigned mission not found' using errcode='P0002'; end if;
  if v_mission.status <> 'on_site' or v_mission.arrived_at is null then raise exception 'No-show settlement requires Hero arrival'; end if;
  if v_mission.arrived_at > now() - make_interval(mins=>p_wait_minutes) then raise exception 'No-show wait period is still active'; end if;
  update public.sos_missions set
    status='canceled_by_system',canceled_at=now(),cancel_reason='customer_no_show',
    cancellation_fee=p_fee_amount,cancellation_hero_compensation=p_hero_compensation,
    cancellation_policy_version=coalesce(p_policy_version,1),updated_at=now()
  where id=p_mission_id and hero_id=v_hero and status='on_site'
  returning * into v_mission;
  if not found then raise exception 'Mission state changed before no-show settlement'; end if;
  update public.sos_mission_offers set status='canceled',responded_at=coalesce(responded_at,now()) where mission_id=p_mission_id and status='pending';
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'system_note','on_site','canceled_by_system',jsonb_build_object('reliability_event','customer_no_show','wait_minutes',p_wait_minutes,'cancellation_fee',p_fee_amount,'hero_compensation',p_hero_compensation,'policy_version',coalesce(p_policy_version,1)),'hero');
  return v_mission;
end
$function$;

revoke execute on function public.oc_provider_customer_no_show_v2(uuid,uuid,integer,integer,integer,integer) from public,anon;
grant execute on function public.oc_provider_customer_no_show_v2(uuid,uuid,integer,integer,integer,integer) to authenticated,service_role;
revoke execute on function public.sos_hero_customer_no_show_v2(uuid,uuid,numeric,numeric,integer,integer) from public,anon;
grant execute on function public.sos_hero_customer_no_show_v2(uuid,uuid,numeric,numeric,integer,integer) to authenticated,service_role;
