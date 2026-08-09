alter table public.oc_booking_offers enable row level security;

drop policy if exists oc_booking_offers_provider_read on public.oc_booking_offers;
create policy oc_booking_offers_provider_read
on public.oc_booking_offers
for select
to authenticated
using (provider_id = private.oc_current_provider_id());

grant select on table public.oc_booking_offers to authenticated;
revoke insert,update,delete,truncate,references,trigger on table public.oc_booking_offers from authenticated;
revoke all on table public.oc_booking_offers from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='oc_booking_offers'
  ) then
    alter publication supabase_realtime add table public.oc_booking_offers;
  end if;
end$$;
