# ON CALL Release Evidence

Brand: ON CALL (kept separate from S.O.S. and all other KHG brands)

## Verified in this release

- Production database project: `wfkohcwxxsrhcxhepfql`
- Customer identity is created as `customer`; browser-supplied provider roles are ignored.
- Email confirmation is no longer silently bypassed by the ON CALL signup trigger.
- Service prices are selected on the server from the supported ON CALL catalog.
- Customers cannot directly insert or mutate protected booking fields.
- Customers can read only their bookings; approved providers can read only accepted bookings.
- Available approved providers receive address-free offers and acceptance is atomic.
- Provider transitions are server-enforced: assigned → en route → on site → working → completed.
- Customer cancellation and ratings use ownership-checked server functions.
- Provider applications are validated, rate-limited by email, stored in a backend-only RLS table, and forwarded to automation from an Edge Function.
- The generic arbitrary-amount Stripe payment button is disabled until booking-specific invoices are implemented.
- Production web build passes.
- Production dependency audit reports zero known vulnerabilities.
- Invalid provider application test returns HTTP 400 with the expected CORS origin and creates no record.

## Deliberately not claimed complete

- Booking-specific Stripe authorization/capture/refund/payout is not live. It requires a newly rotated Stripe live key plus a webhook signing secret; the secret previously pasted into chat must not be used.
- A full authenticated customer/provider production run needs approved test accounts and a test inbox.
- App Store archive/signing was not performed in this release.
- The older broad TypeScript file has pre-existing strict-style typing failures, although the production Vite build succeeds.
