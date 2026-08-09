# ON CALL Release Evidence

## Product boundary

- Public product: **ON CALL**.
- Repository: `dolodorsey/on-call-app`.
- Primary domain: `https://oncallallday.com`.
- Production Supabase project: `cxdqkjvtpilvouwtbgdy`.
- Product database namespace: `oc_*` only. Shared infrastructure with S.O.S. does not merge product ownership or public branding.

## Current production data — August 9, 2026

- 12 active service categories.
- 72 active catalog services.
- 0 ON CALL users.
- 0 provider applications.
- 0 provider profiles.
- 0 bookings.
- 0 booking payments.

Those zero marketplace counts are reported as **market activation state**, not as proof that the software lifecycle is absent.

## Software lifecycle proven without fabricating customer history

A disposable database marketplace simulation was executed against the production schema without calling Stripe and without preserving QA rows. It proved:

1. A pending ON CALL request entered dispatch.
2. Dispatch created exactly one exclusive provider lease.
3. The leased provider accepted atomically and the booking became `assigned`.
4. Starting travel without customer payment authorization was rejected.
5. Adding an authorized payment state unlocked `en_route`.
6. QA fixture cleanup was verified after the simulation.

This evidence is recorded separately in the private release-evidence ledger and is **not** counted as a real customer transaction.

## Marketplace controls currently implemented

- Customer signup/profile and catalog browsing.
- Market-aware service requests using server-owned catalog pricing.
- Provider application and approval activation flow.
- Approved-service mapping and payout/readiness gate.
- Ranked provider matching with exclusive expiring leased offers.
- Provider accept/decline and automatic offer expiry/reassignment.
- Scheduled-job dispatch window and expanding search radius.
- Exact customer location/details withheld until provider acceptance.
- Provider GPS presence and participant-safe live customer tracking.
- Customer/provider booking chat and persistent notifications.
- Customer payment authorization required before provider travel.
- Server-enforced job transitions: `assigned → en_route → on_site → working → completed`.
- Completion uses idempotent Stripe capture logic and provider payout lifecycle.
- Config-driven late cancellation and customer no-show settlement.
- Provider release/reassignment, start watchdog, stale-GPS warning/escalation, incidents, reliability review, and fee-review workflows.
- Provider earnings are ledger-backed; exceptional settlements are identified separately from normal service revenue.

## Automated verification

`npm run verify` now requires all of the following:

- TypeScript type-check.
- Node automated regression tests.
- Production Vite build.
- Critical production dependency audit.

The regression suite covers the dedicated Provider Command route, payment-gated completion, cancellation/no-show settlement contracts, leased-offer dispatch, desktop shell/layout regressions, desktop readability, shared-backend project pinning, and removal of n8n from the active client lifecycle.

The stricter gate exposed compile errors that the earlier build-only standard had missed; those errors were fixed rather than excluded from verification.

## UI verification

- The prior production stylesheet incorrectly constrained root product surfaces to a 460px phone shell on desktop. That blanket selector was removed.
- The final, last-loaded desktop rescue stylesheet explicitly makes the customer marketplace and Provider Command full-width while keeping authentication appropriately focused.
- Desktop service/card/metadata typography was increased so the desktop product no longer inherits 7–11px phone-scale copy.
- The exact CSS bundle served by `oncallallday.com` was fetched after deployment and contains these final overrides.

A full external Chromium screenshot session is not claimed here because outbound browser networking is unavailable in the current verification environment. Bundle-level production verification, HTTP route checks, CI, database lifecycle tests, and runtime logging are used instead.

## Shared-backend isolation

The server-only namespace audit currently reports:

- zero `oc_* ↔ sos_*` foreign keys;
- zero public ON CALL/S.O.S. product tables with RLS disabled;
- zero anonymous/public direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables;
- zero cross-prefix database-function references.

Anonymous execution was also removed from the provider leased-offer SECURITY DEFINER RPC.

## Release hygiene

A private release-hygiene audit now fails if `qa-*`, `example.invalid`, or QA-address fixtures remain in ON CALL/S.O.S. marketplace tables. Existing stale QA fixtures found during this repair were removed. Current hygiene result: zero QA fixtures.

## Not claimed

- ON CALL is **not market-proven yet**: there are no real customers, approved providers, completed bookings, ratings, or live payment history in the ON CALL marketplace.
- No fake production booking, rating, earnings history, or Stripe charge is retained to make the marketplace look active.
- A real live-money transaction still requires a real approved payout-ready provider and customer payment method.
- Store distribution status is separate from web/software readiness and should be evaluated from the current iOS/Android release workflows rather than inferred from web deployment status.
