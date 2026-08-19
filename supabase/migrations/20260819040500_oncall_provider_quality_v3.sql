-- ON CALL provider intelligence v3.
-- Qualification and live availability remain hard gates in oc_dispatch_one_booking.
-- This override narrows proximity to a tie-shaping signal instead of a recommendation authority.

create or replace function private.oc_match_score(
  p_distance_miles numeric,
  p_radius_miles numeric,
  p_rating numeric,
  p_total_jobs integer
)
returns numeric
language sql
immutable
set search_path to 'pg_catalog','private'
as $function$
  select round(
      least(100,greatest(0,coalesce(p_rating,5)/5.0*100))*0.50
    + least(100,greatest(0,coalesce(p_total_jobs,0)::numeric*2))*0.45
    + greatest(0,100-(coalesce(p_distance_miles,0)/greatest(coalesce(p_radius_miles,15),1))*100)*0.05
  ,1);
$function$;

comment on function private.oc_match_score(numeric,numeric,numeric,integer) is
'ON CALL provider-quality-first v3: customer quality 50%, proven completed-job experience 45%, proximity 5%. Provider qualification, service readiness, on-duty state and fresh location remain hard eligibility gates.';
