create or replace function private.oc_match_score(p_distance_miles numeric,p_radius_miles numeric,p_rating numeric,p_total_jobs integer)
returns numeric language sql immutable set search_path to 'pg_catalog','private'
as $function$
  select round(
      least(100,greatest(0,coalesce(p_rating,5)/5.0*100))*0.55
    + least(100,greatest(0,coalesce(p_total_jobs,0)::numeric*2))*0.35
    + greatest(0,100-(coalesce(p_distance_miles,0)/greatest(coalesce(p_radius_miles,15),1))*100)*0.10
  ,1);
$function$;

create or replace function private.oc_dispatch_one_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','private'
as $function$
declare b public.oc_bookings%rowtype; c record; v_radius integer; v_offer_id integer; v_score numeric; v_next_radius integer; v_fee_pct numeric; v_payout_cents integer; v_base_cents integer;
begin
  select * into b from public.oc_bookings where id=p_booking_id for update;
  if not found or b.provider_id is not null or b.status not in ('pending','matching') then return jsonb_build_object('result','not_dispatchable'); end if;
  if b.request_type<>'on_demand' and b.scheduled_at is not null and b.scheduled_at>now()+interval '45 minutes' then return jsonb_build_object('result','scheduled_not_ready'); end if;
  if exists(select 1 from public.oc_booking_offers o where o.booking_id=b.id and o.status='pending' and o.expires_at>now()) then return jsonb_build_object('result','active_offer_exists'); end if;
  v_radius:=greatest(5,least(coalesce(b.match_radius_miles,5),50));
  select p.id provider_id,u.id user_id,u.full_name,u.first_name,
    round((public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)::numeric,1) distance_miles,
    private.marketplace_road_eta_minutes((public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)::numeric,now()) eta_minutes,
    p.rating,p.total_jobs,l.updated_at,
    private.oc_match_score((public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)::numeric,v_radius,p.rating,p.total_jobs) match_score
    into c
  from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id
  join lateral(select lat,lng,updated_at from public.oc_provider_locations where provider_id=p.id and is_on_duty and updated_at>=now()-interval '5 minutes' order by updated_at desc limit 1) l on true
  where p.is_available and private.oc_provider_service_dispatch_ready(p.id,b.service_id)
    and not exists(select 1 from public.oc_booking_offers old where old.booking_id=b.id and old.provider_id=p.id)
    and b.lat is not null and b.lng is not null
    and (public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision))/1609.344)<=least(v_radius,greatest(p.service_area_radius,1))
  order by match_score desc,l.updated_at desc,public.st_distancesphere(public.st_makepoint(l.lng::double precision,l.lat::double precision),public.st_makepoint(b.lng::double precision,b.lat::double precision)) asc limit 1;
  if c.provider_id is null then
    v_next_radius:=private.oc_next_dispatch_radius(v_radius);
    if v_next_radius>v_radius then update public.oc_bookings set status='matching',match_radius_miles=v_next_radius,updated_at=now() where id=b.id; return jsonb_build_object('result','radius_expanded','radius',v_next_radius); end if;
    return jsonb_build_object('result','no_provider_at_max_radius','radius',50);
  end if;
  v_score:=c.match_score;
  v_fee_pct:=private.oc_platform_fee_percent(b.category_id,b.service_id,b.market_city,b.market_state);
  v_base_cents:=coalesce(b.total_price_cents,b.estimated_price_cents,0);
  v_payout_cents:=round(v_base_cents*(1-v_fee_pct/100.0))::integer;
  insert into public.oc_booking_offers(booking_id,provider_id,status,offered_at,expires_at,distance_miles,estimated_arrival_min) values(b.id,c.provider_id,'pending',now(),now()+interval '45 seconds',c.distance_miles,c.eta_minutes) on conflict(booking_id,provider_id) do nothing returning id into v_offer_id;
  if v_offer_id is null then return jsonb_build_object('result','provider_already_tried'); end if;
  update public.oc_bookings set status='matching',match_attempts=coalesce(match_attempts,0)+1,providers_notified=coalesce(providers_notified,0)+1,match_radius_miles=v_radius,updated_at=now() where id=b.id;
  insert into public.oc_dispatch_log(booking_id,provider_id,response,distance_miles,eta_minutes) values(b.id,c.provider_id,'offered',c.distance_miles,c.eta_minutes);
  insert into public.oc_notifications(user_id,booking_id,type,title,body,action_url,metadata) values(c.user_id,b.id,'provider_offer','New ON CALL opportunity',b.service_name||' · quality match '||coalesce(v_score::text,'?')||'% · about '||coalesce(c.distance_miles::text,'?')||' mi away'||case when v_base_cents>0 then ' · est. payout $'||to_char(v_payout_cents/100.0,'FM999999990.00') else ' · quote on site' end,'/provider',jsonb_build_object('offer_id',v_offer_id,'expires_at',now()+interval '45 seconds','distance_miles',c.distance_miles,'eta_minutes',c.eta_minutes,'match_score',v_score,'ranking_model','provider-quality-first-v2'));
  return jsonb_build_object('result','offer_created','offer_id',v_offer_id,'provider_id',c.provider_id,'radius',v_radius,'expires_seconds',45,'match_score',v_score,'ranking_model','provider-quality-first-v2');
end;
$function$;
comment on function private.oc_match_score(numeric,numeric,numeric,integer) is 'ON CALL provider quality model: rating 55%, completed-job experience 35%, proximity 10%. Eligibility, verification and live availability are hard gates outside the score.';
