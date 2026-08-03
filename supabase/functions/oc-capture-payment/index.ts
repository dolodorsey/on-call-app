import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, errorResponse, json, requireUser, stripe } from "../_shared/oc-payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { bookingId } = await req.json();
    const { client, user } = await requireUser(req);
    const { data: payment, error } = await client.from("oc_booking_payments")
      .select("id,status,stripe_payment_intent_id,booking:oc_bookings!oc_booking_payments_booking_id_fkey(id,status,customer:oc_users!oc_bookings_customer_id_fkey(auth_id),provider:oc_provider_profiles!oc_bookings_provider_id_fkey(user:oc_users!oc_provider_profiles_user_id_fkey(auth_id)))")
      .eq("booking_id", bookingId).single();
    const ownsPayment = payment?.booking?.customer?.auth_id === user.id || payment?.booking?.provider?.user?.auth_id === user.id;
    if (error || !payment || !ownsPayment) throw new Error("Payment not found");
    if (payment.booking.status !== "completed") throw new Error("Service completion is required before capture");
    if (payment.status === "captured" || payment.status === "transferred") return json({ status: payment.status });
    if (payment.status !== "authorized" || !payment.stripe_payment_intent_id) throw new Error("Payment is not authorized for capture");
    await client.from("oc_booking_payments").update({ status: "capture_pending", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "authorized");
    const intent = await stripe().paymentIntents.capture(payment.stripe_payment_intent_id, {}, { idempotencyKey: `oc-payment-${payment.id}-capture-v1` });
    return json({ status: intent.status });
  } catch (error) { return errorResponse(error); }
});
