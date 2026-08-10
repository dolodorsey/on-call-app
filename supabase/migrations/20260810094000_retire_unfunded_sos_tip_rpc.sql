-- The current S.O.S. product has no mounted payment-backed tipping flow.
-- sos_add_tip only mutated mission data and did not create/adjust a Stripe charge,
-- so leaving it client-callable could create false financial/earnings data.
revoke execute on function public.sos_add_tip(uuid,numeric) from public,anon,authenticated,service_role;
