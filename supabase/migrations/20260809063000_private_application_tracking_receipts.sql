alter table public.oc_provider_applications add column if not exists status_token_hash text;
create unique index if not exists oc_provider_applications_status_token_hash_idx on public.oc_provider_applications(status_token_hash) where status_token_hash is not null;
comment on column public.oc_provider_applications.status_token_hash is 'SHA-256 of the applicant-only tracking receipt token. Raw token is never stored.';
