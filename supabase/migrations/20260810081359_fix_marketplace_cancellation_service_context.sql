-- Make cancellation quote/finalization work from the authenticated client and
-- from the trusted Edge service_role path. Never use current_user to identify
-- a service caller inside SECURITY DEFINER functions.

create or replace function public.oc_customer_cancellation_quote(p_booking_id uuid)
returns table(can_cancel boolean, booking_status text, fee_cents integer, provider_compensation_cents integer, policy_version integer, reason text)
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  v_booking public.oc_bookings%rowtype;
  v_user uuid;
  v_cfg jsonb;
  v_total integer;
  v_fee integer:=0;
  v_share numeric:=80;
  v_version integer:=1;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  if v_is_server then
    select * into v_booking from public.oc_bookings where id=p_booking_id;
    if not found then raise exception 'Booking not found' using errcode='P0002'; end if;
    v_user:=v_booking.customer_id;
  else
    v_user:=private.oc_current_user_id();
    if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
    select * into v_booking from public.oc_bookings where id=p_booking_id and customer_id=v_user;
    if not found then raise exception 'Booking not found' using errcode='P0002'; end if;
  end if;

  select config_value into v_cfg from public.oc_system_config where config_key='cancellation_policy' and is_active limit 1;
  v_cfg:=coalesce(v_cfg,'{}'::jsonb);
  v_total:=coalesce(v_booking.total_price_cents,v_booking.final_price_cents,v_booking.estimated_price_cents,0);
  v_share:=coalesce((v_cfg->>'provider_share_percent')::numeric,80);
  v_version:=coalesce((v_cfg->>'version')::integer,1);

  if v_booking.status in ('pending','matching','assigned') then
    return query select true,v_booking.status,0,0,v_version,'Free cancellation before provider travel begins'::text; return;
  elsif v_booking.status='en_route' then
    if coalesce((v_cfg->>'fees_enabled')::boolean,false) then
      v_fee:=least(round(coalesce((v_cfg->'en_route'->>'maximum')::numeric,25)*100)::integer,
                   greatest(round(coalesce((v_cfg->'en_route'->>'minimum')::numeric,10)*100)::integer,
                            round(v_total*coalesce((v_cfg->'en_route'->>'percent')::numeric,10)/100)::integer));
    end if;
    return query select true,v_booking.status,v_fee,round(v_fee*v_share/100)::integer,v_version,'Provider has started traveling'::text; return;
  elsif v_booking.status='on_site' then
    if coalesce((v_cfg->>'fees_enabled')::boolean,false) then
      v_fee:=least(round(coalesce((v_cfg->'on_site'->>'maximum')::numeric,40)*100)::integer,
                   greatest(round(coalesce((v_cfg->'on_site'->>'minimum')::numeric,15)*100)::integer,
                            round(v_total*coalesce((v_cfg->'on_site'->>'percent')::numeric,20)/100)::integer));
    end if;
    return query select true,v_booking.status,v_fee,round(v_fee*v_share/100)::integer,v_version,'Provider has arrived at the service location'::text; return;
  else
    return query select false,v_booking.status,0,0,v_version,'Service already started; use support instead of self-cancel'::text; return;
  end if;
end
$function$;

create or replace function public.oc_customer_cancel_v2(p_booking_id uuid,p_reason text default null)
returns public.oc_bookings
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  q record;
  b public.oc_bookings%rowtype;
  uid uuid;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  if v_is_server then
    select customer_id into uid from public.oc_bookings where id=p_booking_id;
    if uid is null then raise exception 'Booking not found' using errcode='P0002'; end if;
  else
    uid:=private.oc_current_user_id();
    if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  end if;

  select * into q from public.oc_customer_cancellation_quote(p_booking_id);
  if not q.can_cancel then raise exception '%',q.reason; end if;

  update public.oc_bookings
  set status='canceled',canceled_at=now(),cancelled_at=now(),cancelled_by='customer',
      cancellation_reason=left(nullif(trim(p_reason),''),500),
      cancellation_fee_cents=q.fee_cents,
      cancellation_provider_compensation_cents=q.provider_compensation_cents,
      cancellation_policy_version=q.policy_version,updated_at=now()
  where id=p_booking_id and customer_id=uid returning * into b;
  if not found then raise exception 'Booking not found' using errcode='P0002'; end if;

  update public.oc_booking_offers set status='canceled',responded_at=coalesce(responded_at,now())
   where booking_id=p_booking_id and status='pending';
  insert into public.oc_booking_events(booking_id,event_type,actor_id,actor_role,description,metadata)
  values(p_booking_id,'status_change',uid,'customer','Customer canceled booking',
    jsonb_build_object('new_status','canceled','cancellation_fee_cents',q.fee_cents,
      'provider_compensation_cents',q.provider_compensation_cents,'policy_version',q.policy_version,
      'reason',left(nullif(trim(p_reason),''),500)));
  return b;
end
$function$;

