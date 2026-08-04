-- Prevent verification counts from being multiplied by service matches.

drop view if exists public.oc_provider_activation_readiness;
create view public.oc_provider_activation_readiness
with (security_invoker=true)
as
with service_counts as (
  select application_id,
         count(*)::integer as mapped_services,
         count(*) filter (where approved)::integer as approved_services
  from public.oc_application_service_matches
  group by application_id
), check_counts as (
  select application_id,
         count(*) filter (where required)::integer as required_checks,
         count(*) filter (where required and status='passed')::integer as passed_checks,
         coalesce(bool_and(case when required then status='passed' else true end),false) as verification_complete
  from public.oc_provider_verification_checks
  group by application_id
)
select a.id as application_id,
       a.application_number,
       a.first_name,
       a.last_name,
       a.email,
       a.city,
       a.state_code,
       a.status as application_status,
       coalesce(s.mapped_services,0) as mapped_services,
       coalesce(s.approved_services,0) as approved_services,
       coalesce(v.required_checks,0) as required_checks,
       coalesce(v.passed_checks,0) as passed_checks,
       coalesce(v.verification_complete,false) as verification_complete,
       p.id as provider_id,
       p.approval_status,
       p.stripe_onboarding_complete,
       p.activated_at
from public.oc_provider_applications a
left join service_counts s on s.application_id=a.id
left join check_counts v on v.application_id=a.id
left join public.oc_users u on lower(u.email)=lower(a.email)
left join public.oc_provider_profiles p on p.user_id=u.id;

revoke all on public.oc_provider_activation_readiness from anon,authenticated;
