create or replace function private.oc_customer_request_supply_guard()
returns trigger language plpgsql security definer set search_path='pg_catalog','public','private' as $$
declare v_customer_id uuid;
begin
 if auth.uid() is null then return new; end if;
 select id into v_customer_id from public.oc_users where auth_id=auth.uid() and role='customer' and status='active' limit 1;
 if v_customer_id is null or new.customer_id is distinct from v_customer_id then return new; end if;
 if new.service_id is null then raise exception 'ON CALL service catalog mapping is required before booking.' using errcode='P0001'; end if;
 if not exists(
   select 1 from public.oc_provider_profiles p
   join public.oc_provider_services ps on ps.provider_id=p.id and ps.service_id=new.service_id and ps.is_active
   where private.oc_provider_service_dispatch_ready(p.id,new.service_id)
 ) then
   raise exception 'ON CALL verified provider coverage is not active for this service yet. No booking was created.' using errcode='P0001';
 end if;
 return new;
end;$$;
revoke all on function private.oc_customer_request_supply_guard() from public,anon,authenticated;
drop trigger if exists oc_customer_request_requires_verified_supply on public.oc_bookings;
create trigger oc_customer_request_requires_verified_supply before insert on public.oc_bookings for each row execute function private.oc_customer_request_supply_guard();
