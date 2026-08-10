-- Retire the pre-settlement cancellation RPC. The production customer flow uses
-- oc-cancel-booking -> oc_customer_cancellation_quote -> oc_customer_cancel_v2,
-- which enforces fees, provider compensation, policy versioning, offer cleanup,
-- payment settlement, and audit events.
revoke execute on function public.oc_customer_cancel(uuid) from public, anon, authenticated, service_role;