create or replace function public.sos_customer_cancellation_quote(p_mission_id uuid)
returns table(can_cancel boolean, mission_status text, fee_amount numeric, hero_compensation numeric, policy_version integer, reason text)
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  v_user uuid;
  v_m public.sos_missions%rowtype;
  v_cfg jsonb;
  v_total numeric;
  v_fee numeric:=0;
  v_share numeric:=80;
  v_version integer:=1;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  if v_is_server then
    select * into v_m from public.sos_missions where id=p_mission_id;
    if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
    v_user:=v_m.citizen_id;
  else
    v_user:=private.sos_current_user_id();
    if v_user is null then raise exception 'Authenticated customer required' using errcode='42501'; end if;
    select * into v_m from public.sos_missions where id=p_mission_id and citizen_id=v_user;
    if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  end if;

  select config_value into v_cfg from public.sos_system_config where config_key='cancellation_policy' and is_active limit 1;
  v_cfg:=coalesce(v_cfg,'{}'::jsonb);
  v_total:=coalesce(v_m.final_price,v_m.estimated_price,v_m.client_estimate_amount,0);
  v_share:=coalesce((v_cfg->>'hero_share_percent')::numeric,80);
  v_version:=coalesce((v_cfg->>'version')::integer,1);

  if v_m.status in ('requested','matching','assigned') then
    return query select true,v_m.status,0::numeric,0::numeric,v_version,'Free cancellation before Hero travel begins'::text; return;
  elsif v_m.status='en_route' then
    if coalesce((v_cfg->>'fees_enabled')::boolean,false) then
      v_fee:=least(coalesce((v_cfg->'en_route'->>'maximum')::numeric,25),greatest(coalesce((v_cfg->'en_route'->>'minimum')::numeric,10),round(v_total*coalesce((v_cfg->'en_route'->>'percent')::numeric,10)/100,2)));
    end if;
    return query select true,v_m.status,v_fee,round(v_fee*v_share/100,2),v_version,'Hero has started traveling'::text; return;
  elsif v_m.status='on_site' then
    if coalesce((v_cfg->>'fees_enabled')::boolean,false) then
      v_fee:=least(coalesce((v_cfg->'on_site'->>'maximum')::numeric,40),greatest(coalesce((v_cfg->'on_site'->>'minimum')::numeric,15),round(v_total*coalesce((v_cfg->'on_site'->>'percent')::numeric,20)/100,2)));
    end if;
    return query select true,v_m.status,v_fee,round(v_fee*v_share/100,2),v_version,'Hero has arrived at the mission location'::text; return;
  else
    return query select false,v_m.status,0::numeric,0::numeric,v_version,'Mission work already started; use support instead of self-cancel'::text; return;
  end if;
end
$function$;

create or replace function public.sos_cancel_own_mission_v2(p_mission_id uuid,p_reason text default null)
returns public.sos_missions
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  q record;
  m public.sos_missions%rowtype;
  uid uuid;
  old_status text;
  v_is_server boolean:=coalesce(auth.jwt()->>'role','')='service_role';
begin
  if v_is_server then
    select citizen_id,status into uid,old_status from public.sos_missions where id=p_mission_id for update;
    if uid is null then raise exception 'Mission not found' using errcode='P0002'; end if;
  else
    uid:=private.sos_current_user_id();
    if uid is null then raise exception 'Authenticated customer required' using errcode='42501'; end if;
    select status into old_status from public.sos_missions where id=p_mission_id and citizen_id=uid for update;
    if not found then raise exception 'Mission not found' using errcode='P0002'; end if;
  end if;

  select * into q from public.sos_customer_cancellation_quote(p_mission_id);
  if not q.can_cancel then raise exception '%',q.reason; end if;

  update public.sos_missions
  set status='canceled_by_citizen',canceled_at=now(),cancel_reason=left(nullif(trim(p_reason),''),500),
      cancellation_fee=q.fee_amount,cancellation_hero_compensation=q.hero_compensation,
      cancellation_policy_version=q.policy_version,updated_at=now()
  where id=p_mission_id and citizen_id=uid returning * into m;
  if not found then raise exception 'Mission not found' using errcode='P0002'; end if;

  update public.sos_mission_offers set status='canceled',responded_at=coalesce(responded_at,now())
   where mission_id=p_mission_id and status='pending';
  insert into public.sos_mission_events(mission_id,event_type,old_status,new_status,payload,actor)
  values(p_mission_id,'status_change',old_status,'canceled_by_citizen',
    jsonb_build_object('reason',left(nullif(trim(p_reason),''),500),'cancellation_fee',q.fee_amount,
      'hero_compensation',q.hero_compensation,'policy_version',q.policy_version),'citizen');
  return m;
end
$function$;

revoke execute on function public.oc_customer_cancellation_quote(uuid) from public,anon;
grant execute on function public.oc_customer_cancellation_quote(uuid) to authenticated,service_role;
revoke execute on function public.oc_customer_cancel_v2(uuid,text) from public,anon;
grant execute on function public.oc_customer_cancel_v2(uuid,text) to authenticated,service_role;
revoke execute on function public.sos_customer_cancellation_quote(uuid) from public,anon;
grant execute on function public.sos_customer_cancellation_quote(uuid) to authenticated,service_role;
revoke execute on function public.sos_cancel_own_mission_v2(uuid,text) from public,anon;
grant execute on function public.sos_cancel_own_mission_v2(uuid,text) to authenticated,service_role;
