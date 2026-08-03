import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, env, stripe } from "../_shared/oc-payments.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event;
  try {
    const raw = await req.text();
    event = await stripe().webhooks.constructEventAsync(raw, signature, env("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const client = admin();
  const object = event.data.object as Record<string, any>;
  if (event.type === "account.updated" && object.id) {
    await client.from("oc_provider_profiles").update({
      stripe_charges_enabled: Boolean(object.charges_enabled),
      stripe_payouts_enabled: Boolean(object.payouts_enabled),
      stripe_onboarding_complete: Boolean(object.details_submitted && object.charges_enabled && object.payouts_enabled),
      updated_at: new Date().toISOString(),
    }).eq("stripe_account_id", object.id);
  }
  const intentId = object.object === "payment_intent" ? object.id : object.payment_intent;
  const { data: payment } = intentId ? await client.from("oc_booking_payments").select("*,provider:oc_provider_profiles!oc_booking_payments_provider_id_fkey(stripe_account_id,stripe_payouts_enabled)").eq("stripe_payment_intent_id", intentId).maybeSingle() : { data: null };
  const { error: eventError } = await client.from("oc_payment_events").insert({
    stripe_event_id: event.id, event_type: event.type, payment_id: payment?.id ?? null,
    livemode: event.livemode, payload: event,
  });
  if (eventError?.code === "23505") return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: { "Content-Type": "application/json" } });
  if (eventError) return new Response("Event persistence failed", { status: 500 });

  if (payment) {
    if (event.type === "payment_intent.amount_capturable_updated") {
      const charge = object.latest_charge ? await stripe().charges.retrieve(object.latest_charge) : null;
      await client.from("oc_booking_payments").update({
        status: "authorized", authorized_at: new Date().toISOString(),
        stripe_charge_id: charge?.id ?? null,
        capture_by: charge?.payment_method_details?.card?.capture_before ? new Date(charge.payment_method_details.card.capture_before * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);
    } else if (event.type === "payment_intent.succeeded") {
      await client.from("oc_booking_payments").update({ status: "transfer_pending", amount_captured: object.amount_received, captured_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
      if (payment.provider?.stripe_account_id && payment.provider.stripe_payouts_enabled && !payment.stripe_transfer_id) {
        const transfer = await stripe().transfers.create({
          amount: payment.provider_amount, currency: payment.currency,
          destination: payment.provider.stripe_account_id,
          transfer_group: `oc_booking_${payment.booking_id}`,
          metadata: { brand: "ON_CALL", booking_id: payment.booking_id, payment_id: payment.id },
        }, { idempotencyKey: `oc-payment-${payment.id}-transfer-v1` });
        await client.from("oc_booking_payments").update({ status: "transferred", stripe_transfer_id: transfer.id, transferred_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
      }
    } else if (event.type === "payment_intent.canceled") {
      await client.from("oc_booking_payments").update({ status: "authorization_canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
    } else if (event.type === "payment_intent.payment_failed") {
      await client.from("oc_booking_payments").update({ status: "failed", failure_code: object.last_payment_error?.code, failure_message: object.last_payment_error?.message, updated_at: new Date().toISOString() }).eq("id", payment.id);
    } else if (event.type === "charge.dispute.created") {
      await client.from("oc_booking_payments").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", payment.id);
    } else if (event.type === "charge.refunded") {
      const refunded = object.amount_refunded ?? 0;
      await client.from("oc_booking_payments").update({ amount_refunded: refunded, status: refunded >= payment.amount_captured ? "refunded" : "partially_refunded", updated_at: new Date().toISOString() }).eq("id", payment.id);
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
