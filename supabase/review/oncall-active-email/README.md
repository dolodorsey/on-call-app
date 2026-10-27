# ON CALL active application email uniqueness proposal

Review-only SQL, outside automatic migrations. Not deployed. Before release, verify schema, existing active duplicates, independent authorization review and exact rollout order. Apply the matching intake conflict handling and operator guidance from this PR alongside any approved index release. Do not automatically reconcile or delete conflicting records.

The partial unique index covers lower(trim(email)) only for submitted, reviewing and approved applications. Rejected and withdrawn history remains permitted. Database NOT NULL remains unchanged. A single blank email is still accepted by the database: this index is not an email-validation constraint. Current inspected edge intake rejects empty/whitespace/null/missing emails before lookup or insert; a valid mixed-case padded address is normalized. Other external writers have not been exhaustively excluded.

Prior isolated PostgreSQL 17.11 evidence: overlapping normalized inserts leave one application, one alert, one service match and seven verification checks; conflicting reopen preserves all related records. Actual production review RPC (MD5 02fc08c7574c2e598e54a00cfc916dc3) exercised with this index: conflicting reviewing/approved preserves five-table snapshot including notifications; successful local approval exercises notification creation. Authorization and user/notification fixture stubs limit proof; this is not certification of human operator authority or delivery.

Evidence reports in the operating workspace: outputs/oncall-verification-side-effects-2026-10-13.md and outputs/oncall-operator-rpc-qa-2026-10-25.md. The standalone check-concurrency.py and check-review.py scripts now reproduce these checks with the included schema snapshot and review function.

Run the six current-handler email checks: node tests/provider-email-boundary.test.mjs. They mock persistence and forbid external network access. No real application is created.

Fresh October 26 read: zero null emails, blank emails and active normalized duplicate groups. Recheck at deployment; this snapshot does not authorize deployment. Existing owner, GHL identity and independent QA/release holds remain.

## Reproduce database checks

Requires Python 3 and PostgreSQL 17 binaries (initdb, pg_ctl, psql) on PATH. Optionally set ONCALL_PG_BIN to their directory. Run as a non-root user:

    python3 supabase/review/oncall-active-email/check-concurrency.py
    python3 supabase/review/oncall-active-email/check-review.py

Each script creates a disposable Unix-socket-only cluster under /tmp, strips inherited PG environment variables and tears down the cluster in finally. It does not connect to an existing database. It prints JSON evidence and does not modify the repository. No credentials or network service are needed. The concurrency script checks seven scenarios; the review script checks six. Run from any working directory. The schema snapshot includes definitions only, no production rows or credentials. fixture.sql excludes the proposed index; both scripts load proposed.sql separately so they test the reviewable proposal.

The snapshot preserves the earlier limited fixture: auth/category parents and operator/user/notification dependencies are stubs. Real RLS/grants, unrelated indexes, external consumers and accepted human authority are not reproduced. These tests do not grant release approval or deploy the proposal.

## Read-only rollout preflight

Run preflight.sql through an authorized SQL connection immediately before a separately approved rollout. It returns aggregate counts and the named relation/index definition and validity flags, never applicant email values. It uses a read-only transaction, a ten-second statement timeout and row_security=off so insufficient RLS visibility fails instead of silently reporting zero. It grants nothing and applies no schema changes. A missing index is not deployment approval; a same-name index must be checked for the exact target, expression, predicate and flags. The snapshot cannot prevent concurrent changes after it finishes. Continue to require independent review, exact rollout order and authorized release.

Run `python3 supabase/review/oncall-active-email/check-preflight.py` with the same PostgreSQL requirements above. Five isolated checks cover absent/proposed/misleading index definitions, active normalized duplicates excluding history, no email disclosure and RLS-filtered reader rejection. This uses a minimal table fixture, not the production schema or operator-authorization model. PostgreSQL index flag reference: https://www.postgresql.org/docs/17/catalog-pg-index.html.
