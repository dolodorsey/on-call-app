create or replace function public.oc_provider_transition(p_booking_id uuid, p_status text)
returns public.oc_bookings
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_provider_id uuid;
  v_current text;
  v_payment_status text;
  v_booking public.oc_bookings%rowtype;
begin
  select pp.id into v_provider_id
  from public.oc_provider_profiles pp
  join public.oc_users u on u.id=pp.user_id
  where u.auth_id=auth.uid() and u.role='provider' and pp.background_check_status='passed';
  if v_provider_id is null then raise exception 'Approved provider account required'; end if;

  select status into v_current
  from public.oc_bookings
  where id=p_booking_id and provider_id=v_provider_id
  for update;
  if not found then raise exception 'Assigned booking not found'; end if;

  if v_current='assigned' and p_status='en_route' then
    select status into v_payment_status from public.oc_booking_payments where booking_id=p_booking_id;
    if v_payment_status is distinct from 'authorized' then
      raise exception 'Customer payment authorization is required before travel';
    end if;
  end if;

  if not ((v_current='assigned' and p_status='en_route') or
          (v_current='en_route' and p_status='on_site') or
          (v_current='on_site' and p_status='working') or
          (v_current='working' and p_status='completed')) then
    raise exception 'Invalid booking transition';
  end if;

  update public.oc_bookings
  set status=p_status,
      updated_at=now(),
      completed_at=case when p_status='completed' then now() else completed_at end
  where id=p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

revoke execute on function public.oc_provider_transition(uuid,text) from public, anon;
grant execute on function public.oc_provider_transition(uuid,text) to authenticated;
