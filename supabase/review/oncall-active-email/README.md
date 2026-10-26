# ON CALL active application email uniqueness proposal

Review-only SQL, outside automatic migrations. Not deployed. Before release, verify schema, existing active duplicates, independent authorization review and exact rollout order. Apply the matching intake conflict handling and operator guidance from this PR alongside any approved index release. Do not automatically reconcile or delete conflicting records.

The partial unique index covers lower(trim(email)) only for submitted, reviewing and approved applications. Rejected and withdrawn history remains permitted. Database NOT NULL remains unchanged. A single blank email is still accepted by the database: this index is not an email-validation constraint. Current inspected edge intake rejects empty/whitespace/null/missing emails before lookup or insert; a valid mixed-case padded address is normalized. Other external writers have not been exhaustively excluded.

Prior isolated PostgreSQL 17.11 evidence: overlapping normalized inserts leave one application, one alert, one service match and seven verification checks; conflicting reopen preserves all related records. Actual production review RPC (MD5 02fc08c7574c2e598e54a00cfc916dc3) exercised with this index: conflicting reviewing/approved preserves five-table snapshot including notifications; successful local approval exercises notification creation. Authorization and user/notification fixture stubs limit proof; this is not certification of human operator authority or delivery.

Evidence reports in the operating workspace: outputs/oncall-verification-side-effects-2026-10-13.md and outputs/oncall-operator-rpc-qa-2026-10-25.md. Reproduction scripts remain in work/oncall-verification-qa and work/oncall-operator-rpc-qa; these are local workspace dependencies, not a standalone repository test suite.

Run the six current-handler email checks: node tests/provider-email-boundary.test.mjs. They mock persistence and forbid external network access. No real application is created.

Fresh October 26 read: zero null emails, blank emails and active normalized duplicate groups. Recheck at deployment; this snapshot does not authorize deployment. Existing owner, GHL identity and independent QA/release holds remain.
