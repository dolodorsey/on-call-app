-- Read-only service catalog export used by internal supply operations.
-- Returns public service metadata only; no provider, customer, or operational secrets.

create or replace function public.oc_get_public_service_catalog()
returns jsonb
language sql
stable
security definer
set search_path='pg_catalog','public'
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,
  'category_id',category_id,
  'name',name,
  'description',description,
  'base_price',base_price,
  'pricing_unit',pricing_unit,
  'duration_minutes',duration_minutes,
  'on_demand_available',on_demand_available,
  'scheduled_available',scheduled_available,
  'recurring_available',recurring_available,
  'tags',tags,
  'sort_order',sort_order,
  'updated_at',updated_at
) order by category_id,sort_order,name),'[]'::jsonb)
from public.oc_service_catalog
where is_active;
$$;

revoke all on function public.oc_get_public_service_catalog() from public;
grant execute on function public.oc_get_public_service_catalog() to anon,authenticated;
