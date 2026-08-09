create or replace function public.oc_booking_partner_contact(p_booking_id uuid)
returns table(partner_name text, phone text, phone_verified boolean, can_call boolean)
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_me uuid;
  v_role text;
begin
  select id, role into v_me, v_role
  from public.oc_users
  where auth_id=auth.uid() and status='active'
  limit 1;

  if v_me is null then
    raise exception 'Active ON CALL account required' using errcode='42501';
  end if;

  if v_role='customer' then
    return query
    select
      coalesce(nullif(trim(concat_ws(' ',u.first_name,u.last_name)),''), nullif(trim(u.full_name),''), 'ON CALL Provider')::text,
      u.phone,
      coalesce(u.phone_verified,false),
      (u.phone is not null and length(regexp_replace(u.phone,'[^0-9+]','','g')) >= 7 and coalesce(u.phone_verified,false))
    from public.oc_bookings b
    join public.oc_provider_profiles p on p.id=b.provider_id
    join public.oc_users u on u.id=p.user_id
    where b.id=p_booking_id
      and b.customer_id=v_me
      and b.provider_id is not null
      and b.status in ('assigned','en_route','on_site','working')
    limit 1;
  elsif v_role='provider' then
    return query
    select
      coalesce(nullif(trim(concat_ws(' ',u.first_name,u.last_name)),''), nullif(trim(u.full_name),''), 'ON CALL Customer')::text,
      u.phone,
      coalesce(u.phone_verified,false),
      (u.phone is not null and length(regexp_replace(u.phone,'[^0-9+]','','g')) >= 7 and coalesce(u.phone_verified,false))
    from public.oc_bookings b
    join public.oc_provider_profiles p on p.id=b.provider_id
    join public.oc_users u on u.id=b.customer_id
    where b.id=p_booking_id
      and p.user_id=v_me
      and b.status in ('assigned','en_route','on_site','working')
    limit 1;
  else
    raise exception 'Booking participant access required' using errcode='42501';
  end if;
end;
$$;

revoke all on function public.oc_booking_partner_contact(uuid) from public, anon;
grant execute on function public.oc_booking_partner_contact(uuid) to authenticated;
