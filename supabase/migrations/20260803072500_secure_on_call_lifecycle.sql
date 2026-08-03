-- ON CALL: make identity, pricing, and booking state server-controlled.

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
    'customer'
  )
  on conflict (auth_id) do nothing;
  return new;
exception when others then
  raise warning 'oc_handle_new_user failed for %: % [%]', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;

revoke execute on function public.oc_handle_new_user() from public, anon, authenticated;

drop policy if exists "Customers create bookings" on public.oc_bookings;
drop policy if exists "Customers update own bookings" on public.oc_bookings;
drop policy if exists "Customers see own bookings" on public.oc_bookings;
drop policy if exists "Service role full access oc_bookings" on public.oc_bookings;
drop policy if exists "Providers see assigned bookings" on public.oc_bookings;

create policy "Customers see own bookings"
on public.oc_bookings for select to authenticated
using (customer_id = (select id from public.oc_users where auth_id = (select auth.uid())));

create policy "Providers see assigned bookings"
on public.oc_bookings for select to authenticated
using (provider_id = (
  select pp.id from public.oc_provider_profiles pp
  join public.oc_users u on u.id = pp.user_id
  where u.auth_id = (select auth.uid()) and u.role = 'provider' and pp.background_check_status = 'passed'
));

drop policy if exists "Providers read own profile" on public.oc_provider_profiles;
drop policy if exists "Providers update own profile" on public.oc_provider_profiles;
drop policy if exists "Service role full access oc_providers" on public.oc_provider_profiles;

create policy "Approved providers read own profile"
on public.oc_provider_profiles for select to authenticated
using (user_id = (select id from public.oc_users where auth_id = (select auth.uid()) and role = 'provider'));

create policy "Approved providers update own profile"
on public.oc_provider_profiles for update to authenticated
using (user_id = (select id from public.oc_users where auth_id = (select auth.uid()) and role = 'provider'))
with check (user_id = (select id from public.oc_users where auth_id = (select auth.uid()) and role = 'provider'));

drop policy if exists "Users read own oc profile" on public.oc_users;
drop policy if exists "Users update own oc profile" on public.oc_users;
drop policy if exists "Service role full access oc_users" on public.oc_users;

create policy "Users read own oc profile"
on public.oc_users for select to authenticated
using (auth_id = (select auth.uid()));

create policy "Users update own oc profile"
on public.oc_users for update to authenticated
using (auth_id = (select auth.uid()))
with check (auth_id = (select auth.uid()));

revoke insert, update, delete on public.oc_bookings from anon, authenticated;
revoke insert, delete on public.oc_users from anon, authenticated;
revoke update on public.oc_users from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.oc_users to authenticated;
revoke insert, delete on public.oc_provider_profiles from anon, authenticated;
revoke update on public.oc_provider_profiles from anon, authenticated;
grant update (is_available, service_area_radius, vehicle_type, vehicle_info) on public.oc_provider_profiles to authenticated;

create or replace function public.oc_request_service(
  p_service_name text,
  p_address text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_scheduled_at timestamptz default null
)
returns public.oc_bookings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer public.oc_users%rowtype;
  v_price numeric;
  v_booking public.oc_bookings%rowtype;
begin
  select * into v_customer from public.oc_users where auth_id = auth.uid() and role = 'customer';
  if not found then raise exception 'Customer account required'; end if;
  if coalesce(length(trim(p_address)), 0) < 3 then raise exception 'A service address is required'; end if;

  v_price := case p_service_name
    when 'Deep Clean' then 85 when 'Handyman' then 65 when 'Plumbing' then 95
    when 'Electrician' then 90 when 'Lawn Care' then 55 when 'Private Chef' then 150
    else null end;
  if v_price is null then raise exception 'Unsupported service'; end if;

  insert into public.oc_bookings
    (customer_id, service_name, category_name, status, address, lat, lng, total_price, scheduled_at)
  values
    (v_customer.id, p_service_name, 'Home Services', 'pending', trim(p_address), p_lat, p_lng, v_price, p_scheduled_at)
  returning * into v_booking;
  return v_booking;
end;
$$;

