import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.0'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
}

async function readRuntimeSecret(name: string): Promise<string | null> {
  const direct = Deno.env.get(name)?.trim()
  if (direct) return direct

  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return null

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.rpc('sos_get_runtime_secret', { secret_name: name })
  if (error || typeof data !== 'string' || !data.trim()) return null
  return data.trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  const startedAt = Date.now()
  try {
    const [stripeSecretKey, webhookSecret] = await Promise.all([
      readRuntimeSecret('STRIPE_SECRET_KEY'),
      readRuntimeSecret('STRIPE_WEBHOOK_SECRET'),
    ])

    let stripeApi: 'reachable' | 'unreachable' | 'unconfigured' = 'unconfigured'
    let stripeHttpStatus: number | null = null
    let stripeLatencyMs: number | null = null

    if (stripeSecretKey) {
      const stripeStartedAt = Date.now()
      try {
        const response = await fetch('https://api.stripe.com/v1/balance', {
          method: 'GET',
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
          signal: AbortSignal.timeout(5000),
        })
        stripeLatencyMs = Date.now() - stripeStartedAt
        stripeHttpStatus = response.status
        stripeApi = response.ok ? 'reachable' : 'unreachable'
      } catch {
        stripeLatencyMs = Date.now() - stripeStartedAt
        stripeApi = 'unreachable'
      }
    }

    const ready = Boolean(stripeSecretKey && webhookSecret && stripeApi === 'reachable')
    return new Response(JSON.stringify({
      ready,
      app: 'ON CALL',
      scope: 'on_call_marketplace',
      checks: {
        stripe_server_credential: stripeSecretKey ? 'configured' : 'missing',
        webhook_signature_secret: webhookSecret ? 'configured' : 'missing',
        stripe_api: stripeApi,
        stripe_http_status: stripeHttpStatus,
        stripe_latency_ms: stripeLatencyMs,
      },
      message: ready
        ? 'Marketplace payment runtime is configured and Stripe authorization is reachable.'
        : 'Marketplace payment runtime is degraded; live money movement remains fail-closed.',
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }), { status: ready ? 200 : 503, headers })
  } catch (error) {
    console.error('marketplace payments health failed', error)
    return new Response(JSON.stringify({
      ready: false,
      app: 'ON CALL',
      scope: 'on_call_marketplace',
      error: 'Payment runtime health check failed.',
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }), { status: 503, headers })
  }
})
