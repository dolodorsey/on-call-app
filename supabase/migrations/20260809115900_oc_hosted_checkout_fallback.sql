alter table public.oc_booking_payments
  add column if not exists stripe_checkout_session_id text;

create unique index if not exists oc_booking_payments_checkout_session_uidx
  on public.oc_booking_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
