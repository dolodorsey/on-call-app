create or replace function private.oc_provider_core_dispatch_ready(p_provider_id uuid)
returns boolean language sql stable security definer set search_path='pg_catalog','public','private' as $$
  select coalesce((select u.role='provider' and u.status='active' and u.auth_id is not null and p.approval_status='active'
    and p.stripe_onboarding_complete and p.stripe_payouts_enabled and a.status='approved'
    and not exists(select 1 from public.oc_provider_verification_checks v where v.application_id=a.id and v.required and v.check_type in ('identity','background','skills','service_area') and v.status<>'passed')
    and not exists(select 1 from public.oc_provider_verification_checks v where v.application_id=a.id and v.required and v.check_type='vehicle' and v.status not in ('passed','waived'))
  from public.oc_provider_profiles p join public.oc_users u on u.id=p.user_id join public.oc_provider_applications a on a.id=p.provider_application_id where p.id=p_provider_id),false)
$$;
