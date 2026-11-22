-- Read-only snapshot, not deployment authorization. Requires a trusted reader
-- with visibility of all application rows. Never expose as a public endpoint.
begin read only;
set local statement_timeout = '10s';
set local row_security = off;
with counts as (
 select count(*) total_rows,
 count(*) filter(where email is null) null_emails,
 count(*) filter(where trim(email)='') blank_emails,
 count(*) filter(where status in ('submitted','reviewing','approved')) active_rows
 from public.oc_provider_applications
), duplicates as (
 select count(*) groups, coalesce(sum(n-1),0) excess_rows from (
 select count(*) n from public.oc_provider_applications
 where status in ('submitted','reviewing','approved') and email is not null
 group by lower(trim(email)) having count(*)>1
 ) d
), named_index as (
 select c.relkind, i.indisunique, i.indisvalid, i.indisready, i.indislive,
 i.indrelid::regclass::text as indexed_table,
 case when i.indexrelid is not null then pg_get_indexdef(i.indexrelid) end definition
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 left join pg_index i on i.indexrelid=c.oid
 where n.nspname='public' and c.relname='oc_provider_applications_active_email_unique'
)
select jsonb_build_object(
 'observed_at',statement_timestamp(), 'server_version',current_setting('server_version'),
 'counts',(select to_jsonb(c) from counts c),
 'active_duplicates',(select to_jsonb(d) from duplicates d),
 'named_index',(select to_jsonb(i) from named_index i),
 'release_authorized',false,
 'interpretation','Snapshot only. Inspect index table, definition and flags; name existence does not prove protection. Counts may change after this read. Missing privileges or RLS filtering must fail, not report zero.'
) as evidence;
rollback;
