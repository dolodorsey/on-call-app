import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, errorResponse, json, requireUser, stripe } from "../_shared/oc-payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { bookingId } = await req.json();
    if (typeof bookingId !== "string") return json({ error: "bookingId is required" }, 422);
    const { client, user } = await requireUser(req);
    const { data: booking, error } = await client.from("oc_bookings")
      .select("id,customer_id,provider_id,service_name,final_price_cents,total_price_cents,tax_amount_cents,pricing_status,status,customer:oc_users!oc_bookings_customer_id_fkey(auth_id,email),provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled,stripe_account_api_version,stripe_transfer_status)")
      .eq("id", bookingId).single();
    if (error || !booking || booking.customer?.auth_id !== user.id) throw new Error("Eligible booking not found");
    if (booking.status !== "assigned" || !booking.provider_id) throw new Error("A provider must accept before payment authorization");
    if (booking.pricing_status !== "confirmed") throw new Error("Provider final price confirmation is required before payment authorization");
    const providerReady = booking.provider?.stripe_account_api_version === "v2"
      ? booking.provider?.stripe_transfer_status === "active"
      : Boolean(booking.provider?.stripe_charges_enabled && booking.provider?.stripe_payouts_enabled);
    if (!booking.provider?.stripe_account_id || !providerReady) throw new Error("Provider payout setup is incomplete");

    const serviceAmount = Math.round(Number(booking.final_price_cents ?? booking.total_price_cents ?? 0));
    const taxCents = Math.max(0, Math.round(Number(booking.tax_amount_cents || 0)));
    const amount = serviceAmount + taxCents;
    if (!Number.isSafeInteger(serviceAmount) || serviceAmount < 50 || !Number.isSafeInteger(amount) || amount < 50) throw new Error("Booking total is invalid");
    const feeBps = Number(Deno.env.get("ON_CALL_PLATFORM_FEE_BPS") ?? "2000");
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) throw new Error("Platform fee configuration is invalid");
    const platformFee = Math.round(serviceAmount * feeBps / 10000);
    const providerAmount = serviceAmount - platformFee;

    const { data: existing } = await client.from("oc_booking_payments").select("*").eq("booking_id", bookingId).maybeSingle();
    if (existing?.stripe_payment_intent_id) {
      const stripeClient = await stripe();
      const intent = await stripeClient.paymentIntents.retrieve(existing.stripe_payment_intent_id);
      if (Number(existing.amount_authorized) === amount && ["requires_payment_method","requires_confirmation","requires_action","requires_capture","processing","succeeded"].includes(intent.status)) {
        return json({ paymentId: existing.id, clientSecret: intent.client_secret, status: existing.status });
      }
      if (["requires_payment_method","requires_confirmation","requires_action"].includes(intent.status)) {
        await stripeClient.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" });
      } else if (["requires_capture","processing","succeeded"].includes(intent.status)) {
        throw new Error("Existing payment authorization does not match the confirmed booking total");
      }
    }

    const stripeClient = await stripe();
    const intent = await stripeClient.paymentIntents.create({
      amount, currency: "usd", capture_method: "manual",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: booking.customer?.email ?? undefined,
      description: `ON CALL — ${booking.service_name}`,
      transfer_group: `oc_booking_${booking.id}`,
      metadata: { brand: "ON_CALL", booking_id: booking.id, customer_id: booking.customer_id, provider_id: booking.provider_id, service_amount_cents: String(serviceAmount), tax_cents: String(taxCents) },
    }, { idempotencyKey: `oc-booking-${booking.id}-${amount}-authorization-v2` });

    const paymentPayload = {
      booking_id: booking.id, customer_id: booking.customer_id, provider_id: booking.provider_id,
      amount_authorized: amount, platform_fee: platformFee, provider_amount: providerAmount, tax_cents: taxCents,
      stripe_payment_intent_id: intent.id, stripe_checkout_session_id: null,
      status: intent.status === "requires_action" ? "requires_action" : "pending_authorization",
      updated_at: new Date().toISOString(),
    };
    const result = existing
      ? await client.from("oc_booking_payments").update(paymentPayload).eq("id", existing.id).select("id,status").single()
      : await client.from("oc_booking_payments").insert(paymentPayload).select("id,status").single();
    if (result.error) throw result.error;
    return json({ paymentId: result.data.id, clientSecret: intent.client_secret, status: result.data.status });
  } catch (error) { return errorResponse(error); }
});
