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
      .select("id,customer_id,provider_id,service_name,total_price,status,customer:oc_users!oc_bookings_customer_id_fkey(auth_id,email),provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled)")
      .eq("id", bookingId).single();
    if (error || !booking || booking.customer?.auth_id !== user.id) throw new Error("Eligible booking not found");
    if (booking.status !== "assigned" || !booking.provider_id) throw new Error("A provider must accept before payment authorization");
    if (!booking.provider?.stripe_account_id || !booking.provider.stripe_charges_enabled || !booking.provider.stripe_payouts_enabled) throw new Error("Provider payout setup is incomplete");

    const amount = Math.round(Number(booking.total_price) * 100);
    if (!Number.isSafeInteger(amount) || amount < 50) throw new Error("Booking total is invalid");
    const feeBps = Number(Deno.env.get("ON_CALL_PLATFORM_FEE_BPS") ?? "2000");
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) throw new Error("Platform fee configuration is invalid");
    const platformFee = Math.round(amount * feeBps / 10000);
    const providerAmount = amount - platformFee;

    const { data: existing } = await client.from("oc_booking_payments").select("*").eq("booking_id", bookingId).maybeSingle();
    if (existing?.stripe_payment_intent_id) {
      const intent = await stripe().paymentIntents.retrieve(existing.stripe_payment_intent_id);
      return json({ paymentId: existing.id, clientSecret: intent.client_secret, status: existing.status });
    }

    const intent = await stripe().paymentIntents.create({
      amount, currency: "usd", capture_method: "manual",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: booking.customer?.email ?? undefined,
      description: `ON CALL — ${booking.service_name}`,
      transfer_group: `oc_booking_${booking.id}`,
      metadata: { brand: "ON_CALL", booking_id: booking.id, customer_id: booking.customer_id, provider_id: booking.provider_id },
    }, { idempotencyKey: `oc-booking-${booking.id}-authorization-v1` });

    const { data: payment, error: insertError } = await client.from("oc_booking_payments").insert({
      booking_id: booking.id, customer_id: booking.customer_id, provider_id: booking.provider_id,
      amount_authorized: amount, platform_fee: platformFee, provider_amount: providerAmount,
      stripe_payment_intent_id: intent.id, status: intent.status === "requires_action" ? "requires_action" : "pending_authorization",
    }).select("id,status").single();
    if (insertError) throw insertError;
    return json({ paymentId: payment.id, clientSecret: intent.client_secret, status: payment.status });
  } catch (error) { return errorResponse(error); }
});
