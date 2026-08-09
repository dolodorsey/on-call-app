# ON CALL shared-backend boundary

ON CALL currently shares Supabase project `cxdqkjvtpilvouwtbgdy` with S.O.S. as an infrastructure decision only.

## Product ownership

- Public product: **ON CALL**
- Repository: `dolodorsey/on-call-app`
- Primary domain: `oncallallday.com`
- Product database namespace: **`oc_*` only**
- S.O.S. product namespace: `sos_*` — not ON CALL data
- Shared Auth/Stripe/runtime infrastructure does not imply shared public branding or product ownership.

## Isolation requirements

The production database must preserve all of these invariants:

1. No foreign keys between `oc_*` and `sos_*` tables.
2. RLS remains enabled on all public `oc_*` and `sos_*` product tables.
3. `anon` and `PUBLIC` receive no direct INSERT, UPDATE, DELETE, or TRUNCATE grants on product tables.
4. ON CALL database functions must not reference `sos_*` product tables, and S.O.S. functions must not reference `oc_*` product tables.
5. Cross-product access is limited to deliberately shared infrastructure such as Auth, Vault/runtime secret retrieval, and platform-level payment/webhook infrastructure.

Production stores this ownership mapping in the private `marketplace_product_registry` table and validates the boundary with the service-role-only function `private.marketplace_namespace_isolation_audit()`.

A passing audit returns `ok: true` with empty arrays for cross-namespace foreign keys, RLS-disabled product tables, anonymous/public write grants, and cross-prefix function references.
