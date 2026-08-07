# ON CALL Release Evidence

Brand: ON CALL (kept separate from S.O.S. and all other KHG brands)

## Verified in this release

- Production database project: `wfkohcwxxsrhcxhepfql`.
- Production web domain: `https://oncallallday.com`.
- The live marketplace catalog contains 12 categories and 72 active services.
- Customer identity is created as `customer`; browser-supplied provider roles are ignored.
- Signup is confirmation-safe: a new account that requires email verification is no longer followed by an immediate password sign-in attempt. The UI tells the customer to confirm email and then sign in.
- Email confirmation is no longer silently bypassed by the ON CALL signup trigger.
- Service prices are selected on the server from the supported ON CALL catalog.
- Customer booking requests are now market-aware and supply-gated. A booking is not created unless its ON CALL city/state is supported and verified provider supply exists for that exact service and market.
- On-demand booking requires an on-duty verified provider. Scheduled or recurring booking requires approved provider supply.
- Legacy booking RPCs that could bypass the market supply gate are no longer executable by anonymous or authenticated app users.
- Provider profiles now carry their verified application market, and provider offers/acceptance are restricted to matching booking markets and approved services.
- Customers cannot directly insert or mutate protected booking fields.
- Customers can read only their bookings; approved providers can read only accepted bookings.
- Available approved providers receive address-free offers and acceptance is atomic.
- Provider transitions are server-enforced: assigned → en route → on site → working → completed.
- Customer cancellation and ratings use ownership-checked server functions.
- Provider applications are validated, rate-limited by email, stored in a backend-only RLS table, and forwarded to automation from an Edge Function.
- The provider sourcing system already contains 3,000 ON CALL recruiting candidates. 113 qualified, contactable Atlanta prospects are now copied into the ON CALL recruitment funnel as `sourced` and marked outreach-ready; none are falsely marked contacted.
- Booking-specific Stripe Connect infrastructure is deployed: manual authorization, completion-gated capture, separate provider transfer, cancellation, refunds/disputes status, signed webhook processing, and event idempotency.
- Customer Wallet reads real bookings and payment states, offers exact-price card authorization only after provider acceptance, and supports eligible cancellation and post-completion ratings.
- Provider earnings use recorded transfers rather than simulated totals; Connect onboarding and payout readiness are wired to the approved provider profile.
- Fabricated booking history, card details, payout totals, ratings, testimonials, and performance claims were removed from the interface.
- Customer-facing availability copy now distinguishes catalog eligibility from verified live provider coverage, and unfinished profile controls are not exposed as dead buttons.
- Production web build passes and the latest Vercel production deployment is READY.
- Current Vercel runtime audit shows no production runtime errors in the checked window.
- Production dependency audit reports zero known vulnerabilities.
- Capacitor iOS and Android projects are upgraded to 8.5 and synchronized from the verified production web build.
- The iOS simulator target builds successfully on Xcode with the ON CALL app identifier and approved icon assets.
- A distribution-signed App Store Connect IPA exports successfully for `com.khg.oncallapp` with team `AFU6P8WW9K`; its recorded SHA-256 is `7b22bb32d71951354e8e446642ae920244644d8475927b7d3065b5627d5dbf89`.
- A complete Android project exists with ON CALL launcher artwork and the required customer-location permissions.
- The main application passes its TypeScript check.
- Booking/payment tables have RLS enabled; customers and assigned providers can read only their own payment records, while all writes remain server-only.
- Unauthenticated payment-function call returns HTTP 401 and an invalid webhook signature returns HTTP 400.
- Invalid provider application test returns HTTP 400 with the expected CORS origin and creates no record.

## Current activation state

- ON CALL has 33 user records, 12 service categories and 72 active services in the production database.
- There are currently 0 provider applications, 0 provider profiles, 0 approved providers, 0 on-duty providers, 0 bookings and 0 payment events in the production marketplace.
- The 720 service/market readiness rows are therefore correctly classified as `no_approved_supply`; the app now fails closed instead of creating unfulfillable bookings.
- 113 qualified Atlanta provider prospects are staged for outreach. They remain `queued` until outreach is actually sent and a prospect responds or applies.

## Deliberately not claimed complete

- Marketplace activation is not complete until real providers apply, pass required verification, finish Stripe Connect onboarding, map to supported services and go on duty.
- The payment code and database lifecycle are live, but production money movement still depends on valid live Stripe configuration and a real provider/customer transaction; no fake payment is used as proof.
- A full authenticated customer/provider production run still requires at least one approved, payout-ready provider and a real or controlled end-to-end transaction.
- The App Store IPA is export-verified but has not been uploaded to App Store Connect; Play Store signing remains pending the Android release toolchain.
- Android compilation remains a workstation gate until the required Android SDK and Java toolchain are installed; the Android project itself is generated and synchronized.
