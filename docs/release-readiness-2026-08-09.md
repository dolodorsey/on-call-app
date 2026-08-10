# ON CALL release readiness

This file records the current software-only launch gates separately from live provider supply.

- Web production deployment must match `main`.
- Quality Gate must pass.
- TestFlight upload must pass on current `main`.
- Payment server runtime and signed webhook must be healthy.
- Customer payment must use Stripe Elements when configured or hosted Stripe Checkout fallback.
- Account recovery, deletion, legal/support routes, notifications, receipts, tracking, cancellation, ratings, provider activation, provider verification, and ops surfaces must be mounted.
- Public service availability must be driven by verified coverage, never by catalog presence alone.
- Live provider supply and a real-money controlled acceptance transaction are tracked separately and are not prerequisites for software completeness.
