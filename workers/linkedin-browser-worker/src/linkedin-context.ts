import { SupabaseClient } from '@supabase/supabase-js';
import { browserbase, BrowserbaseError, CreateSessionOptions } from './browserbase.js';
import { logger } from './logger.js';

export interface ContextRecord {
  id: string;
  workspace_id: string;
  account_id: string;
  provider_context_id: string | null;
  status: string;
  generation: number;
  active_browserbase_session_id?: string | null;
}

export interface ContextPolicy { enrolled: boolean; has_persistent_context: boolean; }
interface DeletionJob { id: string; provider_context_id: string; attempt_id: string; }

export interface ContextLeaseOwner {
  workspaceId: string;
  accountId: string;
  queueItemId: string;
  workerId: string;
  attemptId: string;
}

export function persistentContextsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LINKEDIN_PERSISTENT_CONTEXTS_ENABLED?.trim().toLowerCase() === 'true';
}

export function sessionOptionsForAccount(enabled: boolean, context?: ContextRecord | null): CreateSessionOptions {
  if (!enabled) return { keepAlive: true };
  if (!context?.provider_context_id || !['active', 'in_use'].includes(context.status)) {
    throw new BrowserbaseError('Persistent browser Context is unavailable for the enrolled account', 409);
  }
  return { keepAlive: true, contextId: context.provider_context_id, persistContext: true, requirePersistentContext: true };
}

function first<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function sanitizedProviderFailure(error: unknown): { code: string; message: string } {
  if (error instanceof BrowserbaseError) return { code: `browserbase_${error.statusCode}`, message: error.message };
  return { code: 'browserbase_error', message: 'Browserbase Context operation failed' };
}

export class LinkedInContextService {
  constructor(private readonly client: SupabaseClient) {}

  async policy(workspaceId: string, accountId: string): Promise<ContextPolicy> {
    const { data, error } = await this.client.rpc('get_linkedin_browser_context_policy', {
      p_workspace_id: workspaceId, p_account_id: accountId,
    });
    if (error) throw new Error(`Context policy lookup failed: ${error.message}`);
    const policy = first(data as ContextPolicy | ContextPolicy[] | null);
    if (!policy) throw new Error('Context policy lookup returned no account');
    return policy;
  }

  async shouldUsePersistentContext(workspaceId: string, accountId: string, globalEnabled = persistentContextsEnabled()): Promise<boolean> {
    const policy = await this.policy(workspaceId, accountId);
    if (!globalEnabled) {
      if (policy.has_persistent_context) throw new Error('Persistent Context account is paused while the global feature flag is disabled');
      return false;
    }
    if (!policy.enrolled) {
      if (policy.has_persistent_context) throw new Error('Persistent Context account is not enrolled; refusing fresh browser fallback');
      return false;
    }
    return true;
  }

  async reserve(workspaceId: string, accountId: string): Promise<ContextRecord> {
    const { data, error } = await this.client.rpc('reserve_linkedin_browser_context', {
      p_workspace_id: workspaceId, p_account_id: accountId, p_provider: 'browserbase',
    });
    if (error) throw new Error(`Context reservation failed: ${error.message}`);
    const record = first(data as ContextRecord | ContextRecord[] | null);
    if (!record) throw new Error('Context reservation returned no record');
    return record;
  }

  async ensureProvisioned(owner: ContextLeaseOwner): Promise<ContextRecord> {
    const reserved = await this.reserve(owner.workspaceId, owner.accountId);
    if (reserved.provider_context_id) return reserved;
    if (reserved.status !== 'provisioning') throw new Error('Persistent browser Context is not provisionable');
    const claim = await this.client.rpc('claim_linkedin_browser_context_provisioning', {
      p_context_id:reserved.id,p_workspace_id:owner.workspaceId,p_account_id:owner.accountId,
      p_queue_item_id:owner.queueItemId,p_worker_id:owner.workerId,p_attempt_id:owner.attemptId,
    });
    if (claim.error || claim.data !== true) throw new Error('Persistent browser Context provisioning is owned by another attempt');
    try {
      const created = await browserbase.createContext();
      const { error } = await this.client.rpc('complete_linkedin_browser_context_provisioning', {
        p_context_id: reserved.id, p_workspace_id: owner.workspaceId, p_account_id: owner.accountId,
        p_provider_context_id: created.id,
      });
      if (error) throw new Error('Context provisioning completion failed');
      return { ...reserved, provider_context_id: created.id, status: 'active' };
    } catch (error) {
      const failure = sanitizedProviderFailure(error);
      await this.client.rpc('fail_linkedin_browser_context_provisioning', {
        p_context_id: reserved.id, p_workspace_id: owner.workspaceId, p_account_id: owner.accountId,
        p_failure_code: failure.code, p_failure_message: failure.message,
      });
      logger.error('Persistent browser Context provisioning failed', { code: failure.code });
      throw new Error(failure.message);
    }
  }

