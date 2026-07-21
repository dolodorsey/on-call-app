-- ON CALL controlled booking lifecycle
-- Apply after 20260710_home_services_marketplace_foundation.sql.

begin;

create table if not exists public.oc_ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.oc_bookings(id) on delete restrict,
  rated_by uuid not null references public.oc_users(id) on delete restrict,
  rated_user uuid not null references public.oc_users(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  review text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(booking_id, rated_by)
);

alter table public.oc_ratings enable row level security;

drop policy if exists "Booking participants read OC ratings" on public.oc_ratings;
create policy "Booking participants read OC ratings"
on public.oc_ratings for select
to authenticated
using (
  exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

drop policy if exists "Booking participants create OC ratings" on public.oc_ratings;
create policy "Booking participants create OC ratings"
on public.oc_ratings for insert
to authenticated
with check (
  rated_by = public.oc_current_user_id()
  and exists (
    select 1 from public.oc_bookings b
    where b.id = booking_id
      and b.status = 'completed'
      and (b.customer_id = public.oc_current_user_id() or b.provider_id = public.oc_current_provider_id())
  )
);

create or replace function public.oc_advance_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.oc_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.oc_bookings%rowtype;
  v_provider_id uuid := public.oc_current_provider_id();
  v_status text := lower(trim(p_new_status));
  v_old_status text;
begin
  if auth.uid() is null or v_provider_id is null then
    raise exception 'Authenticated provider required' using errcode = '42501';
  end if;

  select * into v_booking
  from public.oc_bookings
  where id = p_booking_id and provider_id = v_provider_id
  for update;

  if not found then
    raise exception 'Assigned booking not found' using errcode = 'P0002';
  end if;

  v_old_status := v_booking.status;

  if not (
    (v_old_status = 'accepted' and v_status = 'en_route')
    or (v_old_status = 'en_route' and v_status = 'arrived')
    or (v_old_status = 'arrived' and v_status = 'in_progress')
    or (v_old_status = 'in_progress' and v_status = 'completed')
  ) then
    raise exception 'Invalid booking transition: % -> %', v_old_status, v_status;
  end if;

  update public.oc_bookings
  set status = v_status,
      en_route_at = case when v_status = 'en_route' then now() else en_route_at end,
      arrived_at = case when v_status = 'arrived' then now() else arrived_at end,
      started_at = case when v_status = 'in_progress' then now() else started_at end,
      completed_at = case when v_status = 'completed' then now() else completed_at end,
      updated_at = now(),
      version = version + 1
  where id = p_booking_id
  returning * into v_booking;

  insert into public.oc_booking_events(
    booking_id, event_type, old_status, new_status, actor_user_id, actor_type,
    metadata, lat, lng
  )
  values (
    p_booking_id, 'status_changed', v_old_status, v_status,
    public.oc_current_user_id(), 'provider', coalesce(p_metadata, '{}'::jsonb),
    p_lat, p_lng
  );

  insert into public.oc_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.' || v_status, 'oc_booking', p_booking_id,
    public.oc_current_user_id(),
    jsonb_build_object('provider_id', v_provider_id, 'status', v_status)
  );

  return v_booking;
end;
$$;

create or replace function public.oc_cancel_booking(
  p_booking_id uuid,
  p_reason text
)
returns public.oc_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.oc_bookings%rowtype;
  v_user_id uuid := public.oc_current_user_id();
  v_provider_id uuid := public.oc_current_provider_id();
  v_actor text;
  v_old_status text;
begin
  if auth.uid() is null or v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_reason), '')) < 3 then
    raise exception 'Cancellation reason is required';
  end if;

  select * into v_booking
  from public.oc_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.customer_id = v_user_id then
    v_actor := 'customer';
  elsif v_booking.provider_id = v_provider_id then
    v_actor := 'provider';
  else
    raise exception 'Not authorized for booking' using errcode = '42501';
  end if;

  if v_booking.status in ('completed','canceled') then
    raise exception 'Booking cannot be canceled from status %', v_booking.status;
  end if;

  v_old_status := v_booking.status;

  update public.oc_bookings
  set status = 'canceled',
      canceled_at = now(),
      cancel_reason = trim(p_reason),
      canceled_by = v_actor,
      updated_at = now(),
      version = version + 1
  where id = p_booking_id
  returning * into v_booking;

  update public.oc_booking_offers
  set status = 'canceled', responded_at = coalesce(responded_at, now())
  where booking_id = p_booking_id and status = 'offered';

  insert into public.oc_booking_events(
    booking_id, event_type, old_status, new_status, actor_user_id, actor_type, metadata
  )
  values (
    p_booking_id, 'booking_canceled', v_old_status, 'canceled',
    v_user_id, v_actor, jsonb_build_object('reason', trim(p_reason))
  );

  insert into public.oc_integration_events(
    event_type, aggregate_type, aggregate_id, requested_by, payload
  )
  values (
    'booking.canceled', 'oc_booking', p_booking_id, v_user_id,
    jsonb_build_object('actor', v_actor, 'reason', trim(p_reason))
  );

  return v_booking;
end;
$$;

create or replace function public.oc_rate_completed_booking(
  p_booking_id uuid,
  p_rating integer,
  p_review text default null,
  p_tags text[] default '{}'
)
returns public.oc_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.oc_bookings%rowtype;
  v_user_id uuid := public.oc_current_user_id();
  v_provider_id uuid := public.oc_current_provider_id();
  v_rated_user uuid;
  v_rating public.oc_ratings%rowtype;
begin
  if auth.uid() is null or v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_booking
  from public.oc_bookings
  where id = p_booking_id and status = 'completed';

  if not found then
    raise exception 'Completed booking not found' using errcode = 'P0002';
  end if;

  if v_booking.customer_id = v_user_id then
    select user_id into v_rated_user
    from public.oc_provider_profiles
    where id = v_booking.provider_id;
  elsif v_booking.provider_id = v_provider_id then
    v_rated_user := v_booking.customer_id;
  else
    raise exception 'Not authorized for booking' using errcode = '42501';
  end if;

  if v_rated_user is null then
    raise exception 'Rating target not found';
  end if;

  insert into public.oc_ratings(
    booking_id, rated_by, rated_user, rating, review, tags
  )
  values (
    p_booking_id, v_user_id, v_rated_user, p_rating,
    nullif(trim(p_review), ''), coalesce(p_tags, '{}')
  )
  on conflict (booking_id, rated_by) do update
  set rating = excluded.rating,
      review = excluded.review,
      tags = excluded.tags
  returning * into v_rating;

  update public.oc_bookings
  set rating = case when customer_id = v_user_id then p_rating else rating end,
      updated_at = now()
  where id = p_booking_id;

  return v_rating;
end;
$$;

-- Lifecycle writes now use controlled RPCs. Service-role workers retain access.
revoke update on public.oc_bookings from anon, authenticated;

revoke all on function public.oc_advance_booking_status(uuid, text, double precision, double precision, jsonb) from public, anon;
revoke all on function public.oc_cancel_booking(uuid, text) from public, anon;
revoke all on function public.oc_rate_completed_booking(uuid, integer, text, text[]) from public, anon;
grant execute on function public.oc_advance_booking_status(uuid, text, double precision, double precision, jsonb) to authenticated;
grant execute on function public.oc_cancel_booking(uuid, text) to authenticated;
grant execute on function public.oc_rate_completed_booking(uuid, integer, text, text[]) to authenticated;

commit;
