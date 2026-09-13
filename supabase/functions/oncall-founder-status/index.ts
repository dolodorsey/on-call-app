import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ app: "on_call", error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ app: "on_call", error: "authentication_required" }, 401);

  const caller = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: isOperator, error: operatorError } = await caller.rpc("marketplace_operator_check");
  if (operatorError || isOperator !== true) return json({ app: "on_call", error: "operator_access_required" }, 403);

  const started = Date.now();
  const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const problems: string[] = [];
  const exceptions: string[] = [];

  const count = async (table: string, build: (q: any) => any = (q) => q): Promise<number | null> => {
    try {
      const { count: value, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
      if (error) throw error;
      return value ?? 0;
    } catch {
      problems.push(`${table}_unreadable`);
      return null;
    }
  };

  const oldestPendingCrm = async (): Promise<{ created_at: string; attempts: number } | null> => {
    try {
      const { data, error } = await db
        .from("oc_crm_outbox")
        .select("created_at,attempts")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { created_at: String(data.created_at), attempts: Number(data.attempts || 0) } : null;
    } catch {
      problems.push("oc_crm_oldest_pending_unreadable");
      return null;
    }
  };

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();

  const [
    activeServices,
    totalProviders,
    approvedProviders,
    verifiedProviders,
    payoutReadyProviders,
    availableProviders,
    liveProviders,
    activeProviderServiceLinks,
    totalApplications,
    openApplications,
    applications24h,
    totalBookings,
    bookings24h,
    completedBookings,
    crmPending,
    crmStale4h,
    crmPendingZeroAttempts,
    crmProcessed24h,
    oldestCrm,
  ] = await Promise.all([
    count("oc_service_catalog", (q) => q.eq("is_active", true)),
    count("oc_provider_profiles"),
    count("oc_provider_profiles", (q) => q.eq("approval_status", "approved")),
    count("oc_provider_profiles", (q) => q.eq("approval_status", "approved").eq("identity_verified", true).eq("background_check_status", "passed").eq("service_area_verified", true)),
    count("oc_provider_profiles", (q) => q.eq("approval_status", "approved").eq("stripe_onboarding_complete", true).eq("stripe_payouts_enabled", true).eq("stripe_transfer_status", "active")),
    count("oc_provider_profiles", (q) => q.eq("is_available", true)),
    count("oc_provider_locations", (q) => q.eq("is_on_duty", true).gte("updated_at", fifteenMinAgo)),
    count("oc_provider_services", (q) => q.eq("is_active", true)),
    count("oc_provider_applications"),
    count("oc_provider_applications", (q) => q.in("status", ["submitted", "pending", "under_review"])),
    count("oc_provider_applications", (q) => q.gte("created_at", oneDayAgo)),
    count("oc_bookings"),
    count("oc_bookings", (q) => q.gte("created_at", oneDayAgo)),
    count("oc_bookings", (q) => q.eq("status", "completed")),
    count("oc_crm_outbox", (q) => q.eq("status", "pending")),
    count("oc_crm_outbox", (q) => q.eq("status", "pending").lt("created_at", fourHoursAgo)),
    count("oc_crm_outbox", (q) => q.eq("status", "pending").eq("attempts", 0)),
    count("oc_crm_outbox", (q) => q.eq("status", "processed").gte("processed_at", oneDayAgo)),
    oldestPendingCrm(),
  ]);

  if (totalProviders === 0) exceptions.push("zero_provider_profiles");
  if (verifiedProviders === 0) exceptions.push("zero_verified_provider_supply");
  if (activeProviderServiceLinks === 0) exceptions.push("zero_services_with_provider_supply");
  if (totalApplications === 0) exceptions.push("zero_provider_applications");
  if (totalBookings === 0) exceptions.push("zero_lifetime_bookings");
  if (Number(crmStale4h || 0) > 0) exceptions.push("stale_crm_backlog_over_4h");
  if (Number(crmPendingZeroAttempts || 0) > 0) exceptions.push("crm_backlog_zero_attempts");

  return json({
    app: "on_call",
    visibility: "operator_only",
    founder_status: problems.length ? "red" : exceptions.length ? "red" : "green",
    founder_exceptions: exceptions,
    query_problems: problems,
    supply: {
      active_services: activeServices,
      provider_profiles: totalProviders,
      approved_providers: approvedProviders,
      verified_providers: verifiedProviders,
      payout_ready_providers: payoutReadyProviders,
      available_providers: availableProviders,
      live_providers: liveProviders,
      active_provider_service_links: activeProviderServiceLinks,
    },
    provider_recruiting: {
      total_applications: totalApplications,
      open_applications: openApplications,
      applications_24h: applications24h,
    },
    demand: {
      total_bookings: totalBookings,
      bookings_24h: bookings24h,
      completed_bookings: completedBookings,
    },
    crm: {
      pending: crmPending,
      stale_over_4h: crmStale4h,
      pending_zero_attempts: crmPendingZeroAttempts,
      processed_24h: crmProcessed24h,
      oldest_pending_created_at: oldestCrm?.created_at || null,
      oldest_pending_attempts: oldestCrm?.attempts ?? null,
    },
    latency_ms: Date.now() - started,
    checked_at: new Date().toISOString(),
  });
});
