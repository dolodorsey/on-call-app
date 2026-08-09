-- Cover production foreign keys used by ON CALL and shared push delivery joins.
create index if not exists marketplace_push_deliveries_subscription_id_idx
  on public.marketplace_push_deliveries(subscription_id);

create index if not exists oc_booking_shares_customer_id_idx
  on public.oc_booking_shares(customer_id);

create index if not exists oc_provider_applications_reviewed_by_idx
  on public.oc_provider_applications(reviewed_by);
