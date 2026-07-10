# On Call Home-Services Marketplace Handoff

**Product:** On Call - On-Demand Home Services  
**Canonical repository:** `dolodorsey/on-call-app`  
**Upgrade branch:** `upgrade/marketplace-foundation-2026-07`  
**Current Supabase project:** `KOLLECTIVE BOH` (`wfkohcwxxsrhcxhepfql`)  
**Target Supabase project:** Dedicated `ON CALL` project  
**Canonical Vercel project:** `khg-on-call`  
**Prepared:** July 10, 2026

## 1. Product Boundary

On Call is an independent home-services marketplace.

Included:

- Cleaning
- Handyman work
- Plumbing
- Electrical
- HVAC
- Appliance work
- Exterior and yard work
- Moving and assembly

Excluded:

- Beauty, hair, nails, lashes, makeup, skincare, massage and cosmetic services - these belong to Luxe On Demand.
- Roadside assistance - this belongs to S.O.S.
- Event staffing, DJs, chefs and broad lifestyle concierge services unless approved as a later independent On Call division.

Core operating object: **booking/job**  
Provider role: **home-service provider**

## 2. Upgrade Delivered

### Marketplace database

File:

```text
supabase/migrations/20260710_home_services_marketplace_foundation.sql
```

The migration creates or enhances:

- Canonical home-service categories and services
- Provider-service qualifications
- Provider presence and live location
- Booking offers with expiration
- Booking event history
- Job media
- Payments
- Payouts
- Disputes
- Safety events
- Durable integration events
- Booking lifecycle timestamps and pricing fields

### Dispatch RPCs

- `oc_dispatch_booking`
- `oc_accept_booking_offer`
- `oc_decline_booking_offer`
- `oc_update_provider_location`
- `oc_enqueue_integration_event`

Offer acceptance locks the booking before assignment, preventing duplicate acceptance.

### Application data layer

File:

```text
src/supabase.ts
```

The upgrade:

- Removes the hard-coded production Supabase URL and anon JWT fallback.
- Requires Vercel/build environment variables.
- Removes direct fire-and-forget n8n webhooks.
- Queues durable integration events in Supabase.
- Adds catalog loading.
- Adds dispatch, offers, acceptance and decline APIs.
- Adds provider location APIs.
- Adds booking timeline and realtime subscriptions.
- Preserves existing authentication and booking helper exports.

## 3. Required Environment Variables

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

The final dedicated On Call project must receive new environment variables in:

- Vercel Production
- Vercel Preview
- Local development
- Capacitor iOS build environment
- Capacitor Android build environment

## 4. Dedicated Database Migration

On Call currently resides in KOLLECTIVE BOH. This is temporary.

### Move to a dedicated project

1. Create a new Supabase project named `ON CALL`.
2. Apply the existing On Call base schema.
3. Apply `20260710_home_services_marketplace_foundation.sql`.
4. Export only `oc_*` data.
5. Import into the new project.
6. Verify row counts and foreign keys.
7. rotate the app’s publishable key.
8. Update Vercel and mobile environment variables.
9. Run dual-read validation if live customer data exists.
10. Remove On Call client access from KOLLECTIVE BOH after cutover.

Do not move enterprise BOH tables into the On Call project.

## 5. Required Frontend Upgrade

The existing visual interface still contains prototype service cards and simulated provider matching.

### Replace service source

```text
Hard-coded services
-> getServiceCatalog()
-> render active oc_service_categories and oc_services
```

### Customer flow

```text
Select home service
-> enter job details and photos
-> receive estimate or quote path
-> create booking
-> authorize payment
-> dispatch on-demand booking or schedule job
-> subscribe to realtime booking/events
-> track provider
-> approve completion
-> rate provider
```

### Provider flow

```text
Complete onboarding
-> credentials and background check approved
-> activate approved services
-> go online and publish location
-> receive expiring offers
-> accept one job atomically
-> navigate/en route
-> arrive and start
-> upload before/after proof
-> complete job
-> receive payout
```

## 6. Durable Integration Pattern

The application no longer treats external automation delivery as successful merely because a browser `fetch()` was attempted.

Required worker pattern:

```text
oc_integration_events pending row
-> authenticated server worker claims row
-> deliver to CRM/communications/analytics
-> mark delivered
-> retry with backoff on failure
-> dead-letter after configured maximum
```

The customer booking must remain successful even when an external CRM is temporarily unavailable.

## 7. Payment Upgrade Required

Replace the universal Stripe link with:

- Customer-specific Stripe Customer
- Booking-specific PaymentIntent
- Authorization before provider dispatch for fixed-price work
- Quote/change-order approval for variable work
- Capture after completion or approved milestone
- Platform fee and provider payout records
- Tips, refunds, disputes and cancellation fees

Stripe secret operations must be server-side.

## 8. QA Gate

### Brand scope

- [ ] No beauty/cosmetic services appear in the On Call catalog.
- [ ] No roadside services appear in On Call.
- [ ] Marketing language says home services, not all-services super-app.

### Security

- [ ] No production key is committed in source.
- [ ] Customer sees only owned bookings and participant data.
- [ ] Provider sees only owned profile, offers and assigned jobs.
- [ ] Integration queue is not client-readable.
- [ ] Payment and payout records are participant-readable but backend-written.

### Dispatch

- [ ] Only approved providers with the required service are eligible.
- [ ] Provider location must be fresh and online.
- [ ] Offers expire.
- [ ] One provider wins assignment.
- [ ] Booking events are append-only through backend/RPC paths.

### Operational quality

- [ ] Before and after media is stored and reviewed.
- [ ] Quote and change-order path exists for non-fixed services.
- [ ] Cancellation fee rules are tested.
- [ ] Safety and dispute escalation reaches App Command Center.

## 9. Rollback

1. Keep the previous Vercel production deployment available.
2. Disable dispatch using a feature flag.
3. Restore the prior database branch if migration validation fails.
4. Do not reconnect the hard-coded key or browser webhooks.
5. Put booking intake into maintenance mode rather than accepting jobs that cannot be assigned safely.

## 10. Ownership

- **Product owner:** Dr. Dolo Dorsey
- **Application repository:** `dolodorsey/on-call-app`
- **Target database owner:** Dedicated On Call Supabase project
- **Enterprise visibility:** Summarized health, jobs, SLA, disputes and financial metrics through App Command Center.
- **Forbidden:** Direct writes to S.O.S, Luxe or enterprise BOH operational records.

## 11. Definition of Done

On Call is production-ready when:

- It runs from its dedicated Supabase project.
- All visible services come from the home-services catalog.
- Provider eligibility is real.
- Matching uses live offers and atomic acceptance.
- Payment is booking-specific.
- Job evidence, disputes, payouts and support are functional.
- All customer-facing performance claims are generated from real data.
