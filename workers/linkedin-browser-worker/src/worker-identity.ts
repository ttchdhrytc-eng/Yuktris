import { randomUUID } from 'node:crypto';

export function runtimeWorkerId(env: NodeJS.ProcessEnv = process.env): string {
  const base = (env.WORKER_ID || 'linkedin-worker').trim();
  const deployment = (env.RAILWAY_DEPLOYMENT_ID || 'local').trim();
  const replica = (env.RAILWAY_REPLICA_ID || env.HOSTNAME || String(process.pid)).trim();
  return `${base}:${deployment}:${replica}:${randomUUID()}`;
}
