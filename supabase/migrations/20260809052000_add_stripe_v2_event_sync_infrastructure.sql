create table if not exists private.marketplace_stripe_v2_events (
  event_id text primary key,
  event_type text not null,
  account_id text,
  livemode boolean,
  processed_at timestamptz not null default now()
);

create table if not exists private.marketplace_runtime_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.marketplace_store_runtime_secret(p_name text,p_value text,p_description text default null)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','vault' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if coalesce(length(trim(p_name)),0)=0 or coalesce(length(p_value),0)=0 then raise exception 'Secret name and value are required'; end if;
  select id into v_id from vault.secrets where name=p_name order by created_at desc limit 1;
  if v_id is null then perform vault.create_secret(p_value,p_name,coalesce(p_description,'Marketplace runtime secret'),null);
  else perform vault.update_secret(v_id,p_value,p_name,coalesce(p_description,'Marketplace runtime secret'),null); end if;
  return true;
end;$$;
revoke all on function public.marketplace_store_runtime_secret(text,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_store_runtime_secret(text,text,text) to service_role;

create or replace function public.marketplace_operator_check()
returns boolean language sql security definer set search_path='pg_catalog','public','private' as $$
  select exists(select 1 from private.marketplace_operators where auth_id=auth.uid() and is_active=true)
$$;
revoke all on function public.marketplace_operator_check() from public,anon;
grant execute on function public.marketplace_operator_check() to authenticated;

create or replace function public.marketplace_record_stripe_v2_event(p_event_id text,p_event_type text,p_account_id text,p_livemode boolean)
returns boolean language plpgsql security definer set search_path='pg_catalog','private' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  insert into private.marketplace_stripe_v2_events(event_id,event_type,account_id,livemode)
  values(p_event_id,p_event_type,p_account_id,p_livemode) on conflict(event_id) do nothing;
  return found;
end;$$;
revoke all on function public.marketplace_record_stripe_v2_event(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.marketplace_record_stripe_v2_event(text,text,text,boolean) to service_role;