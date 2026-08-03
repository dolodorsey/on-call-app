alter table public.oc_provider_profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_onboarding_complete boolean not null default false;

create table if not exists public.oc_booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.oc_bookings(id) on delete restrict,
  customer_id uuid not null references public.oc_users(id) on delete restrict,
  provider_id uuid not null references public.oc_provider_profiles(id) on delete restrict,
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  amount_authorized integer not null check (amount_authorized > 0),
  amount_captured integer not null default 0 check (amount_captured >= 0),
  amount_refunded integer not null default 0 check (amount_refunded >= 0),
  platform_fee integer not null check (platform_fee >= 0),
  provider_amount integer not null check (provider_amount >= 0),
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  stripe_transfer_id text unique,
  status text not null default 'pending_authorization' check (status in (
    'pending_authorization','requires_action','authorized','capture_pending','captured',
    'transfer_pending','transferred','authorization_canceled','partially_refunded',
    'refunded','disputed','failed'
  )),
  failure_code text,
  failure_message text,
  authorized_at timestamptz,
  capture_by timestamptz,
  captured_at timestamptz,
  transferred_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee + provider_amount = amount_authorized),
  check (amount_captured <= amount_authorized),
  check (amount_refunded <= amount_captured)
);

create table if not exists public.oc_payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payment_id uuid references public.oc_booking_payments(id) on delete set null,
  livemode boolean not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.oc_booking_payments enable row level security;
alter table public.oc_payment_events enable row level security;

revoke all on public.oc_booking_payments from public, anon, authenticated;
revoke all on public.oc_payment_events from public, anon, authenticated;
grant select on public.oc_booking_payments to authenticated;

drop policy if exists "Customers read own booking payments" on public.oc_booking_payments;
create policy "Customers read own booking payments"
on public.oc_booking_payments for select to authenticated
using (customer_id = (select id from public.oc_users where auth_id = (select auth.uid()) and role = 'customer'));

drop policy if exists "Providers read assigned booking payments" on public.oc_booking_payments;
create policy "Providers read assigned booking payments"
on public.oc_booking_payments for select to authenticated
using (provider_id = (
  select pp.id from public.oc_provider_profiles pp
  join public.oc_users u on u.id = pp.user_id
  where u.auth_id = (select auth.uid()) and u.role = 'provider'
));

drop policy if exists "No client access to payment events" on public.oc_payment_events;
create policy "No client access to payment events"
on public.oc_payment_events for all to anon, authenticated
using (false) with check (false);

create index if not exists oc_booking_payments_status_idx on public.oc_booking_payments(status, created_at desc);
create index if not exists oc_booking_payments_provider_idx on public.oc_booking_payments(provider_id, created_at desc);
create index if not exists oc_payment_events_payment_idx on public.oc_payment_events(payment_id, processed_at desc);

comment on table public.oc_booking_payments is 'Server-written mission-specific Stripe lifecycle. Amounts are integer minor currency units.';
comment on column public.oc_booking_payments.capture_by is 'Authorization expiry supplied by Stripe; capture must occur before this time.';
