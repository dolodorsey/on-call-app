/**
 * Real health endpoint (Vercel serverless function).
 *
 * Previously /health.json fell through the SPA rewrite and returned
 * index.html with a 200 — so monitors reported healthy no matter what.
 * This returns actual JSON with actual checks.
 */
export default async function handler(req, res) {
  const startedAt = Date.now();
  const checks = {};

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    checks.database = 'unconfigured';
  } else {
    try {
      const r = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(4000),
      });
      checks.database = r.ok || r.status === 401 ? 'reachable' : `http_${r.status}`;
    } catch {
      checks.database = 'unreachable';
    }
  }

  const healthy = checks.database === 'reachable';

  res.setHeader('Cache-Control', 'no-store');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    app: 'On Call',
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    environment: process.env.VERCEL_ENV ?? 'development',
    checks,
    latency_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}