  async acquire(owner: ContextLeaseOwner): Promise<ContextRecord> {
    const { data, error } = await this.client.rpc('acquire_linkedin_browser_context_lease', {
      p_workspace_id: owner.workspaceId, p_account_id: owner.accountId, p_queue_item_id: owner.queueItemId,
      p_worker_id: owner.workerId, p_attempt_id: owner.attemptId, p_lease_seconds: 90,
    });
    if (error) throw new Error(`Context lease acquisition failed: ${error.message}`);
    const record = first(data as ContextRecord | ContextRecord[] | null);
    if (!record) throw new Error('Context lease acquisition returned no record');
    return record;
  }

  async reconcileBeforeSession(context: ContextRecord, owner: ContextLeaseOwner): Promise<void> {
    const sessionId = context.active_browserbase_session_id;
    if (!sessionId) return;
    const status = await browserbase.getSessionStatus(sessionId);
    if (status === 'running' || status === 'unknown') {
      throw new BrowserbaseError('A previous persistent browser session is still active or cannot be safely reconciled', 409);
    }
    await browserbase.settleClosedContext(sessionId, context.provider_context_id!);
    const { error } = await this.client.rpc('reconcile_terminal_linkedin_browser_context_session', {
      p_context_id: context.id,p_queue_item_id: owner.queueItemId,p_worker_id: owner.workerId,
      p_attempt_id: owner.attemptId,p_session_id: sessionId,
    });
    if (error) throw new Error(`Context stale-session reconciliation failed: ${error.message}`);
  }

  async renew(contextId: string, owner: ContextLeaseOwner): Promise<boolean> {
    const { data, error } = await this.client.rpc('renew_linkedin_browser_context_lease', {
      p_context_id: contextId, p_queue_item_id: owner.queueItemId, p_worker_id: owner.workerId,
      p_attempt_id: owner.attemptId, p_lease_seconds: 90,
    });
    if (error) throw new Error(`Context lease renewal failed: ${error.message}`);
    return data === true;
  }

  async attachSession(contextId: string, sessionId: string, owner: ContextLeaseOwner): Promise<void> {
    const { error } = await this.client.rpc('set_linkedin_browser_context_session', {
      p_context_id: contextId, p_queue_item_id: owner.queueItemId, p_worker_id: owner.workerId,
      p_attempt_id: owner.attemptId, p_browserbase_session_id: sessionId,
    });
    if (error) throw new Error(`Context session attachment failed: ${error.message}`);
  }

  async synchronize(context: ContextRecord, sessionId: string, owner: ContextLeaseOwner): Promise<void> {
    const ownership = { p_context_id: context.id, p_queue_item_id: owner.queueItemId, p_worker_id: owner.workerId, p_attempt_id: owner.attemptId };
    const begin = await this.client.rpc('begin_linkedin_browser_context_synchronization', ownership);
    if (begin.error) throw new Error(`Context synchronization start failed: ${begin.error.message}`);
    await browserbase.waitForContextSynchronization(sessionId, context.provider_context_id!);
    const complete = await this.client.rpc('complete_linkedin_browser_context_synchronization', ownership);
    if (complete.error) throw new Error(`Context synchronization completion failed: ${complete.error.message}`);
  }

  async release(contextId: string, owner: ContextLeaseOwner): Promise<boolean> {
    const { data, error } = await this.client.rpc('release_linkedin_browser_context_lease', {
      p_context_id: contextId, p_queue_item_id: owner.queueItemId, p_worker_id: owner.workerId, p_attempt_id: owner.attemptId,
    });
    if (error) throw new Error(`Context lease release failed: ${error.message}`);
    return data === true;
  }

  async reconcileSession(sessionId: string): Promise<'completed' | 'error'> {
    return browserbase.waitForSessionTerminal(sessionId);
  }

  async invalidate(context: ContextRecord, code = 'invalidated'): Promise<void> {
    const { error } = await this.client.rpc('invalidate_linkedin_browser_context', {
      p_context_id: context.id, p_workspace_id: context.workspace_id, p_account_id: context.account_id, p_failure_code: code,
    });
    if (error) throw new Error(`Context invalidation failed: ${error.message}`);
  }

  async processOneDeletion(workerId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('claim_linkedin_browser_context_deletion', {
      p_worker_id: workerId, p_lease_seconds: 90,
    });
    if (error) throw new Error(`Context deletion claim failed: ${error.message}`);
    const job = first(data as DeletionJob | DeletionJob[] | null);
    if (!job) return false;
    try {
      const outcome = await browserbase.deleteContext(job.provider_context_id);
      const completed = await this.client.rpc('complete_linkedin_browser_context_deletion', {
        p_job_id: job.id,p_worker_id: workerId,p_attempt_id: job.attempt_id,
      });
      if (completed.error || completed.data !== true) throw new Error('Context deletion completion lost ownership');
      logger.info('Persistent browser Context cleanup completed', { providerOutcome: outcome });
    } catch (providerError) {
      const failure = sanitizedProviderFailure(providerError);
      await this.client.rpc('retry_linkedin_browser_context_deletion', {
        p_job_id:job.id,p_worker_id:workerId,p_attempt_id:job.attempt_id,
        p_failure_code:failure.code,p_failure_message:failure.message,
      });
      logger.warn('Persistent browser Context cleanup deferred', { code: failure.code });
    }
    return true;
  }
}
