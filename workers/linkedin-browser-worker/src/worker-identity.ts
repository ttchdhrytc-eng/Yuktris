import { randomUUID } from 'node:crypto';

export interface RuntimeWorkerIdentity {
  id: string;
  version: 'v1';
  workerName: string;
  deploymentId: string;
  replicaId: string;
  runtimeId: string;
}

const COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function component(value: string | undefined, fallback: string, label: string): string {
  const result = (value || fallback).trim();
  if (!COMPONENT.test(result)) throw new Error(`Invalid worker identity ${label}`);
  return result;
}

export function isProcessUniqueWorkerId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 5 && parts[0] === 'v1' && parts.slice(1, 4).every(part => COMPONENT.test(part)) && UUID.test(parts[4]);
}

export function runtimeWorkerIdentity(env: NodeJS.ProcessEnv = process.env, runtimeId: string = randomUUID()): RuntimeWorkerIdentity {
  if (!UUID.test(runtimeId)) throw new Error('Invalid worker identity runtime ID');
  const workerName = component(env.WORKER_NAME || env.WORKER_ID, 'linkedin-worker', 'worker name');
  const deploymentId = component(env.RAILWAY_DEPLOYMENT_ID, 'local', 'deployment ID');
  const replicaId = component(env.RAILWAY_REPLICA_ID || env.HOSTNAME, `pid-${process.pid}`, 'replica ID');
  const id = `v1:${workerName}:${deploymentId}:${replicaId}:${runtimeId}`;
  if (!isProcessUniqueWorkerId(id)) throw new Error('Unable to construct process-unique worker identity');
  return { id, version: 'v1', workerName, deploymentId, replicaId, runtimeId };
}

export function runtimeWorkerId(env: NodeJS.ProcessEnv = process.env): string {
  return runtimeWorkerIdentity(env).id;
}
