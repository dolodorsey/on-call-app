-- REVIEW ONLY: not deployed or in automatic migrations. Existing NOT NULL remains.
alter table public.oc_provider_applications add constraint oc_provider_applications_email_nonblank check (email ~ '[^[:space:]]') not valid;
alter table public.oc_provider_applications validate constraint oc_provider_applications_email_nonblank;
