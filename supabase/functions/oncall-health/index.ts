import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

const URL = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const started = Date.now();
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const softwareProblems: string[] = [];
  const activationBlockers: string[] = [];
  const founderExceptions: string[] = [];

  const count = async (table: string, build: (q: any) => any = (q) => q): Promise<number | null> => {
    try {
      const { count: value, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
      if (error) throw error;
      return value ?? 0;
    } catch {
      return null;
    }
  };

  const secret = async (name: string): Promise<boolean> => {
    if (Deno.env.get(name)) return true;
    try {
      const { data, error } = await db.rpc("oc_get_runtime_secret", { secret_name: name });
      return !error && Boolean(data);
    } catch {
      return false;
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
      return null;
    }
  };

  const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [
    activeServices,
    activeCategories,
    activeZones,
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
    openBookings,
    pendingPayments,
    pricingRules,
    stripeReady,
    webhookReady,
    v2WebhookReady,
    vapidPublicReady,
    vapidPrivateReady,
    pushSubscriptions,
    pushDeliveries,
    openSupportCases,
    crmPending,
    crmStale4h,
    crmPendingZeroAttempts,
    crmProcessed24h,
    oldestCrm,
  ] = await Promise.all([
    count("oc_service_catalog", (q) => q.eq("is_active", true)),
    count("oc_service_categories", (q) => q.eq("is_active", true)),
    count("oc_service_zones", (q) => q.eq("is_active", true)),
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
    count("oc_bookings", (q) => q.in("status", ["pending", "matching"])),
    count("oc_booking_payments", (q) => q.in("status", ["pending_authorization", "requires_action"])),
    count("oc_pricing_rules", (q) => q.eq("is_active", true)),
    secret("STRIPE_SECRET_KEY"),
    secret("STRIPE_WEBHOOK_SECRET"),
    secret("STRIPE_V2_ACCOUNT_WEBHOOK_SECRET"),
    secret("MARKETPLACE_VAPID_PUBLIC_KEY"),
    secret("MARKETPLACE_VAPID_PRIVATE_KEY"),
    count("marketplace_push_subscriptions"),
    count("marketplace_push_deliveries"),
    count("oc_support_tickets", (q) => q.in("status", ["open", "reviewing", "waiting_customer"])),
    count("oc_crm_outbox", (q) => q.eq("status", "pending")),
    count("oc_crm_outbox", (q) => q.eq("status", "pending").lt("created_at", fourHoursAgo)),
    count("oc_crm_outbox", (q) => q.eq("status", "pending").eq("attempts", 0)),
    count("oc_crm_outbox", (q) => q.eq("status", "processed").gte("processed_at", oneDayAgo)),
    oldestPendingCrm(),
  ]);

  const catalogReadable = activeServices !== null && activeCategories !== null && activeZones !== null;
  const catalogReady = catalogReadable && Number(activeServices) > 0 && Number(activeCategories) > 0 && Number(activeZones) > 0;
  const supplyReadable = totalProviders !== null && verifiedProviders !== null && availableProviders !== null && liveProviders !== null && activeProviderServiceLinks !== null;
  const paymentsReadable = pendingPayments !== null;
  const paymentsReady = paymentsReadable && stripeReady && webhookReady && v2WebhookReady && Boolean(pricingRules);
  const pushReady = vapidPublicReady && vapidPrivateReady && pushSubscriptions !== null && pushDeliveries !== null;
  const supportReady = openSupportCases !== null;
  const founderTelemetryReadable = [
    totalApplications,
    applications24h,
    totalBookings,
    bookings24h,
    completedBookings,
    crmPending,
    crmStale4h,
    crmPendingZeroAttempts,
    crmProcessed24h,
  ].every((value) => value !== null);

  if (!catalogReadable) softwareProblems.push("catalog_unreadable");
  else if (!catalogReady) softwareProblems.push("catalog_not_configured");
  if (!supplyReadable) softwareProblems.push("supply_unreadable");
  if (!paymentsReadable) softwareProblems.push("payments_unreadable");
  if (!stripeReady) softwareProblems.push("stripe_secret_missing");
  if (!webhookReady) softwareProblems.push("stripe_webhook_secret_missing");
  if (!v2WebhookReady) softwareProblems.push("stripe_v2_account_webhook_secret_missing");
  if (!pricingRules) softwareProblems.push("no_take_rate_configured");
  if (!vapidPublicReady) softwareProblems.push("push_public_key_missing");
  if (!vapidPrivateReady) softwareProblems.push("push_private_key_missing");
  if (pushSubscriptions === null || pushDeliveries === null) softwareProblems.push("push_tables_unreadable");
  if (!supportReady) softwareProblems.push("support_unreadable");

  if (availableProviders === 0) activationBlockers.push("no_available_providers");
  if (liveProviders === 0) activationBlockers.push("no_live_providers");
  if (verifiedProviders === 0) activationBlockers.push("no_verified_providers");
  if (activeProviderServiceLinks === 0) activationBlockers.push("no_provider_service_supply");

  if (!founderTelemetryReadable) founderExceptions.push("execution_telemetry_unreadable");
  if (totalProviders === 0) founderExceptions.push("zero_provider_profiles");
  if (verifiedProviders === 0) founderExceptions.push("zero_verified_provider_supply");
  if (activeProviderServiceLinks === 0) founderExceptions.push("zero_services_with_provider_supply");
  if (totalApplications === 0) founderExceptions.push("zero_provider_applications");
  if (totalBookings === 0) founderExceptions.push("zero_lifetime_bookings");
  if (Number(crmStale4h || 0) > 0) founderExceptions.push("stale_crm_backlog_over_4h");
  if (Number(crmPendingZeroAttempts || 0) > 0) founderExceptions.push("crm_backlog_zero_attempts");

  const fatal = softwareProblems.some((problem) => problem.endsWith("_unreadable"));
  const softwareStatus = fatal ? "unhealthy" : softwareProblems.length ? "degraded" : "ok";
  const activationStatus = activationBlockers.length ? "blocked" : "ready";
  const founderStatus = founderExceptions.length ? "red" : "green";

  return new Response(
    JSON.stringify(
      {
        app: "on_call",
        status: softwareStatus,
        software_status: softwareStatus,
        activation_status: activationStatus,
        founder_status: founderStatus,
        software_ready: softwareStatus === "ok",
        market_activation_ready: activationStatus === "ready",
        software_problems: softwareProblems,
        activation_blockers: activationBlockers,
        founder_exceptions: founderExceptions,
        checks: {
          catalog: { ready: catalogReady, active_services: activeServices, active_categories: activeCategories, active_zones: activeZones },
          supply: {
            readable: supplyReadable,
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
            readable: openBookings !== null,
            total_bookings: totalBookings,
            bookings_24h: bookings24h,
            open_bookings: openBookings,
            completed_bookings: completedBookings,
          },
          crm: {
            readable: crmPending !== null && crmStale4h !== null && crmPendingZeroAttempts !== null,
            pending: crmPending,
            stale_over_4h: crmStale4h,
            pending_zero_attempts: crmPendingZeroAttempts,
            processed_24h: crmProcessed24h,
            oldest_pending_created_at: oldestCrm?.created_at || null,
            oldest_pending_attempts: oldestCrm?.attempts ?? null,
          },
          payments: {
            ready: paymentsReady,
            stripe_server_credential: stripeReady,
            webhook_signature_secret: webhookReady,
            stripe_v2_account_webhook_secret: v2WebhookReady,
            payments_table_reachable: paymentsReadable,
            take_rate_configured: Boolean(pricingRules),
            money_unit: "integer_cents",
          },
          push: { ready: pushReady },
          support: { table_reachable: supportReady },
        },
        latency_ms: Date.now() - started,
        checked_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    { status: fatal ? 503 : 200, headers: cors },
  );
});
