import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, errorResponse, json, requireUser, stripe } from "../_shared/oc-payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { bookingId } = await req.json();
    const { client, user } = await requireUser(req);
    const { data: payment, error } = await client.from("oc_booking_payments")
      .select("id,status,stripe_payment_intent_id,booking:oc_bookings!oc_booking_payments_booking_id_fkey(customer:oc_users!oc_bookings_customer_id_fkey(auth_id))")
      .eq("booking_id", bookingId).single();
    if (error || !payment || payment.booking?.customer?.auth_id !== user.id) throw new Error("Payment not found");
    if (["captured","transferred","partially_refunded","refunded"].includes(payment.status)) throw new Error("Captured payments require the refund workflow");
    if (!payment.stripe_payment_intent_id) throw new Error("Payment authorization not found");
    const intent = await stripe().paymentIntents.cancel(payment.stripe_payment_intent_id, { cancellation_reason: "requested_by_customer" }, { idempotencyKey: `oc-payment-${payment.id}-cancel-v1` });
    return json({ status: intent.status });
  } catch (error) { return errorResponse(error); }
});
