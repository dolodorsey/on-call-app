import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, env, errorResponse, json, requireUser, stripe } from "../_shared/oc-payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { client, user } = await requireUser(req);
    const { data: provider, error } = await client.from("oc_provider_profiles")
      .select("id,stripe_account_id,user:oc_users!oc_provider_profiles_user_id_fkey(auth_id,email)")
      .eq("user.auth_id", user.id).single();
    if (error || !provider || provider.user?.auth_id !== user.id) throw new Error("Approved provider account required");
    let accountId = provider.stripe_account_id;
    if (!accountId) {
      const account = await stripe().accounts.create({
        type: "express", country: "US", email: provider.user?.email ?? user.email,
        capabilities: { transfers: { requested: true } },
        metadata: { brand: "ON_CALL", provider_id: provider.id },
      }, { idempotencyKey: `oc-provider-${provider.id}-connect-v1` });
      accountId = account.id;
      await client.from("oc_provider_profiles").update({ stripe_account_id: accountId, updated_at: new Date().toISOString() }).eq("id", provider.id);
    }
    const origin = env("ON_CALL_APP_ORIGIN");
    const link = await stripe().accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${origin}/?payment=refresh`, return_url: `${origin}/?payment=return` });
    return json({ url: link.url });
  } catch (error) { return errorResponse(error); }
});
