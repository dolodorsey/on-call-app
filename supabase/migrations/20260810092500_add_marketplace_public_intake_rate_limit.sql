create table if not exists public.marketplace_intake_rate_limits (
  id bigint generated always as identity primary key,
  app text not null check (app in ('on_call_provider','sos_hero')),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_intake_rate_limits_lookup_idx
  on public.marketplace_intake_rate_limits(app,ip_hash,created_at desc);

alter table public.marketplace_intake_rate_limits enable row level security;
revoke all on public.marketplace_intake_rate_limits from public,anon,authenticated;
grant select,insert,delete on public.marketplace_intake_rate_limits to service_role;

create or replace function public.marketplace_consume_intake_rate_limit(
  p_app text,
  p_ip_hash text,
  p_limit integer default 5,
  p_window_minutes integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $function$
declare
  v_count integer;
  v_limit integer:=greatest(1,least(coalesce(p_limit,5),50));
  v_window integer:=greatest(1,least(coalesce(p_window_minutes,60),1440));
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_app not in ('on_call_provider','sos_hero') then raise exception 'Invalid intake app'; end if;
  if p_ip_hash is null or length(p_ip_hash)<32 then raise exception 'Invalid intake source'; end if;

  delete from public.marketplace_intake_rate_limits where created_at < now()-interval '24 hours';
  select count(*) into v_count from public.marketplace_intake_rate_limits
    where app=p_app and ip_hash=p_ip_hash and created_at >= now()-make_interval(mins=>v_window);
  if v_count >= v_limit then
    return jsonb_build_object('allowed',false,'remaining',0,'limit',v_limit,'window_minutes',v_window);
  end if;
  insert into public.marketplace_intake_rate_limits(app,ip_hash) values(p_app,p_ip_hash);
  return jsonb_build_object('allowed',true,'remaining',greatest(0,v_limit-v_count-1),'limit',v_limit,'window_minutes',v_window);
end
$function$;

revoke execute on function public.marketplace_consume_intake_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.marketplace_consume_intake_rate_limit(text,text,integer,integer) to service_role;
