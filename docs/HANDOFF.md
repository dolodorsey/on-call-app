# On Call Release Handoff

## Canonical identity

- Repository: `dolodorsey/on-call-app`
- Production: `https://oncallallday.com`
- Current authority: MCP Gateway `public.oc_*`
- Secondary data plane: KOLLECTIVE BOH

## Release rule

`public.oc_bookings` is authoritative for booking identity, status, dispatch, and payment references. Retries must preserve one booking ID and may not create a duplicate charge.

## Required checks

1. Run `npm ci`.
2. Run `node --test tests/*.test.mjs`.
3. Run `npm run build`.
4. Confirm `/health.json` returns the expected app and authority.
5. Validate customer, provider, dispatcher, and admin role isolation.
6. Validate quote/instant/scheduled booking, provider accept/decline/timeout, messaging, notifications, cancellation, reschedule, payment, refund, dispute, payout, and admin recovery.
7. Validate each service category independently.
8. Record evidence in Enterprise System Control.

## Data rules

- MCP `oc_bookings` wins every conflict.
- No secondary system may overwrite a confirmed booking state.
- Provider verification must be enforced by service category.
- Never expose service-role credentials to client code.

## Rollback

Revert Vercel, disable only the failing category or feature, stop payment retries, preserve the MCP booking, block the release gate, and reconcile all affected booking IDs before resuming.
