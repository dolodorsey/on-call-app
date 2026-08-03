import { createClient } from "npm:@supabase/supabase-js@2.112.0";
import Stripe from "npm:stripe@18.5.0";

export const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ON_CALL_APP_ORIGIN") ?? "https://oncallallday.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const admin = () => createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const stripe = () => new Stripe(env("STRIPE_SECRET_KEY"), {
  httpClient: Stripe.createFetchHttpClient(),
});

export async function requireUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const client = admin();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required");
  return { client, user: data.user };
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const auth = message === "Authentication required";
  const config = message.endsWith("is not configured");
  return json({ error: config ? "Payments are not configured for this release." : message }, config ? 503 : auth ? 401 : 400);
}
