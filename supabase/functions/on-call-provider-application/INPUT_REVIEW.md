# Provider application input contract

The repository baseline e4db88947029f0c2eb6ee1812ad669ed4de9b07f matches live v5 source (ignoring trailing newline), freshly checked October 5, 2026. This change is proposed only; v5 remains deployed.

Reject non-object JSON, non-boolean supplied has_vehicle, and experience values that are not an integer number or a digit-only trimmed string in the existing 0–80 range. Omitted vehicle availability remains false. Existing attestations and private status receipts are preserved.

Caller inspected: components/ProviderApply.jsx sends years_experience from select values 0, 1, 3, 5, 10 as strings, and has_vehicle from checkbox checked as a boolean. The payload spreads form and sets state_code from state. These values remain compatible; no browser or live submission was performed.

Run node --test tests/provider-application-input.test.mjs (Node with stripTypeScriptTypes support). The 28 actual-handler scenarios use a VM and mocked database/rate-limit calls, with network forbidden. No customer applications or alerts are created. Independent review and release approval remain required; GHL identity conflict and human owner are unresolved.

October 5 caller integration: `node --test tests/provider-application-caller.test.mjs` passes nine checks. It extracts the actual component submit function and routes its requests into the actual proposed edge handler with mocked persistence. All five select values preserve numeric experience and private receipt storage; malformed experience, busy-state snapshot, network failure and HTTP-200 nonsuccess do not advance/save receipts. React rendering, simultaneous-click behavior, browser storage failures, and production database effects remain unverified. No network calls or real records.

Receipt-storage repair: the original submit function reproduced a successful insert followed by no success step/receipt when localStorage.setItem threw. The form now retains the receipt in memory before attempting storage, proceeds to success, and shows a status warning to keep the tab open and not resubmit. Ten caller tests now pass; TypeScript and Vite production build pass (Node25.6 versus target24). No browser QA or real submission. Receipt recovery after tab closure and clearReceipt storage failures remain outside this repair.

October 13 duplicate lookup repair: a database error from the active-application lookup now stops the request before rate limiting or insertion, including a result containing stale data alongside an error. The actual-handler input suite has 32 checks, including three error variants and unchanged private-token exclusion for an existing duplicate. This does not make the lookup and insert atomic: overlapping empty reads can still create duplicates. Production trigger effects, atomic duplicate protection, and secure receipt recovery remain separate release blockers. No production deployment or application was performed.


## October 13: competing insert response

The handler maps only SQLSTATE 23505 with the exact proposed active-email constraint message to HTTP 409 and original-device receipt guidance. Other unique errors and database errors remain HTTP 500. Four new actual caller/handler VM cases verify no success step, no receipt/token/hash disclosure, no stored receipt, one request and released busy state. All 14 caller and 32 handler checks pass with mocked persistence and no external test calls. The prior handler fails the new conflict-guidance regression.

This is preparatory error handling: the proposed partial unique index remains local and is NOT included or deployed. It does not itself prevent concurrent inserts or recover a lost receipt. Full schema/verification-trigger rehearsal, operator reopen conflict handling, independent review and deployment remain pending. Live schema has email NOT NULL; read-only aggregate checks found zero null, blank or noncanonical emails. This does not establish a database blank-email constraint.
