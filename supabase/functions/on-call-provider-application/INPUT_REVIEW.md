# Provider application input contract

The repository baseline e4db88947029f0c2eb6ee1812ad669ed4de9b07f matches live v5 source (ignoring trailing newline), freshly checked October 5, 2026. This change is proposed only; v5 remains deployed.

Reject non-object JSON, non-boolean supplied has_vehicle, and experience values that are not an integer number or a digit-only trimmed string in the existing 0–80 range. Omitted vehicle availability remains false. Existing attestations and private status receipts are preserved.

Caller inspected: components/ProviderApply.jsx sends years_experience from select values 0, 1, 3, 5, 10 as strings, and has_vehicle from checkbox checked as a boolean. The payload spreads form and sets state_code from state. These values remain compatible; no browser or live submission was performed.

Run node --test tests/provider-application-input.test.mjs (Node with stripTypeScriptTypes support). The 28 actual-handler scenarios use a VM and mocked database/rate-limit calls, with network forbidden. No customer applications or alerts are created. Independent review and release approval remain required; GHL identity conflict and human owner are unresolved.