create or replace function public.oc_available_offers()
returns table(id uuid, service_name text, category_name text, total_price numeric, scheduled_at timestamptz, created_at timestamptz)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select b.id, b.service_name, b.category_name, b.total_price, b.scheduled_at, b.created_at
  from public.oc_bookings b
  where b.status in ('pending','matching')
    and exists (
      select 1 from public.oc_provider_profiles pp join public.oc_users u on u.id=pp.user_id
      where u.auth_id=auth.uid() and u.role='provider' and pp.background_check_status='passed' and pp.is_available
    )
  order by b.created_at
  limit 20;
$$;

create or replace function public.oc_accept_offer(p_booking_id uuid)
returns public.oc_bookings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_provider public.oc_provider_profiles%rowtype; v_booking public.oc_bookings%rowtype;
begin
  select pp.* into v_provider from public.oc_provider_profiles pp join public.oc_users u on u.id=pp.user_id
  where u.auth_id=auth.uid() and u.role='provider' and pp.background_check_status='passed' and pp.is_available;
  if not found then raise exception 'Approved available provider account required'; end if;
  update public.oc_bookings set provider_id=v_provider.id, status='assigned', updated_at=now()
  where id=p_booking_id and status in ('pending','matching') and provider_id is null returning * into v_booking;
  if not found then raise exception 'Offer is no longer available'; end if;
  return v_booking;
end;
$$;

create or replace function public.oc_provider_transition(p_booking_id uuid, p_status text)
returns public.oc_bookings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_provider_id uuid; v_current text; v_booking public.oc_bookings%rowtype;
begin
  select pp.id into v_provider_id from public.oc_provider_profiles pp join public.oc_users u on u.id=pp.user_id
  where u.auth_id=auth.uid() and u.role='provider' and pp.background_check_status='passed';
  if v_provider_id is null then raise exception 'Approved provider account required'; end if;
  select status into v_current from public.oc_bookings where id=p_booking_id and provider_id=v_provider_id for update;
  if not found then raise exception 'Assigned booking not found'; end if;
  if not ((v_current='assigned' and p_status='en_route') or (v_current='en_route' and p_status='on_site') or
          (v_current='on_site' and p_status='working') or (v_current='working' and p_status='completed')) then
    raise exception 'Invalid booking transition';
  end if;
  update public.oc_bookings set status=p_status, updated_at=now(),
    completed_at=case when p_status='completed' then now() else completed_at end
  where id=p_booking_id returning * into v_booking;
  return v_booking;
end;
$$;

create or replace function public.oc_customer_cancel(p_booking_id uuid)
returns public.oc_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_booking public.oc_bookings%rowtype;
begin
  update public.oc_bookings set status='canceled', canceled_at=now(), updated_at=now()
  where id=p_booking_id and customer_id=(select id from public.oc_users where auth_id=auth.uid())
    and status in ('pending','matching','assigned') returning * into v_booking;
  if not found then raise exception 'Booking cannot be canceled'; end if;
  return v_booking;
end; $$;

create or replace function public.oc_rate_booking(p_booking_id uuid, p_rating integer)
returns public.oc_bookings language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_booking public.oc_bookings%rowtype;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 through 5'; end if;
  update public.oc_bookings set rating=p_rating, updated_at=now()
  where id=p_booking_id and customer_id=(select id from public.oc_users where auth_id=auth.uid())
    and status='completed' and rating is null returning * into v_booking;
  if not found then raise exception 'Completed unrated booking not found'; end if;
  return v_booking;
end; $$;

revoke execute on function public.oc_request_service(text,text,double precision,double precision,timestamptz) from public, anon;
revoke execute on function public.oc_available_offers() from public, anon;
revoke execute on function public.oc_accept_offer(uuid) from public, anon;
revoke execute on function public.oc_provider_transition(uuid,text) from public, anon;
revoke execute on function public.oc_customer_cancel(uuid) from public, anon;
revoke execute on function public.oc_rate_booking(uuid,integer) from public, anon;
grant execute on function public.oc_request_service(text,text,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.oc_available_offers() to authenticated;
grant execute on function public.oc_accept_offer(uuid) to authenticated;
grant execute on function public.oc_provider_transition(uuid,text) to authenticated;
grant execute on function public.oc_customer_cancel(uuid) to authenticated;
grant execute on function public.oc_rate_booking(uuid,integer) to authenticated;
