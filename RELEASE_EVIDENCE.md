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

Those zero marketplace counts are **market activation state**, not proof that the software lifecycle is absent.

## Software lifecycle proven without fabricating customer history

A disposable database marketplace simulation was executed against the production schema without calling Stripe and without preserving QA rows. It proved:

1. A pending ON CALL request entered dispatch.
2. Dispatch created exactly one exclusive provider lease.
3. The leased provider accepted atomically and the booking became `assigned`.
4. Starting travel without customer payment authorization was rejected.
5. Adding an authorized payment state unlocked `en_route`.
6. QA fixture cleanup was verified after the simulation.

A second disposable provider-verification simulation proved the provider activation boundary:

1. Application approval left `background_check_status = pending`; approval no longer fabricates clearance.
2. Approved-but-unverified provider core readiness remained `false`.
3. Passing identity, background, skills, and service-area checks unlocked an ordinary approved cleaning service.
4. Plumbing remained blocked because that service requires conditional license and insurance verification.
5. Passing license + insurance made plumbing dispatch-ready.
6. The entire verification simulation rolled back and left zero auth/user/application/provider QA rows.

This evidence is release QA and is **not** counted as real marketplace activity.

## Provider verification model

Application approval now means **workspace access**, not “verified provider.” A provider may enter Provider Command after an approved same-email activation, but actual dispatch uses a separate verification ledger.

Required core checks:

- identity;
- background;
- skills;
- service area;
- vehicle when the application says a vehicle is required.

Core identity/background/skills/service-area checks cannot be waived.

License and insurance are service-specific. Services such as plumbing, electrical, HVAC, notary, massage and other regulated/risk-bearing categories require the applicable check before that service can dispatch. Conditional requirements can be explicitly waived only when an operator determines the requirement legitimately does not apply.

The same server-side readiness helpers govern:

- going online;
- provider opportunity visibility;
- active leased offers;
- offer acceptance;
- dispatcher provider selection;
- Provider Command readiness counts.

`/ops` contains an operator verification queue for review/pass/fail of real provider checks. Provider Command shows the same database-backed readiness state and suppresses the old generic “go online” control until at least one approved service is genuinely dispatch-ready.

## Private verification documents

Provider verification evidence is now handled inside the product rather than through an off-platform document handoff.

- Supabase Storage bucket: `marketplace-verification`.
- Bucket is private (`public = false`).
- Maximum file size: 10 MB.
- Allowed types: PDF, JPEG, PNG, WebP, HEIC, HEIF.
- Providers can upload only into their authenticated path: `on_call/<auth-user>/<application>/<check>/...`.
- Other providers cannot browse those files.
- Active marketplace operators may read verification evidence through authenticated policy only.
- Operator review UI creates **5-minute signed URLs**; no permanent/public evidence URL is stored or shown.
- Evidence paths are attached to the corresponding verification ledger row.
- Uploading evidence moves a non-passed check to `submitted`; it **never auto-passes** identity, background, license, insurance, skills, service-area, or vehicle verification.
- No update/delete Storage policy is granted to providers, preserving the submitted-evidence audit trail.

The live bucket/privacy/policy configuration and authenticated-only evidence RPC grants have been verified directly in production.

## Marketplace controls currently implemented

- Customer signup/profile and catalog browsing.
- Market-aware service requests using server-owned catalog pricing.
- Provider application and approved-account activation flow.
- Real provider verification ledger and service-specific credential gates.
- Private in-product verification evidence uploads and operator evidence review.
- Approved-service mapping and Stripe payout readiness gate.
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
- Customer profile tools are functional for saved addresses, payment methods, and recurring services.

## Automated verification

`npm run verify` requires:

- TypeScript type-check;
- Node automated regression tests;
- production Vite build;
- critical production dependency audit.

Regression coverage includes:

- dedicated Provider Command routing;
- payment-gated completion;
- cancellation/no-show settlement contracts;
- leased-offer dispatch;
- provider application/verification separation;
- authenticated provider identity requirement;
- central service-aware dispatch-readiness reuse;
- operator/provider verification UIs;
- private verification bucket/path restrictions;
- evidence submission cannot auto-pass a check;
- short-lived signed operator evidence links;
- desktop shell/layout and readability regressions;
- shared-backend project pinning;
- active lifecycle independence from n8n.

The stricter gate exposed compile errors that the earlier build-only standard had missed; those errors were fixed rather than excluded.

## UI verification

- The prior production stylesheet incorrectly constrained root product surfaces to a 460px phone shell on desktop. That blanket selector was removed.
- The final desktop rescue stylesheet explicitly makes the customer marketplace and Provider Command full-width while keeping authentication appropriately focused.
- Desktop service/card/metadata typography was increased so desktop no longer inherits phone-scale copy.
- Customer profile tools, Provider Command readiness, provider evidence uploads, operator verification controls, and signed evidence review are mounted in the production build.

## Shared-backend isolation

The server-only namespace audit currently reports:

- zero `oc_* ↔ sos_*` foreign keys;
- zero public product tables with RLS disabled;
- zero anonymous/public direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables;
- zero authenticated TRUNCATE grants;
- zero cross-prefix database-function references.

Anonymous execution is removed from leased-offer/security-definer provider paths.

## Release hygiene

A private release-hygiene audit fails if `qa-*`, `example.invalid`, or QA-address fixtures remain in ON CALL/S.O.S. marketplace tables. Current result: **zero QA fixtures**.

## Payment/runtime truth

The production `marketplace-payments-health` endpoint currently returns **HTTP 503**:

- `ready: false`
- `stripe_server_credential: false`
- `webhook_signature_secret: true`
- Stripe credential source: missing
- webhook credential source: Vault

Therefore live charges, captures, provider payout onboarding, and transfers remain intentionally fail-closed before Stripe is called. The software lifecycle is ready for the credential, but the missing authorized Stripe server secret is not something application code can manufacture.

## Not claimed

- ON CALL is **not market-proven yet**: there are no real customers, provider applications, approved dispatch-ready providers, completed bookings, ratings, or live payment history.
- No fake production booking, provider, verification, rating, earnings history, or Stripe charge is retained to make the marketplace look active.
- A real live-money transaction still requires the authorized Stripe server credential, a real verified payout-ready provider, and a real customer payment method.
- Store distribution status is separate from web/software readiness.
