import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, stripe } from "../_shared/oc-payments.ts";

async function constructEvent(raw: string, signature: string) {
  const client = admin();
  const secretNames = ["on_call_stripe_webhook_account", "on_call_stripe_webhook_connect"];
  const secrets: string[] = [];
  for (const secretName of secretNames) {
    const { data, error } = await client.rpc("oc_get_runtime_secret", { secret_name: secretName });
    if (!error && typeof data === "string" && data) secrets.push(data);
  }
  if (!secrets.length) throw new Error("Webhook signing secrets are unavailable");
  for (const secret of secrets) {
    try { return await stripe().webhooks.constructEventAsync(raw, signature, secret); } catch { /* try next */ }
  }
  throw new Error("Invalid signature");
}

async function persistLuxeEvent(client:any,event:any,object:any,payment:any=null) {
  return await client.from("lm_payment_events").insert({
    stripe_event_id:event.id,event_type:event.type,payment_id:payment?.id??null,
    ride_id:payment?.ride_id??object?.metadata?.ride_id??null,livemode:event.livemode,payload:event,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  let event;
  try { event = await constructEvent(await req.text(), signature); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return new Response(message === "Webhook signing secrets are unavailable" ? message : "Invalid signature", { status: message === "Webhook signing secrets are unavailable" ? 503 : 400 });
  }

  const client = admin();
  const object = event.data.object as Record<string, any>;

  if (event.type === "account.updated" && object.id && object?.metadata?.app === "luxe_mobility") {
    const { error: ledgerError } = await persistLuxeEvent(client,event,object);
    if (ledgerError?.code === "23505") return new Response(JSON.stringify({received:true,duplicate:true,brand:"LUXE"}),{headers:{"Content-Type":"application/json"}});
    if (ledgerError) return new Response("LUXE event persistence failed",{status:500});
    await client.from("lm_drivers").update({
      payouts_enabled:Boolean(object.payouts_enabled && object.details_submitted),
      updated_at:new Date().toISOString(),
    }).eq("stripe_account_id",object.id);
    return new Response(JSON.stringify({received:true,brand:"LUXE"}),{headers:{"Content-Type":"application/json"}});
  }

  const intentId = object.object === "payment_intent" ? object.id : object.payment_intent;
  const { data: luxePayment } = intentId
    ? await client.from("lm_payments").select("id,ride_id,amount_captured").eq("stripe_payment_intent_id", intentId).maybeSingle()
    : { data: null };
  const isLuxe = object?.metadata?.app === "luxe_mobility" || Boolean(luxePayment);
  if (isLuxe && intentId) {
    const { error: luxeEventError } = await persistLuxeEvent(client,event,object,luxePayment);
    if (luxeEventError?.code === "23505") return new Response(JSON.stringify({ received: true, duplicate: true, brand: "LUXE" }), { headers: { "Content-Type": "application/json" } });
    if (luxeEventError) return new Response("LUXE event persistence failed", { status: 500 });
    if (event.type === "payment_intent.amount_capturable_updated") await client.from("lm_payments").update({status:"authorized",amount_authorized:object.amount,authorized_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("stripe_payment_intent_id",intentId);
    else if (event.type === "payment_intent.succeeded") await client.from("lm_payments").update({status:"captured",amount_captured:object.amount_received,captured_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("stripe_payment_intent_id",intentId);
    else if (event.type === "payment_intent.payment_failed") await client.from("lm_payments").update({status:"failed",updated_at:new Date().toISOString()}).eq("stripe_payment_intent_id",intentId);
    else if (event.type === "payment_intent.canceled") await client.from("lm_payments").update({status:"canceled",updated_at:new Date().toISOString()}).eq("stripe_payment_intent_id",intentId);
    return new Response(JSON.stringify({ received: true, brand: "LUXE" }), { headers: { "Content-Type": "application/json" } });
  }

  if (event.type === "account.updated" && object.id) {
    await client.from("oc_provider_profiles").update({
      stripe_charges_enabled:Boolean(object.charges_enabled),stripe_payouts_enabled:Boolean(object.payouts_enabled),
      stripe_onboarding_complete:Boolean(object.details_submitted && object.charges_enabled && object.payouts_enabled),updated_at:new Date().toISOString(),
    }).eq("stripe_account_id",object.id);
  }

  const { data: payment } = intentId
    ? await client.from("oc_booking_payments").select("*,provider:oc_provider_profiles!oc_booking_payments_provider_id_fkey(stripe_account_id,stripe_payouts_enabled)").eq("stripe_payment_intent_id", intentId).maybeSingle()
    : { data: null };
  const { error: eventError } = await client.from("oc_payment_events").insert({stripe_event_id:event.id,event_type:event.type,payment_id:payment?.id??null,livemode:event.livemode,payload:event});
  if (eventError?.code === "23505") return new Response(JSON.stringify({received:true,duplicate:true}),{headers:{"Content-Type":"application/json"}});
  if (eventError) return new Response("Event persistence failed",{status:500});

  if (payment) {
    if (event.type === "payment_intent.amount_capturable_updated") {
      const charge = object.latest_charge ? await stripe().charges.retrieve(object.latest_charge) : null;
      await client.from("oc_booking_payments").update({status:"authorized",authorized_at:new Date().toISOString(),stripe_charge_id:charge?.id??null,capture_by:charge?.payment_method_details?.card?.capture_before?new Date(charge.payment_method_details.card.capture_before*1000).toISOString():null,updated_at:new Date().toISOString()}).eq("id",payment.id);
    } else if (event.type === "payment_intent.succeeded") {
      await client.from("oc_booking_payments").update({status:"transfer_pending",amount_captured:object.amount_received,captured_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",payment.id);
      if (payment.provider?.stripe_account_id && payment.provider.stripe_payouts_enabled && !payment.stripe_transfer_id) {
        const transfer=await stripe().transfers.create({amount:payment.provider_amount,currency:payment.currency,destination:payment.provider.stripe_account_id,transfer_group:`oc_booking_${payment.booking_id}`,metadata:{brand:"ON_CALL",booking_id:payment.booking_id,payment_id:payment.id}},{idempotencyKey:`oc-payment-${payment.id}-transfer-v1`});
        await client.from("oc_booking_payments").update({status:"transferred",stripe_transfer_id:transfer.id,transferred_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",payment.id);
      }
    } else if (event.type === "payment_intent.canceled") await client.from("oc_booking_payments").update({status:"authorization_canceled",canceled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",payment.id);
    else if (event.type === "payment_intent.payment_failed") await client.from("oc_booking_payments").update({status:"failed",failure_code:object.last_payment_error?.code,failure_message:object.last_payment_error?.message,updated_at:new Date().toISOString()}).eq("id",payment.id);
    else if (event.type === "charge.dispute.created") await client.from("oc_booking_payments").update({status:"disputed",updated_at:new Date().toISOString()}).eq("id",payment.id);
    else if (event.type === "charge.refunded") { const refunded=object.amount_refunded??0; await client.from("oc_booking_payments").update({amount_refunded:refunded,status:refunded>=payment.amount_captured?"refunded":"partially_refunded",updated_at:new Date().toISOString()}).eq("id",payment.id); }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
