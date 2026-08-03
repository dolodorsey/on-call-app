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
- Booking-specific Stripe Connect infrastructure is deployed: manual authorization, completion-gated capture, separate provider transfer, cancellation, refunds/disputes status, signed webhook processing, and event idempotency.
- Customer Wallet now reads real bookings and payment states, offers exact-price card authorization only after provider acceptance, and supports eligible cancellation and post-completion ratings.
- Provider earnings now use recorded transfers rather than simulated totals; Connect onboarding and payout readiness are wired to the approved provider profile.
- Fabricated booking history, card details, payout totals, ratings, testimonials, and performance claims were removed from the interface.
- Production web build passes.
- Production dependency audit reports zero known vulnerabilities.
- Capacitor iOS and Android projects are upgraded to 8.5 and synchronized from the verified production web build.
- The iOS simulator target builds successfully on Xcode with the ON CALL app identifier and approved icon assets.
- A complete Android project now exists with ON CALL launcher artwork and the required customer-location permissions.
- The main application now passes its TypeScript check; the earlier strict-style typing failures have been resolved.
- Booking/payment tables have RLS enabled; customers and assigned providers can read only their own payment records, while all writes remain server-only.
- Unauthenticated payment-function call returns HTTP 401 and an invalid webhook signature returns HTTP 400.
- Invalid provider application test returns HTTP 400 with the expected CORS origin and creates no record.

## Deliberately not claimed complete

- The payment code and database lifecycle are live, but money movement remains intentionally unavailable until a newly rotated Stripe live key, publishable key, and webhook signing secret are configured. The secret previously pasted into chat must not be used.
- A full authenticated customer/provider production run needs approved test accounts and a test inbox.
- Signed App Store/Play Store archives were not performed in this release.
- Android compilation remains a workstation gate until the required Android SDK and Java toolchain are installed; the Android project itself is generated and synchronized.
