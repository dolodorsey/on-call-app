-- Defense-in-depth for shared marketplace control tables.
-- These tables are server/operator-only and intentionally have no anon/authenticated policies.

alter table if exists private.marketplace_product_registry enable row level security;
alter table if exists private.marketplace_release_evidence enable row level security;
alter table if exists private.marketplace_operators enable row level security;
alter table if exists private.marketplace_stripe_v2_events enable row level security;
alter table if exists private.marketplace_runtime_config enable row level security;
