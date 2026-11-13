-- LOCAL PROPOSAL ONLY; not a deployment migration. Requires null/blank-email and operator UX review.
create unique index oc_provider_applications_active_email_unique on public.oc_provider_applications(lower(trim(email))) where status in ('submitted','reviewing','approved');
