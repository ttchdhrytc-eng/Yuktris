import { config as dotenvConfig } from 'dotenv';
import { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolvePath(__filename, '..');
dotenvConfig({ path: resolvePath(__dirname, '..', '.env') });
import './polyfill.js';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { Worker } from './worker.js';
import { logger } from './logger.js';
import { browserbase } from './browserbase.js';
import { runtimeWorkerIdentity } from './worker-identity.js';

const HEALTH_PORT = parseInt(process.env.WORKER_PORT || process.env.HEALTH_PORT || '3100', 10);

let worker: Worker | null = null;
let isShuttingDown = false;

async function healthCheck(): Promise<{ status: string; worker_id: string | null; checks: Record<string, string> }> {
  const checks: Record<string, string> = {};

  // Worker process
  checks.worker = worker ? 'alive' : 'dead';
  if (worker) {
    const h = worker.getHealth();
    checks.browserbase = h.browserbase ? 'configured' : 'not configured';
    checks.playwright = 'available';
  } else {
    checks.browserbase = 'worker not started';
    checks.playwright = 'worker not started';
  }

  // Supabase + queue (lightweight query, no browser launch)
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      checks.supabase = 'not configured';
      checks.queue = 'not configured';
    } else {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await client.rpc('get_any_workspace_id');
      checks.supabase = error ? `error: ${error.message}` : 'reachable';
      checks.queue = error ? 'unreachable' : 'reachable';
    }
  } catch (err) {
    checks.supabase = `error: ${String(err)}`;
    checks.queue = 'unreachable';
  }

  const allHealthy = Object.values(checks).every(v => !v.includes('error') && !v.includes('unavailable') && !v.includes('dead') && !v.includes('not'));
  return { status: allHealthy ? 'healthy' : 'degraded', worker_id: worker?.getHealth().workerId ?? null, checks };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      const result = await healthCheck();
      res.writeHead(result.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: String(err) }));
    }
  } else if (req.url === '/ready') {
    const ready = !!worker;
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready, worker_id: worker?.getHealth().workerId ?? null }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

async function main() {
  const identity = runtimeWorkerIdentity();
  const useBrowserbase = browserbase.isConfigured();
  logger.info('LinkedIn Browser Worker starting', {
    health_port: HEALTH_PORT,
    provider: useBrowserbase ? 'browserbase' : 'local-chromium',
    worker_identity_version: identity.version,
    worker_name: identity.workerName,
    deployment_id: identity.deploymentId,
    replica_id: identity.replicaId,
    runtime_id: identity.runtimeId,
    worker_id: identity.id,
  });

  // Startup diagnostics
  logger.info('=== STARTUP DIAGNOSTICS ===');
  logger.info('BROWSERBASE_API_KEY env', { value: process.env.BROWSERBASE_API_KEY ? '***set***' : 'NOT SET' });
  logger.info('BROWSERBASE_PROJECT_ID env', { value: process.env.BROWSERBASE_PROJECT_ID || 'NOT SET' });
  logger.info('CHROMIUM_EXECUTABLE_PATH env', { value: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium (auto-detected)' });
  if (!useBrowserbase) {
    logger.info('Browserbase not configured — using local Chromium automatically');
  } else {
    logger.info('Browserbase configuration verified');
  }
  logger.info('=== END STARTUP DIAGNOSTICS ===');

  await new Promise<void>((resolve) => {
    server.listen(HEALTH_PORT, () => {
      logger.info(`Health server listening on :${HEALTH_PORT}`);
      resolve();
    });
  });

  worker = new Worker(identity.id);
  await worker.start();

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down...`);
    if (worker) await worker.stop();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
