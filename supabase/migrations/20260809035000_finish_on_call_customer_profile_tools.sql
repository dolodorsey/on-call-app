create or replace function public.oc_upsert_saved_address(p_address_id uuid default null,p_label text default null,p_address text default null,p_city text default null,p_state_code text default null,p_zip_code text default null,p_lat numeric default null,p_lng numeric default null,p_is_default boolean default false)
returns public.oc_saved_addresses language plpgsql security definer set search_path='pg_catalog','public','private'
as $function$
declare v_user uuid:=private.oc_current_user_id(); v_row public.oc_saved_addresses%rowtype;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authenticated ON CALL customer required' using errcode='42501'; end if;
  if coalesce(length(trim(p_label)),0)<1 then raise exception 'Address label is required'; end if;
  if coalesce(length(trim(p_address)),0)<3 then raise exception 'Full address is required'; end if;
  if p_lat is not null and (p_lat<-90 or p_lat>90) then raise exception 'Invalid latitude'; end if;
  if p_lng is not null and (p_lng<-180 or p_lng>180) then raise exception 'Invalid longitude'; end if;
  if coalesce(p_is_default,false) then update public.oc_saved_addresses set is_default=false,updated_at=now() where user_id=v_user and is_default and (p_address_id is null or id<>p_address_id); end if;
  if p_address_id is null then
    insert into public.oc_saved_addresses(user_id,label,address,city,state_code,zip_code,lat,lng,is_default,created_at,updated_at)
    values(v_user,left(trim(p_label),80),left(trim(p_address),500),left(nullif(trim(p_city),''),120),upper(left(nullif(trim(p_state_code),''),2)),left(nullif(trim(p_zip_code),''),16),p_lat,p_lng,coalesce(p_is_default,false),now(),now()) returning * into v_row;
  else
    update public.oc_saved_addresses set label=left(trim(p_label),80),address=left(trim(p_address),500),city=left(nullif(trim(p_city),''),120),state_code=upper(left(nullif(trim(p_state_code),''),2)),zip_code=left(nullif(trim(p_zip_code),''),16),lat=p_lat,lng=p_lng,is_default=coalesce(p_is_default,false),updated_at=now()
    where id=p_address_id and user_id=v_user returning * into v_row;
    if not found then raise exception 'Saved address not found' using errcode='P0002'; end if;
  end if;
  if not exists(select 1 from public.oc_saved_addresses where user_id=v_user and is_default) then update public.oc_saved_addresses set is_default=true,updated_at=now() where id=v_row.id returning * into v_row; end if;
  return v_row;
end;$function$;

create or replace function public.oc_delete_saved_address(p_address_id uuid)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','private'
as $function$
declare v_user uuid:=private.oc_current_user_id(); v_default boolean:=false; v_count integer:=0; v_next uuid;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select is_default into v_default from public.oc_saved_addresses where id=p_address_id and user_id=v_user;
  if not found then raise exception 'Saved address not found' using errcode='P0002'; end if;
  delete from public.oc_saved_addresses where id=p_address_id and user_id=v_user; get diagnostics v_count=row_count;
  if v_count=1 and v_default then select id into v_next from public.oc_saved_addresses where user_id=v_user order by created_at limit 1; if v_next is not null then update public.oc_saved_addresses set is_default=true,updated_at=now() where id=v_next; end if; end if;
  return v_count=1;
end;$function$;

create or replace function public.oc_set_default_address(p_address_id uuid)
returns public.oc_saved_addresses language plpgsql security definer set search_path='pg_catalog','public','private'
as $function$
declare v_user uuid:=private.oc_current_user_id(); v_row public.oc_saved_addresses%rowtype;
begin
  if auth.uid() is null or v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.oc_saved_addresses where id=p_address_id and user_id=v_user) then raise exception 'Saved address not found' using errcode='P0002'; end if;
  update public.oc_saved_addresses set is_default=false,updated_at=now() where user_id=v_user and is_default;
  update public.oc_saved_addresses set is_default=true,updated_at=now() where id=p_address_id and user_id=v_user returning * into v_row;
  return v_row;
end;$function$;

revoke insert,update,delete,references,trigger on public.oc_saved_addresses from authenticated;
revoke insert,update,delete,references,trigger on public.oc_recurring_schedules from authenticated;
grant select on public.oc_saved_addresses,public.oc_recurring_schedules to authenticated;
revoke all on function public.oc_upsert_saved_address(uuid,text,text,text,text,text,numeric,numeric,boolean) from public,anon;
revoke all on function public.oc_delete_saved_address(uuid) from public,anon;
revoke all on function public.oc_set_default_address(uuid) from public,anon;
grant execute on function public.oc_upsert_saved_address(uuid,text,text,text,text,text,numeric,numeric,boolean) to authenticated;
grant execute on function public.oc_delete_saved_address(uuid) to authenticated;
grant execute on function public.oc_set_default_address(uuid) to authenticated;