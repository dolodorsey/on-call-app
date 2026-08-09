create or replace function private.oc_notify_provider_offer()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_user uuid;
  v_service text;
  v_total numeric;
  v_payout numeric;
  v_distance numeric;
  v_eta integer;
begin
  select user_id into v_user from public.oc_provider_profiles where id=new.provider_id;
  if v_user is null then return new; end if;

  select service_name,coalesce(total_price,estimated_price,0)
    into v_service,v_total
  from public.oc_bookings where id=new.booking_id;

  v_payout:=round(coalesce(v_total,0)*0.80,2);
  v_distance:=new.distance_miles;
  v_eta:=new.estimated_arrival_min;

  insert into public.oc_notifications(user_id,booking_id,type,title,body,channel,action_url,metadata,sent_at)
  values(
    v_user,new.booking_id,'provider_offer','New ON CALL job offer',
    coalesce(v_service,'ON CALL service')||' · est. $'||to_char(v_payout,'FM999999990.00')||case when v_distance is not null then ' · '||to_char(v_distance,'FM999990.0')||' mi' else '' end,
    'push','/provider',
    jsonb_build_object('offer_id',new.id,'booking_id',new.booking_id,'provider_id',new.provider_id,'expires_at',new.expires_at,'distance_miles',v_distance,'eta_minutes',v_eta,'estimated_provider_payout',v_payout),
    now()
  );
  return new;
end;
$$;

drop trigger if exists oc_provider_offer_alerts on public.oc_booking_offers;
create trigger oc_provider_offer_alerts
after insert on public.oc_booking_offers
for each row execute function private.oc_notify_provider_offer();
