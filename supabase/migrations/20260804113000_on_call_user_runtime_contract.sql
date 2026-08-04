-- Align oc_users with the runtime contract used by authenticated booking and CRM handoff.
alter table public.oc_users
  add column if not exists status text not null default 'active',
  add column if not exists ghl_contact_id text;

do $block$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='oc_users_status_check'
      and conrelid='public.oc_users'::regclass
  ) then
    alter table public.oc_users
      add constraint oc_users_status_check
      check(status in ('active','suspended','deleted'));
  end if;
end
$block$;

create index if not exists oc_users_active_auth_idx
  on public.oc_users(auth_id)
  where status='active';
create index if not exists oc_users_ghl_contact_idx
  on public.oc_users(ghl_contact_id)
  where ghl_contact_id is not null;
