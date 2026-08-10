-- Fix authenticated price-confirmation authorization.
-- SECURITY DEFINER changes current_user to the function owner, so current_user
-- cannot be used to distinguish a service caller from a normal signed-in user.

create or replace function public.oc_confirm_booking_price(
  p_booking_id uuid,
  p_final_price_cents integer,
  p_actor_auth_id uuid default null
)
returns public.oc_bookings
language plpgsql
security definer
set search_path = 'pg_catalog','public','private'
as $function$
declare
  v_booking public.oc_bookings%rowtype;
  v_provider_id uuid;
  v_is_server boolean := coalesce(auth.jwt()->>'role','') = 'service_role';
  v_actor uuid;
  v_actor_role text;
  v_estimate integer;
  v_floor integer;
  v_ceiling integer;
begin
  select * into v_booking from public.oc_bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode='P0002'; end if;

  if v_is_server then
    v_actor := p_actor_auth_id;
    v_actor_role := 'admin';
    if v_actor is null then raise exception 'Operator identity required' using errcode='42501'; end if;
  else
    if auth.uid() is null then
      raise exception 'Authentication required' using errcode='42501';
    end if;
    v_provider_id := private.oc_current_provider_id();
    if v_provider_id is null or v_booking.provider_id is distinct from v_provider_id then
      raise exception 'Assigned ON CALL provider or server role required' using errcode='42501';
    end if;
    v_actor := private.oc_current_user_id();
    v_actor_role := 'provider';
  end if;

  if v_booking.provider_id is null
     or v_booking.status not in ('assigned','en_route','on_site','working') then
    raise exception 'Accepted provider assignment required';
  end if;

  if exists (
    select 1 from public.oc_booking_payments
    where booking_id=p_booking_id
      and status not in ('failed','authorization_canceled')
  ) then
    raise exception 'Price cannot change after payment authorization begins';
  end if;

  if p_final_price_cents is null or p_final_price_cents < 100 or p_final_price_cents > 5000000 then
    raise exception 'Final price must be between $1.00 and $50,000.00';
  end if;

  v_estimate := coalesce(nullif(v_booking.estimated_price_cents,0), p_final_price_cents);
  v_floor := greatest(100, (v_estimate * 0.5)::integer);
  v_ceiling := (v_estimate * 3)::integer;
  if p_final_price_cents < v_floor or p_final_price_cents > v_ceiling then
    raise exception 'Final price %.2f is outside the allowed range %.2f - %.2f for an estimate of %.2f. Ops override required.',
      p_final_price_cents/100.0, v_floor/100.0, v_ceiling/100.0, v_estimate/100.0;
  end if;

  update public.oc_bookings set
    final_price_cents = p_final_price_cents,
    total_price_cents = p_final_price_cents,
    tax_amount_cents = round(p_final_price_cents * coalesce(
      (select z.tax_rate_percent from public.oc_service_zones z
       where z.id = (private.oc_zone_for_point(
         coalesce(service_lat,lat)::double precision,
         coalesce(service_lng,lng)::double precision
       )).id), 0) / 100.0)::integer,
    pricing_status = 'confirmed',
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.oc_booking_events(booking_id,event_type,actor_id,actor_role,description,metadata)
  values(
    p_booking_id,'price_confirmed',v_actor,v_actor_role,'Final price confirmed',
    jsonb_build_object(
      'estimated_price_cents',v_estimate,
      'final_price_cents',v_booking.final_price_cents,
      'tax_amount_cents',v_booking.tax_amount_cents,
      'actor_role',v_actor_role
    )
  );
  return v_booking;
end
$function$;

revoke execute on function public.oc_confirm_booking_price(uuid,integer,uuid) from public, anon;
grant execute on function public.oc_confirm_booking_price(uuid,integer,uuid) to authenticated, service_role;
