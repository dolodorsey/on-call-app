alter table public.oc_provider_profiles
  add column if not exists stripe_account_api_version text,
  add column if not exists stripe_transfer_status text,
  add column if not exists stripe_requirements_due jsonb not null default '[]'::jsonb;

alter table public.sos_heroes
  add column if not exists stripe_connect_api_version text,
  add column if not exists stripe_transfer_status text,
  add column if not exists stripe_requirements_due jsonb not null default '[]'::jsonb;

comment on column public.oc_provider_profiles.stripe_transfer_status is 'Stripe Accounts v2 configuration.recipient.capabilities.stripe_balance.stripe_transfers.status';
comment on column public.sos_heroes.stripe_transfer_status is 'Stripe Accounts v2 configuration.recipient.capabilities.stripe_balance.stripe_transfers.status';