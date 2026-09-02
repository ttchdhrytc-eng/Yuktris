import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { Queue, QueueItem } from './queue.js';
import { LinkedInBrowser, SessionData, ProgressStep, ProgressCallback, IntendedLinkedInIdentity } from './linkedin.js';
import { encrypt, decrypt, decryptLinkedInCredential, getKeyId } from './session.js';
import { browserbase, BrowserbaseError } from './browserbase.js';
import { createHash } from 'node:crypto';
import { ContextLeaseOwner, ContextRecord, LinkedInContextService, persistentContextsEnabled, sessionOptionsForAccount } from './linkedin-context.js';
import { interactiveAuthTimeoutMs, interactiveBrowserSessionTimeoutMs } from './interactive-auth-config.js';
import { normalizeLinkedInAction, validateSalesNavigatorPayload } from './linkedin-agent-contract.js';
import { CloudAgentStartupError, cloudAgentStartupTimeoutMs, withinStartupDeadline } from './startup-deadline.js';
import { finalizeLinkedInWrite, LINKEDIN_WRITE_ACTIONS, normalizeLinkedInTarget, preflightLinkedInWrite } from './linkedin-execution-safety.js';
import { classifyConnectionProfileState, classifyPostClickOutcome, isNoNoteConfirmCandidate, NO_NOTE_CONFIRM_LABELS } from './connection-dialog.js';
import { classifyRelationshipProbe, type RelationshipProbeEvidence } from './relationship-probe.js';
import { waitForLinkedInProfileReady } from './linkedin-profile-readiness.js';
import { failureOutcomeForStage, type WriteInteractionStage } from './write-interaction-stage.js';
import type { ElementHandle, Locator, Page } from 'playwright';
import { isProcessUniqueWorkerId, runtimeWorkerId } from './worker-identity.js';
import { TaskOwnershipLifecycle } from './task-ownership.js';
import { LinkedInExecutionGate, resolveLinkedInExecutionGate } from './execution-mode.js';
import { productionAcceptanceAuthorizationId } from './production-acceptance.js';
import { verifyLinkedInDisplayName } from './linkedin-profile-identity.js';
import { productionAcceptanceScheduleCandidate } from './production-acceptance-schedule.js';

const INTERACTIVE_AUTH_TIMEOUT_MS = interactiveAuthTimeoutMs();
const TEST_CONNECTION_TIMEOUT = parseInt(process.env.TEST_CONNECTION_TIMEOUT_MS || '120000', 10);
const INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS = interactiveBrowserSessionTimeoutMs();
const HEARTBEAT_INTERVAL = parseInt(process.env.WORKER_HEARTBEAT_INTERVAL || '15000', 10);
const POLL_INTERVAL = parseInt(process.env.QUEUE_POLL_INTERVAL || '3000', 10);
const SESSION_HEARTBEAT_INTERVAL = parseInt(process.env.SESSION_HEARTBEAT_INTERVAL_MS || '120000', 10);
const MAX_CONCURRENT_ACCOUNTS = Math.max(1, Math.min(10, parseInt(process.env.LINKEDIN_WORKER_CONCURRENCY || '4', 10)));
const CLOUD_AGENT_STARTUP_TIMEOUT_MS = cloudAgentStartupTimeoutMs();

export class Worker {
  private client: SupabaseClient;
  private workerId: string;
  private workerName: string;
  private region: string;
  private encryptionSecret: string;
  private credentialEncryptionSecret: string;
  private executionGate: LinkedInExecutionGate;
  private acceptanceAuthorizationId: string | null;
  private queue: Queue;
  private linkedin: LinkedInBrowser;
  private linkedinContexts: LinkedInContextService;
  private activeContextLease: {
    context: ContextRecord;
    owner: ContextLeaseOwner;
  } | null = null;
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentTaskId: string | null = null;
  private activeTasks = new Map<string, Promise<void>>();
  private activeTaskWorkers = new Map<string, Worker>();
  private workspaceId: string | null = null;
  private lastAutonomousMaintenanceAt = 0;

  private async storeRelationshipProbeScreenshot(
    item: QueueItem,
    page: Page,
    screenshotType: string,
    locator?: Locator,
  ): Promise<{ id: string; storage_path: string; screenshot_type: string }> {
    const storagePath = `${item.workspace_id}/relationship-probes/${item.id}/${screenshotType}.jpeg`;
    const image = locator
      ? await locator.screenshot({ type: 'jpeg', quality: 82 })
      : await page.screenshot({ type: 'jpeg', quality: 78, fullPage: true });
    const { error: uploadError } = await this.client.storage
      .from('browser-screenshots')
      .upload(storagePath, image, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw new Error(`Diagnostic screenshot upload failed: ${this.sanitizeError(uploadError)}`);
    const viewport = await page.evaluate(() => ({
      width: innerWidth, height: innerHeight, device_scale_factor: devicePixelRatio,
    }));
    const { data, error } = await this.client.from('browser_screenshots').insert({
      workspace_id: item.workspace_id,
      screenshot_type: screenshotType,
      storage_path: storagePath,
      url: page.url(),
      page_title: (await page.title()).slice(0, 200),
      viewport,
      file_size_bytes: image.byteLength,
      metadata: {
        queue_item_id: item.id,
        worker_attempt_id: item.attempt_id,
        browserbase_session_id: this.linkedin.getSessionId(),
        forensic_read_only: true,
      },
    }).select('id, storage_path, screenshot_type').single();
    if (error || !data) throw new Error(`Diagnostic screenshot metadata failed: ${this.sanitizeError(error)}`);
    return data;
  }

  constructor(workerIdOverride?: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encKey = process.env.LINKEDIN_SESSION_ENCRYPTION_KEY;
    const credentialKey = process.env.LINKEDIN_CREDENTIAL_ENCRYPTION_KEY;

    if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    if (!encKey) throw new Error('Missing LINKEDIN_SESSION_ENCRYPTION_KEY — generate with: openssl rand -base64 32');

    this.executionGate = resolveLinkedInExecutionGate(process.env.LINKEDIN_EXECUTION_MODE);
    this.acceptanceAuthorizationId = productionAcceptanceAuthorizationId(process.env.LINKEDIN_PRODUCTION_ACCEPTANCE_AUTHORIZATION_ID);
    if (credentialKey && credentialKey.length < 32) throw new Error('Invalid LINKEDIN_CREDENTIAL_ENCRYPTION_KEY');
    this.client = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    this.workerId = workerIdOverride || runtimeWorkerId();
    if (!isProcessUniqueWorkerId(this.workerId)) throw new Error('Worker durable identity must satisfy the process-unique v1 contract');
    this.workerName = `linkedin-worker-${this.workerId}`;
    this.region = process.env.WORKER_REGION || 'local';
    this.encryptionSecret = encKey;
    this.credentialEncryptionSecret = credentialKey || '';

    this.queue = new Queue(this.client, this.workerId, POLL_INTERVAL);
    this.linkedin = new LinkedInBrowser(this.client, true, this.encryptionSecret);
    this.linkedinContexts = new LinkedInContextService(this.client);
    logger.info('Worker environment identity', {
      deployment_environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || 'unspecified',
      node_env: process.env.NODE_ENV || 'unspecified',
      supabase_host: new URL(supabaseUrl).hostname,
      browserbase_project_suffix: process.env.BROWSERBASE_PROJECT_ID?.slice(-6) || null,
    });
  }

  getHealth(): {
    workerId: string;
      browserbase: boolean;
      running: boolean;
      currentTask: string | null;
      outboundEnabled: boolean;
  } {
    return {
      workerId: this.workerId,
      browserbase: browserbase.isConfigured(),
      running: this.running,
      currentTask: this.currentTaskId,
      outboundEnabled: this.executionGate.outboundEnabled,
    };
  }

  async start(): Promise<void> {
    const useBrowserbase = browserbase.isConfigured();
    logger.info('Worker starting', {
      id: this.workerId,
      region: this.region,
      provider: useBrowserbase ? 'browserbase' : 'local-chromium',
    });
    logger.info('Environment check', {
      SUPABASE_URL_set: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      LINKEDIN_SESSION_ENCRYPTION_KEY_set: !!process.env.LINKEDIN_SESSION_ENCRYPTION_KEY,
      LINKEDIN_CREDENTIAL_ENCRYPTION_KEY_set: !!process.env.LINKEDIN_CREDENTIAL_ENCRYPTION_KEY,
      BROWSERBASE_API_KEY_set: !!process.env.BROWSERBASE_API_KEY,
      BROWSERBASE_PROJECT_ID_set: !!process.env.BROWSERBASE_PROJECT_ID,
      WORKER_ID: this.workerId,
      WORKER_PORT: process.env.WORKER_PORT || '3100',
      POLL_INTERVAL: POLL_INTERVAL,
      HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
      INTERACTIVE_AUTH_TIMEOUT_MS,
      INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS,
      LINKEDIN_OUTBOUND_ENABLED: this.executionGate.outboundEnabled,
      LINKEDIN_EXECUTION_GATE_REASON: this.executionGate.reason,
      LINKEDIN_PRODUCTION_ACCEPTANCE_ARMED: !!this.acceptanceAuthorizationId,
    });

    // Auto-detect browser provider (Fix 4): use Browserbase if configured, else local Chromium
    if (useBrowserbase) {
      logger.info('Browserbase configuration detected', {
        projectId: process.env.BROWSERBASE_PROJECT_ID ? '***set***' : 'NOT SET',
      });
    } else {
      logger.info('Browserbase not configured — using local Chromium automatically');
    }

    // Verify Supabase connectivity via RPC
    const { error: rpcError } = await this.client.rpc('get_any_workspace_id');
    if (rpcError) throw new Error(`Supabase not accessible: ${rpcError.message}`);
    logger.info('Supabase connection verified');

    // browser_workers currently requires a workspace_id even though this worker
    // consumes the global, workspace-scoped queue. An empty installation is a
    // valid idle state, so defer the bookkeeping registration until a workspace
    // exists instead of terminating the process.
    await this.ensureRegistered();

    // Recover only database-expired ownership. The queue lease is renewed by
    // healthy tasks, so elapsed wall time alone must never steal long work.
    try {
      const { data: recovered, error: recoverError } = await this.client.rpc('recover_expired_browser_queue_leases', { p_limit: 50 });
      if (recoverError) {
        logger.warn('Queue recovery RPC error', {
          error: recoverError.message,
        });
      } else if (recovered && Number(recovered) > 0) {
        logger.info('Recovered orphaned queue tasks', {
          count: Number(recovered),
        });
      }
    } catch (err) {
      logger.warn('Queue recovery failed', { error: String(err) });
    }

    // Fix 12: Run session cleanup on startup
    try {
      await this.client.rpc('cleanup_old_sessions');
      logger.info('Session cleanup completed');
    } catch (err) {
      logger.warn('Session cleanup failed', { error: String(err) });
    }

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL);

    // Start session heartbeat (keep sessions alive)
    this.sessionHeartbeatTimer = setInterval(() => this.sessionHeartbeat(), SESSION_HEARTBEAT_INTERVAL);

    // Start queue polling
    this.running = true;
    this.pollLoop();

    logger.info('Worker started, polling queue');
  }

  async stop(): Promise<void> {
    logger.info('Worker stopping');
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.sessionHeartbeatTimer) {
      clearInterval(this.sessionHeartbeatTimer);
      this.sessionHeartbeatTimer = null;
    }
    for (const taskWorker of this.activeTaskWorkers.values())
      taskWorker.linkedin.cancel('Worker is shutting down');
    if (this.activeTasks.size) {
      await Promise.race([
        Promise.allSettled(this.activeTasks.values()),
        new Promise((resolve) => setTimeout(resolve, 20_000)),
      ]);
    }
    await this.linkedin.close();
    const { error: stopErr } = await this.client.rpc('set_browser_worker_closing', { p_worker_id: this.workerId });
    if (stopErr)
      logger.error('Failed to mark worker as closing', {
        error: stopErr.message,
      });
    logger.info('Worker stopped');
  }

  private async register(): Promise<void> {
    const metadata = {
      worker_region: this.region,
      browser_provider: browserbase.isConfigured() ? 'browserbase' : 'local-chromium',
      capabilities: ['linkedin_connect', 'linkedin_test_connection', 'linkedin_action'],
      outbound_enabled: this.executionGate.outboundEnabled,
    };

    const { error } = await this.client.rpc('register_browser_worker', {
      p_worker_id: this.workerId,
      p_worker_name: this.workerName,
      p_workspace_id: this.workspaceId,
      p_metadata: metadata,
    });

    if (error) {
      logger.error('Worker registration failed', { error: error.message });
      throw error;
    }
    logger.info('Worker registered', { id: this.workerId });
  }

  private async ensureRegistered(): Promise<boolean> {
    if (this.workspaceId) return true;

    const { data: wsId, error } = await this.client.rpc('get_any_workspace_id');
    if (error) throw new Error(`Unable to resolve workspace for worker registration: ${error.message}`);
    if (!wsId) {
      logger.warn('No workspaces available; worker will remain healthy and idle until one is created');
      return false;
    }

    this.workspaceId = wsId as string;
    try {
      await this.register();
      return true;
    } catch (error) {
      this.workspaceId = null;
      throw error;
    }
  }

  private async heartbeat(): Promise<void> {
    const now = new Date().toISOString();
    try {
      if (!(await this.ensureRegistered())) return;
      await this.client.rpc('heartbeat_browser_worker', {
        p_worker_id: this.workerId,
        p_status: this.running ? 'idle' : 'closing',
        p_metadata: {
          last_heartbeat: now,
          current_task: this.currentTaskId,
          browser_provider: browserbase.isConfigured() ? 'browserbase' : 'local-chromium',
          outbound_enabled: this.executionGate.outboundEnabled,
        },
      });
    } catch (err) {
      logger.error('Heartbeat failed', { error: String(err) });
    }
  }

  // ── Session Heartbeat (keep sessions alive) ────────────────

  private async sessionHeartbeat(): Promise<void> {
    try {
      const { data: accounts, error } = await this.client.rpc('get_connected_accounts');
      if (error || !accounts || (Array.isArray(accounts) && accounts.length === 0)) return;

      const accountList = Array.isArray(accounts) ? accounts : [accounts];
      for (const acc of accountList) {
        await this.client.rpc('insert_session_heartbeat', {
          p_workspace_id: acc.workspace_id,
          p_account_id: acc.id,
          p_worker_id: this.workerId,
          p_status: 'alive',
          p_metadata: { heartbeat_at: new Date().toISOString() },
        });
        await this.client.rpc('touch_account_activity', {
          p_account_id: acc.id,
        });
      }

      const cutoff = new Date(Date.now() - 3600000).toISOString();
      await this.client.rpc('cleanup_old_heartbeats', { p_cutoff: cutoff });

      logger.info('Session heartbeat sent', { accounts: accountList.length });
    } catch (err) {
      logger.error('Session heartbeat failed', { error: String(err) });
    }
  }

  private async pollLoop(): Promise<void> {
    logger.info('Poll loop started', {
      worker_id: this.workerId,
      poll_interval_ms: POLL_INTERVAL,
    });
    let pollCount = 0;
    while (this.running) {
      pollCount++;
      try {
        if (browserbase.isConfigured()) {
          await this.linkedinContexts.processOneDeletion(this.workerId);
        }
        if (Date.now() - this.lastAutonomousMaintenanceAt >= 60_000) {
          this.lastAutonomousMaintenanceAt = Date.now();
          await this.runAutonomousMaintenance().catch((error) => {
            logger.warn('LinkedIn autonomous maintenance failed', {
              error: this.sanitizeError(error),
            });
          });
        }
        if (this.activeTasks.size >= MAX_CONCURRENT_ACCOUNTS) {
          logger.info('Cloud agent concurrency capacity reached', {
            active_tasks: this.activeTasks.size,
            capacity: MAX_CONCURRENT_ACCOUNTS,
          });
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
          continue;
        }
        if (!this.executionGate.outboundEnabled && (pollCount === 1 || pollCount % 20 === 0))
          logger.info('Global LinkedIn outbound gate disabled; polling authentication bootstrap only', {
            worker_id: this.workerId,
            reason: this.executionGate.reason,
          });
        const item = this.executionGate.outboundEnabled
          ? await this.queue.claimNext()
          : this.acceptanceAuthorizationId
            ? await this.queue.claimProductionAcceptance(this.acceptanceAuthorizationId)
            : await this.queue.claimNextAuthentication();
        if (item) {
          if (item.action_type === 'linkedin_connect')
            logger.info('LinkedIn queue orchestration timing', {
              queue_item_id: item.id,
              workspace_id: item.workspace_id,
              account_id: item.account_id,
              stage: 'Q3_worker_claimed',
              timestamp: new Date().toISOString(),
            });
          logger.info(`Poll #${pollCount}: task claimed, processing`, {
            task_id: item.id,
            action: item.action_type,
          });
          // Each account task owns its own browser/controller state. Database
          // Context leases still serialize the same account, while unrelated
          // accounts no longer wait behind a 30-minute human login.
          // Queue ownership is bound to the process worker ID used by claimNext.
          // Per-task browser controllers must retain that exact identity.
          const taskWorker = new Worker(this.workerId);
          taskWorker.workspaceId = this.workspaceId;
          taskWorker.queue.rememberClaim(item);
          this.activeTaskWorkers.set(item.id, taskWorker);
          const task = taskWorker
            .processTask(item)
            .catch((error) => {
              logger.error('Concurrent task runner failed', {
                task_id: item.id,
                error: taskWorker.sanitizeError(error),
              });
            })
            .finally(() => {
              this.activeTasks.delete(item.id);
              this.activeTaskWorkers.delete(item.id);
            });
          this.activeTasks.set(item.id, task);
        } else {
          logger.info(`Poll #${pollCount}: no tasks`, {
            worker_id: this.workerId,
          });
        }
      } catch (err) {
        logger.error('Poll loop error', {
          poll_count: pollCount,
          error: String(err),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
    logger.info('Poll loop stopped', { worker_id: this.workerId });
  }

  private async runAutonomousMaintenance(): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { data: rows, error } = await this.client.from('linkedin_accounts').select('workspace_id').eq('connection_state', 'connected').limit(100);
    if (error) throw new Error(`Unable to load connected LinkedIn workspaces: ${error.message}`);
    const workspaceIds = [...new Set((rows ?? []).map((row: { workspace_id?: string | null }) => row.workspace_id).filter(Boolean))] as string[];

    for (const workspaceId of workspaceIds) {
      const { error: reconcileError } = await this.client.rpc('reconcile_linkedin_v1_pipeline', { p_workspace_id: workspaceId });
      if (reconcileError && !/function .* does not exist/i.test(reconcileError.message)) {
        logger.warn('Pipeline reconciliation RPC failed', {
          workspace_id: workspaceId,
          error: reconcileError.message,
        });
      }
      const { error: followupError } = await this.client.rpc('schedule_due_linkedin_followups', { p_workspace_id: workspaceId, p_limit: 50 });
      if (followupError)
        logger.warn('Follow-up scheduler RPC failed', {
          workspace_id: workspaceId,
          error: followupError.message,
        });
      const { error: replyCheckError } = await this.client.rpc('schedule_linkedin_reply_checks', { p_workspace_id: workspaceId, p_limit: 50 });
      if (replyCheckError)
        logger.warn('Reply-check scheduler RPC failed', {
          workspace_id: workspaceId,
          error: replyCheckError.message,
        });

      // Bridge due execution jobs to the browser queue. This removes any dependency
      // on a user clicking a button or on a separate cron worker.
      const { data: jobs } = await this.client.from('linkedin_execution_jobs').select('id,status,scheduled_at').eq('workspace_id', workspaceId).in('status', ['queued', 'scheduled']).order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(20);
      const now = Date.now();
      for (const job of jobs ?? []) {
        if (job.scheduled_at && new Date(job.scheduled_at).getTime() > now) continue;
        const response = await fetch(`${supabaseUrl}/functions/v1/linkedin-job-runner`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({ workspace_id: workspaceId, job_id: job.id }),
        });
        if (!response.ok && response.status !== 409) {
          logger.warn('Execution-job bridge failed', {
            workspace_id: workspaceId,
            job_id: job.id,
            status: response.status,
          });
        }
      }

      // AI-process any matched inbound replies and queue objection handling or meeting actions.
      const conversationResponse = await fetch(`${supabaseUrl}/functions/v1/linkedin-conversation-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          action: 'process_pending',
          workspace_id: workspaceId,
        }),
      });
      if (!conversationResponse.ok) {
        const responseError = await readSafeFunctionError(conversationResponse);
        logger.warn('Conversation maintenance failed', {
          workspace_id: workspaceId,
          status: conversationResponse.status,
          ...responseError,
        });
      }
    }
  }

  private async processTask(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    if (item.action_type === 'linkedin_connect' && startTime - new Date(item.created_at).getTime() > CLOUD_AGENT_STARTUP_TIMEOUT_MS) {
      await this.queue.fail(item.id, 'Cloud LinkedIn Agent could not start within the infrastructure deadline', 0, false);
      logger.warn('cloud_agent_startup_failed', {
        queue_item_id: item.id,
        stage: 'queue_wait',
        classification: 'startup_timeout',
      });
      return;
    }
    let leaseLost = false;
    const ownership = new TaskOwnershipLifecycle(this.queue, item.id, (reason) => {
      leaseLost = true;
      this.linkedin.cancel(reason);
    }, (error) => logger.warn('Queue lease renewal failed', {
      task_id: item.id,
      error: this.sanitizeError(error),
    }));
    await ownership.start();
    const contextLeaseTimer = setInterval(() => {
      const active = this.activeContextLease;
      if (active)
        void this.linkedinContexts
          .renew(active.context.id, active.owner)
          .then((renewed) => {
            if (!renewed) this.linkedin.cancel('Persistent Context lease ownership lost');
          })
          .catch((error) => {
            logger.warn('Persistent Context lease renewal failed', {
              error: this.sanitizeError(error),
            });
            this.linkedin.cancel('Persistent Context lease could not be renewed');
          });
    }, 30000);
    logger.info('Processing task', {
      id: item.id,
      action: item.action_type,
      workspace: item.workspace_id,
      account: item.account_id,
    });
    this.currentTaskId = item.id;

    try {
      await this.client.rpc('heartbeat_browser_worker', {
        p_worker_id: this.workerId,
        p_status: 'busy',
        p_metadata: { current_task: item.id },
      });
    } catch (err) {
      logger.error('Heartbeat failed', { error: String(err) });
    }

    try {
      const normalizedAction = normalizeLinkedInAction(item.action_type);
      const normalizedItem = normalizedAction === item.action_type ? item : { ...item, action_type: normalizedAction };
      switch (normalizedAction) {
        case 'linkedin_connect':
          await this.handleConnect(normalizedItem, startTime);
          break;
        case 'linkedin_test_connection':
          await this.handleTestConnection(normalizedItem, startTime);
          break;
        case 'profile_visit':
        case 'read_profile':
        case 'check_connection_acceptance':
        case 'connection_request':
        case 'send_message':
        case 'follow_up_message':
        case 'like_post':
        case 'follow_company':
        case 'endorse_skills':
        case 'search_people':
        case 'sales_nav_search':
        case 'read_inbox':
        case 'read_replies':
          await this.handleAutomationAction(normalizedItem, startTime);
          break;
        default:
          logger.warn('Unknown action type', { action: item.action_type });
          await this.queue.fail(item.id, `Unknown action type: ${item.action_type}`, Date.now() - startTime, false);
      }
    } catch (err) {
      const msg = err instanceof CloudAgentStartupError ? 'Cloud LinkedIn Agent could not start within the infrastructure deadline' : this.sanitizeError(err);
      const isBbError = err instanceof BrowserbaseError;
      const isRetryable = !(err instanceof CloudAgentStartupError) && isBbError && ![401, 402, 403].includes((err as BrowserbaseError).statusCode);
      logger.error('Task processing error', {
        id: item.id,
        error: msg,
        browserbase_error: isBbError,
        retryable: isRetryable,
      });
      await this.queue.fail(item.id, msg, Date.now() - startTime, isRetryable);
    } finally {
      ownership.stop();
      clearInterval(contextLeaseTimer);
      this.currentTaskId = null;
      // Every task owns a short-lived browser session. Cleanup is idempotent and
      // prevents Browserbase keep-alive sessions from leaking on unexpected errors.
      await this.linkedin.close().catch((error) => {
        logger.warn('Browser cleanup after task failed', {
          task_id: item.id,
          error: this.sanitizeError(error),
        });
      });
      if (this.activeContextLease) {
        const active = this.activeContextLease;
        this.activeContextLease = null;
        await this.linkedinContexts.release(active.context.id, active.owner).catch((error) => {
          logger.warn('Persistent Context lease release failed', {
            error: this.sanitizeError(error),
          });
        });
      }
      await this.queue.releaseAccountLease(item.id).catch((error) => {
        logger.warn('LinkedIn account browser lease release failed', {
          task_id: item.id,
          error: this.sanitizeError(error),
        });
      });
      if (item.action_type === 'linkedin_connect' && item.account_id) {
        await this.cleanupConnectionArtifacts(item.workspace_id, item.account_id).catch((error) => {
          logger.warn('Connection artifact cleanup failed', {
            account_id: item.account_id,
            error: this.sanitizeError(error),
          });
        });
      }
      if (leaseLost)
        logger.warn('Task ended after queue lease ownership was lost', {
          task_id: item.id,
        });
    }
  }

  // ── Progress Helper ─────────────────────────────────────────

  private makeProgressCallback(workspaceId: string, accountId: string, queueItemId: string): ProgressCallback {
    return async (step: ProgressStep, message: string, metadata?: Record<string, unknown>) => {
      logger.info('Progress', { step, message, account_id: accountId });
      try {
        if (step === 'challenge_detected' || step === 'waiting_for_user' || step === 'human_challenge_required' || step === 'provider_rechallenge') {
          await this.updateAccount(accountId, {
            connection_state: 'requires_action',
            last_error: null,
          });
        } else if (step === 'waiting_for_login' || step === 'verifying_authentication' || step === 'saving_session') {
          await this.updateAccount(accountId, {
            connection_state: 'authenticating',
            last_error: null,
          });
        }
        await this.client.rpc('insert_auth_interaction', {
          p_workspace_id: workspaceId,
          p_account_id: accountId,
          p_queue_item_id: queueItemId,
          p_interaction_type: 'progress',
          p_step: step,
          p_message: message,
          p_status: 'completed',
          p_metadata: metadata || {},
        });
      } catch (err) {
        logger.error('Failed to write progress event', { error: String(err) });
      }
    };
  }

  // ── LinkedIn Connect Handler ───────────────────────────────

  // ── State Machine: IDLE → CREATING_SESSION → SESSION_CREATED → CONNECTING_BROWSER → CONNECTED → OPENING_LINKEDIN → READY_FOR_LOGIN → AUTHENTICATED → FAILED

  private async claimCredentials(item: QueueItem): Promise<{ username: string; password: string } | null> {
    if (!item.account_id) return null;
    const { data, error } = await this.client.rpc('claim_linkedin_credentials_for_login', {
      p_workspace_id: item.workspace_id,
      p_account_id: item.account_id,
      p_queue_item_id: item.id,
      p_worker_id: this.workerId,
      p_attempt_id: item.attempt_id,
    });
    if (error) throw new Error(`LinkedIn credentials unavailable: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      username: decryptLinkedInCredential(row.encrypted_username, this.credentialEncryptionSecret, row.encryption_version),
      password: decryptLinkedInCredential(row.encrypted_password, this.credentialEncryptionSecret, row.encryption_version),
    };
  }

  private async markCredentialResult(item: QueueItem, success: boolean, invalid = false): Promise<void> {
    if (!item.account_id) return;
    const { error } = await this.client.rpc('mark_linkedin_credentials_result', {
      p_workspace_id: item.workspace_id,
      p_account_id: item.account_id,
      p_queue_item_id: item.id,
      p_worker_id: this.workerId,
      p_attempt_id: item.attempt_id,
      p_success: success,
      p_invalid: invalid,
    });
    if (error)
      logger.warn('Unable to update LinkedIn credential status', {
        account_id: item.account_id,
        success,
        invalid,
      });
  }

  private async handleConnect(item: QueueItem, startTime: number): Promise<void> {
    const workspaceId = item.workspace_id;
    const accountId = item.account_id;
    const startupStartedAt = Date.now();
    if (!accountId) {
      logger.error('handleConnect: missing account_id', {
        queue_item_id: item.id,
      });
      await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false);
      return;
    }

    const logPersistentFastPath = (stage: string, at = Date.now()): void =>
      logger.info('LinkedIn persistent fast-path latency', {
        queue_item_id: item.id,
        workspace_id: workspaceId,
        account_id: accountId,
        stage,
        timestamp: new Date(at).toISOString(),
        elapsed_from_claim_ms: at - startTime,
      });
    logPersistentFastPath('P0_connect_claimed');
    const onProgress = this.makeProgressCallback(workspaceId, accountId, item.id);
    const intendedIdentity = await this.loadIntendedIdentity(accountId, workspaceId);
    if (persistentContextsEnabled()) await this.linkedinContexts.ensureV1Enrollment(workspaceId, accountId);
    const usePersistentContext = await this.linkedinContexts.shouldUsePersistentContext(workspaceId, accountId, persistentContextsEnabled());
    let persistentContext: ContextRecord | null = null;
    let launchOptions = {
      ...sessionOptionsForAccount(false),
      timeoutMs: INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS,
    };
    if (usePersistentContext) {
      const owner: ContextLeaseOwner = {
        workspaceId,
        accountId,
        queueItemId: item.id,
        workerId: this.workerId,
        attemptId: item.attempt_id,
      };
      persistentContext = await withinStartupDeadline(this.linkedinContexts.ensureProvisioned(owner), startupStartedAt, 'context_provisioning');
      persistentContext = await withinStartupDeadline(this.linkedinContexts.acquire(owner), startupStartedAt, 'context_lease');
      logPersistentFastPath('P1_context_lease_acquired');
      this.activeContextLease = { context: persistentContext, owner };
      await withinStartupDeadline(this.linkedinContexts.reconcileBeforeSession(persistentContext, owner), startupStartedAt, 'context_reconciliation');
      launchOptions = {
        ...sessionOptionsForAccount(true, persistentContext),
        timeoutMs: INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS,
      };
      await onProgress('checking_existing_session', 'Checking your LinkedIn connection...');
    }

    // STATE: authenticating (transition from IDLE)
    await this.updateAccount(accountId, {
      connection_state: 'authenticating',
      last_error: null,
      browserbase_session_id: null,
      browser_connected_at: null,
    });
    await this.logSessionEvent(workspaceId, accountId, 'created', {
      action: 'linkedin_connect',
    });

    // ── Try session reuse first ──────────────────────────────────
    const existingSession = usePersistentContext ? null : await this.loadSessionForAccount(accountId);
    let reuseOpenBrowserForAuthentication = false;
    let preserveRestoredPage = false;
    if (existingSession) {
      logger.info('Found existing session, attempting reuse', {
        account_id: accountId,
      });
      await onProgress('creating_session', 'Existing session found. Attempting to restore...');

      try {
        await this.linkedin.launch(onProgress);
        const reuseResult = await this.linkedin.connectWithSession(existingSession.session, TEST_CONNECTION_TIMEOUT, onProgress, intendedIdentity);

        if (reuseResult.success) {
          const effectiveProfileUrl = reuseResult.effectiveProfileUrl;
          if (!effectiveProfileUrl) throw new Error('Successful restored session has no effective trusted LinkedIn profile URL');
          if (!reuseResult.reuseBoundIdentity) {
            await this.bindAuthenticatedIdentity(workspaceId, accountId, effectiveProfileUrl);
          }
          await this.updateAccount(accountId, {
            connection_state: 'connected',
            session_status: 'connected',
            health_status: 'healthy',
            status: 'active',
            last_validated_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
            last_error: null,
            profile_url: effectiveProfileUrl,
            profile_name: reuseResult.identity?.profileName,
            profile_headline: reuseResult.identity?.profileHeadline,
          });
          await this.logSessionEvent(workspaceId, accountId, 'login_success', {
            profile_url: effectiveProfileUrl,
            profile_name: reuseResult.identity?.profileName,
            reused: true,
          });
          await this.linkedin.close();
          await onProgress('connected', reuseResult.identityState === 'unresolved' ? 'Authenticated LinkedIn session restored. Identity verification remains pending.' : 'LinkedIn connected successfully using the restored session.');
          await this.queue.complete(
            item.id,
            {
              connected: true,
              reused: true,
              identity: reuseResult.identity,
              identity_state: reuseResult.identityState,
              duration_ms: Date.now() - startTime,
            },
            Date.now() - startTime,
          );
          logger.info('LinkedIn account connected via session reuse', {
            account_id: accountId,
          });
          return;
        }

        if (reuseResult.reuseExistingBrowser && reuseResult.requiresAction) {
          reuseOpenBrowserForAuthentication = true;
          preserveRestoredPage = reuseResult.preserveCurrentPage === true;
          logger.info('Restored session requires human authentication in the same browser', {
            account_id: accountId,
            authentication_state: reuseResult.authState,
            preserve_current_page: preserveRestoredPage,
          });
        } else {
          logger.warn('Restored session verification failed without changing authentication classification', {
            account_id: accountId,
            authentication_state: reuseResult.authState,
            identity_state: reuseResult.identityState,
            error_code: reuseResult.errorCode,
          });
          await onProgress('connection_failed', reuseResult.error || 'Existing LinkedIn connection could not be verified.', {
            error_code: reuseResult.errorCode || 'existing_session_verification_failed',
            authentication_state: reuseResult.authState || 'unknown',
            identity_state: reuseResult.identityState || 'unresolved',
          });
          await this.linkedin.close();
          await this.updateAccount(accountId, {
            connection_state: 'failed',
            status: 'error',
            last_error: reuseResult.error,
          });
          await this.queue.fail(item.id, reuseResult.error || 'Existing session verification failed', Date.now() - startTime, reuseResult.retryable === true);
          return;
        }
      } catch (err) {
        logger.warn('Session reuse error; failing without creating a second browser session', { error: this.sanitizeError(err) });
        await this.linkedin.close().catch(() => {});
        await this.updateAccount(accountId, {
          connection_state: 'failed',
          status: 'error',
          last_error: 'Existing LinkedIn session check failed',
        });
        await this.queue.fail(item.id, 'Existing LinkedIn session check failed', Date.now() - startTime, true);
        return;
      }
    }

    // ── Fresh login flow: strict state machine ───────────────────
    // STATE: CREATING_SESSION + CONNECTING_BROWSER (handled inside launch)
    logger.info('handleConnect: starting fresh login flow', {
      account_id: accountId,
    });

    try {
      if (!reuseOpenBrowserForAuthentication) await withinStartupDeadline(this.linkedin.launch(usePersistentContext ? undefined : onProgress, launchOptions), startupStartedAt, 'provider_session_and_cdp');
    } catch (err) {
      const msg = this.sanitizeError(err);
      const retryable = err instanceof BrowserbaseError && ![401, 402, 403].includes(err.statusCode);
      logger.error('handleConnect: launch failed', { error: msg });
      await this.updateAccount(accountId, {
        connection_state: 'failed',
        last_error: `Browser launch failed: ${msg}`,
      });
      await onProgress('login_failed', `Browser launch failed: ${msg}`);
      await this.queue.fail(item.id, `Browser launch failed: ${msg}`, Date.now() - startTime, retryable);
      return;
    }

    // ── Verify: Browserbase session exists ──────────────────────
    const bbSessionId = this.linkedin.getSessionId();
    const liveUrl = this.linkedin.getLiveUrl();
    logger.info('handleConnect: browser session ready', {
      account_id: accountId,
      bbSessionId,
      liveUrlAvailable: !!liveUrl,
    });
    if (usePersistentContext) logPersistentFastPath('P2_context_session_created');

    if (!bbSessionId && browserbase.isConfigured()) {
      const msg = 'No Browserbase session ID after launch';
      logger.error('handleConnect: verification failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, {
        connection_state: 'failed',
        last_error: msg,
      });
      await onProgress('login_failed', msg);
      await this.queue.fail(item.id, msg, Date.now() - startTime, false);
      return;
    }

    if (persistentContext && bbSessionId && this.activeContextLease) {
      await this.linkedinContexts.attachSession(persistentContext.id, bbSessionId, this.activeContextLease.owner);
    }

    // ── Create browser context ──────────────────────────────────
    try {
      if (!reuseOpenBrowserForAuthentication) await withinStartupDeadline(this.linkedin.newContext(), startupStartedAt, 'browser_page');
    } catch (err) {
      const msg = this.sanitizeError(err);
      logger.error('handleConnect: context creation failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, {
        connection_state: 'failed',
        last_error: `Context creation failed: ${msg}`,
      });
      await onProgress('login_failed', `Context creation failed: ${msg}`);
      await this.queue.fail(item.id, `Context creation failed: ${msg}`, Date.now() - startTime, false);
      return;
    }

    // ── Connect: open LinkedIn → wait for auth → verify → save ──
    let result;
    if (usePersistentContext) {
      const preflight = await withinStartupDeadline(this.linkedin.checkExistingAuthenticatedSession(intendedIdentity), startupStartedAt, 'linkedin_classification');
      if (preflight.result) {
        result = preflight.result;
        if (result.success) {
          logPersistentFastPath('P3_authenticated_state_detected', result.authenticationDetectedAt ?? Date.now());
          logPersistentFastPath('P4_canonical_identity_verified', result.identityVerifiedAt ?? Date.now());
          logPersistentFastPath('P5_authenticated_state_captured', result.stateCapturedAt ?? Date.now());
          await onProgress('existing_session_authenticated', 'Existing LinkedIn connection verified.');
        }
      } else {
        await onProgress('auth_required', 'Sign in to LinkedIn once in the secure browser.', { lifecycle_stage: 'L0_auth_required' });
        await this.updateAccount(accountId, {
          browserbase_session_id: bbSessionId,
          browser_connected_at: new Date().toISOString(),
        });
        let startupReady!: () => void;
        const ready = new Promise<void>((resolve) => {
          startupReady = resolve;
        });
        const stagedProgress: ProgressCallback = async (step, message, metadata) => {
          await onProgress(step, message, metadata);
          if (step === 'auth_surface_ready' || step === 'human_challenge_required') startupReady();
        };
        const connection = this.linkedin.connect(INTERACTIVE_AUTH_TIMEOUT_MS, stagedProgress, workspaceId, accountId, item.id, intendedIdentity, preflight.preserveCurrentPage, false);
        await withinStartupDeadline(Promise.race([ready, connection.then(() => undefined)]), startupStartedAt, 'linkedin_login_surface');
        result = await connection;
      }
    } else {
      await onProgress('auth_required', 'Sign in to LinkedIn once in the secure browser.', { lifecycle_stage: 'L0_auth_required' });
      await this.updateAccount(accountId, {
        browserbase_session_id: bbSessionId,
        browser_connected_at: new Date().toISOString(),
      });
      result = await this.linkedin.connect(INTERACTIVE_AUTH_TIMEOUT_MS, onProgress, workspaceId, accountId, item.id, intendedIdentity, preserveRestoredPage);
    }

    logger.info('handleConnect: linkedin.connect() returned', {
      account_id: accountId,
      success: result.success,
      requiresAction: result.requiresAction,
      error: result.error,
    });

    if (!result.success) {
      if (result.errorCode === 'identity_resolution_pending' && result.authState === 'authenticated' && result.session) {
        const pendingError = result.error || 'LinkedIn identity verification is pending.';
        const sessionId = await this.saveSession(workspaceId, accountId, result.session);
        if (!sessionId) {
          await this.linkedin.close();
          await this.updateAccount(accountId, {
            connection_state: 'failed',
            status: 'error',
            session_status: 'disconnected',
            last_error: 'Session save failed — cookies were not persisted',
          });
          await this.queue.fail(item.id, 'Session save failed', Date.now() - startTime, true);
          return;
        }
        logger.info('fresh_session_persisted', {
          account_id: accountId,
          browserbase_session_id: bbSessionId,
          authentication_state: 'authenticated',
          identity_state: 'unresolved',
          canonical_identity_found: false,
          final_connect_classification: 'identity_resolution_pending',
        });
        await this.updateAccount(accountId, {
          browserbase_session_id: null,
          browser_connected_at: null,
        });
        await this.linkedin.close();
        if (persistentContext && bbSessionId && this.activeContextLease) {
          await this.linkedinContexts.synchronize(persistentContext, bbSessionId, this.activeContextLease.owner);
          this.activeContextLease = null;
        }
        await this.updateAccount(accountId, {
          connection_state: 'requires_action',
          status: 'pending_login',
          session_status: 'disconnected',
          last_error: pendingError,
        });
        await onProgress('identity_resolution_pending', pendingError, {
          error_code: result.errorCode,
          authentication_state: 'authenticated',
          identity_state: 'unresolved',
        });
        await this.queue.fail(item.id, pendingError, Date.now() - startTime, true);
        return;
      }
      await this.linkedin.close();

      const isNonRetryable = (result as { nonRetryable?: boolean }).nonRetryable === true;

      if (result.cancelled) {
        await this.updateAccount(accountId, {
          connection_state: 'cancelled',
          session_status: 'disconnected',
          status: 'disconnected',
          last_error: null,
        });
        await this.logSessionEvent(workspaceId, accountId, 'login_failed', {
          reason: 'user_cancelled',
        });
        return;
      }

      await this.updateAccount(accountId, {
        connection_state: 'failed',
        status: 'error',
        session_status: 'disconnected',
        last_error: result.error || 'Connection failed',
      });
      await this.logSessionEvent(workspaceId, accountId, 'login_failed', {
        error: result.error,
      });
      await this.queue.fail(item.id, result.error || 'Connection failed', Date.now() - startTime, result.retryable === true || !isNonRetryable);
      return;
    }

    // ── Save encrypted session ──────────────────────────────────
    const identityVerifiedAt = result.identityVerifiedAt ?? Date.now();
    const logPostAuthStage = (stage: string, stageStartedAt = identityVerifiedAt): void =>
      logger.info('LinkedIn post-auth latency', {
        queue_item_id: item.id,
        workspace_id: workspaceId,
        account_id: accountId,
        stage,
        timestamp: new Date().toISOString(),
        elapsed_from_identity_verified_ms: Date.now() - identityVerifiedAt,
        stage_duration_ms: Date.now() - stageStartedAt,
      });
    logPostAuthStage('identity_verified');
    if (result.stateCapturedAt) logPostAuthStage('authenticated_state_captured', result.identityVerifiedAt);

    // Authentication and canonical identity are verified and browser state is
    // captured. Revoke customer Live View access before backend finalization.
    await this.updateAccount(accountId, {
      browserbase_session_id: null,
      browser_connected_at: null,
    });
    await this.linkedin.neutralizeVisiblePage();
    logPostAuthStage('live_view_access_revoked');
    await onProgress('saving_session', 'Login successful. Encrypting and saving session...');
    await onProgress('finalizing_connection', 'Securing your LinkedIn connection...');

    const effectiveProfileUrl = result.effectiveProfileUrl || result.identity?.profileUrl;
    // First login binds the identity. A bound account using the same persistent
    // Context does not rebind when LinkedIn temporarily withholds /in/me.
    if (!result.reuseBoundIdentity) await this.bindAuthenticatedIdentity(workspaceId, accountId, effectiveProfileUrl);

    const persistenceStartedAt = Date.now();
    let sessionId: string | null = null;
    if (result.session) {
      logPostAuthStage('encrypted_session_persistence_started');
      sessionId = await this.saveSession(workspaceId, accountId, result.session);
    }
    if (!sessionId && !persistentContext) {
      await this.linkedin.close();
      await this.updateAccount(accountId, {
        connection_state: 'failed',
        last_error: 'Session save failed — cookies were not persisted',
      });
      await this.queue.fail(item.id, 'Session save failed', Date.now() - startTime, true);
      return;
    }
    if (sessionId) logPostAuthStage('encrypted_session_persistence_completed', persistenceStartedAt);

    // Browserbase saves a persistent Context only after the provider session
    // closes and its asynchronous synchronization has settled.
    if (persistentContext && bbSessionId && this.activeContextLease) {
      const releaseStartedAt = Date.now();
      logPostAuthStage('browserbase_release_requested');
      if (usePersistentContext) logPersistentFastPath('P6_browserbase_release_requested');
      await this.linkedin.close();
      logPostAuthStage('browserbase_release_request_completed', releaseStartedAt);
      const synchronizationStartedAt = Date.now();
      logPostAuthStage('context_synchronization_started');
      let synchronization;
      try {
        synchronization = await this.linkedinContexts.synchronize(persistentContext, bbSessionId, this.activeContextLease.owner);
      } catch (error) {
        const failure = 'The authenticated LinkedIn browser could not be persisted safely.';
        logger.error('linkedin_context_persistence_failed', {
          queue_item_id: item.id,
          workspace_id: workspaceId,
          account_id: accountId,
          context_id: persistentContext.id,
          context_generation: persistentContext.generation,
          error: this.sanitizeError(error),
          error_code: 'context_persistence_failed',
        });
        await this.updateAccount(accountId, {
          connection_state: 'failed',
          session_status: 'disconnected',
          status: 'error',
          last_error: failure,
        });
        await onProgress('connection_failed', failure, {
          error_code: 'context_persistence_failed',
        });
        await this.queue.fail(item.id, failure, Date.now() - startTime, false);
        return;
      }
      logger.info('LinkedIn post-auth latency', {
        queue_item_id: item.id,
        workspace_id: workspaceId,
        account_id: accountId,
        stage: 'browserbase_session_terminal_observed',
        timestamp: new Date(synchronization.terminalObservedAt).toISOString(),
        elapsed_from_identity_verified_ms: synchronization.terminalObservedAt - identityVerifiedAt,
        stage_duration_ms: synchronization.terminalObservedAt - synchronizationStartedAt,
      });
      logPostAuthStage('context_synchronization_completed', synchronizationStartedAt);
      if (usePersistentContext) logPersistentFastPath('P7_context_synchronized');
      this.activeContextLease = null;
    }

    // STATE: AUTHENTICATED — only after session is saved AND verified
    if (persistentContext) {
      const proofStartedAt = Date.now();
      logger.info('linkedin_persistence_proof_started', {
        queue_item_id: item.id,
        workspace_id: workspaceId,
        account_id: accountId,
        context_id: persistentContext.id,
        context_generation: persistentContext.generation,
      });
      let proofContext;
      let proofSessionId: string | null = null;
      let proof;
      try {
        proofContext = await this.openPersistentContextForTask(item);
        proofSessionId = this.linkedin.getSessionId();
        proof = await this.linkedin.verifyPersistentAuthentication({
          ...intendedIdentity,
          profileUrl: effectiveProfileUrl || intendedIdentity.profileUrl,
        });
        await this.synchronizePersistentContext(proofContext, proofSessionId);
        if (proof.success && proof.senderVerificationMode === 'verified_live_identity' && proof.effectiveProfileUrl) {
          await this.linkedinContexts.certifyIdentity(proofContext, proof.effectiveProfileUrl);
        }
      } catch (error) {
        const failure = 'The second secure LinkedIn session could not be created or synchronized.';
        logger.error('linkedin_second_session_failed', {
          queue_item_id: item.id,
          workspace_id: workspaceId,
          account_id: accountId,
          context_id: persistentContext.id,
          context_generation: persistentContext.generation,
          error: this.sanitizeError(error),
          error_code: 'context_persistence_failed',
        });
        await this.linkedin.close().catch(() => {});
        await this.updateAccount(accountId, {
          connection_state: 'failed',
          session_status: 'disconnected',
          status: 'error',
          last_error: failure,
        });
        await onProgress('connection_failed', failure, {
          error_code: 'context_persistence_failed',
        });
        await this.queue.fail(item.id, failure, Date.now() - startTime, false);
        return;
      }
      if (!proof.success) {
        const proofError = proof.error || 'Persistent LinkedIn authentication could not be verified in a new secure session.';
        const proofErrorCode = proof.identityState === 'mismatch' ? 'second_session_identity_mismatch' : proof.authState !== 'authenticated' ? 'second_session_not_authenticated' : 'identity_resolution_failed';
        await this.updateAccount(accountId, {
          connection_state: proof.errorCode === 'checkpoint_required' ? 'requires_action' : 'failed',
          session_status: 'disconnected',
          status: 'pending_login',
          last_error: proofError,
        });
        await onProgress('connection_failed', proofError, {
          error_code: proofErrorCode,
          authentication_state: proof.authState,
        });
        await this.queue.fail(item.id, proofError, Date.now() - startTime, false);
        logger.warn('linkedin_persistence_proof_failed', {
          queue_item_id: item.id,
          workspace_id: workspaceId,
          account_id: accountId,
          context_id: proofContext.id,
          context_generation: proofContext.generation,
          authentication_state: proof.authState,
          identity_state: proof.identityState,
          error_code: proofErrorCode,
        });
        return;
      }
      logger.info('linkedin_persistence_proof_completed', {
        queue_item_id: item.id,
        workspace_id: workspaceId,
        account_id: accountId,
        context_id: proofContext.id,
        context_generation: proofContext.generation,
        duration_ms: Date.now() - proofStartedAt,
      });
    }

    await this.updateAccount(accountId, {
      connection_state: 'connected',
      session_status: 'connected',
      health_status: 'healthy',
      status: 'active',
      last_validated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      last_error: null,
      profile_url: effectiveProfileUrl,
      profile_name: result.identity?.profileName,
      profile_headline: result.identity?.profileHeadline,
    });
    logPostAuthStage('durable_account_connected');
    if (usePersistentContext) logPersistentFastPath('P8_durable_connected');

    await onProgress('connected', persistentContext ? 'LinkedIn connected successfully using its persistent secure browser.' : 'LinkedIn connected successfully. Session encrypted and verified.');

    await this.queue.complete(
      item.id,
      {
        connected: true,
        session_id: sessionId,
        identity: result.identity,
        persistent_context: !!persistentContext,
        duration_ms: Date.now() - startTime,
      },
      Date.now() - startTime,
    );

    await Promise.allSettled([
      this.client.rpc('insert_auth_interaction', {
        p_workspace_id: workspaceId,
        p_account_id: accountId,
        p_queue_item_id: item.id,
        p_interaction_type: 'session_saved',
        p_step: 'saving_session',
        p_message: 'Session encrypted and saved successfully.',
        p_status: 'completed',
        p_metadata: { session_id: sessionId },
      }),
      this.logSessionEvent(workspaceId, accountId, 'login_success', {
        profile_url: result.identity?.profileUrl,
        profile_name: result.identity?.profileName,
      }),
      this.logSessionEvent(workspaceId, accountId, 'validated', {
        session_id: sessionId,
      }),
    ]);

    await this.linkedin.close();

    logger.info('linkedin_connected', {
      account_id: accountId,
      session_id: sessionId,
      persistent_context: !!persistentContext,
    });
  }

  // ── Test Connection Handler ────────────────────────────────

  private async handleTestConnection(item: QueueItem, startTime: number): Promise<void> {
    const accountId = item.account_id;
    if (!accountId) {
      await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false);
      return;
    }

    if (persistentContextsEnabled()) {
      const intendedIdentity = await this.loadIntendedIdentity(accountId, item.workspace_id);
      const context = await this.openPersistentContextForTask(item);
      const browserbaseSessionId = this.linkedin.getSessionId();
      const binding = await this.linkedinContexts.verifiedIdentityBinding(context);
      const result = await this.linkedin.verifyPersistentAuthentication(intendedIdentity, binding);
      if (result.identityState === 'mismatch') await this.linkedinContexts.revokeIdentity(context, 'positive_identity_mismatch');
      if (result.success && result.senderVerificationMode === 'verified_live_identity' && result.effectiveProfileUrl) {
        await this.linkedinContexts.certifyIdentity(context, result.effectiveProfileUrl);
      }
      await this.synchronizePersistentContext(context, browserbaseSessionId);
      if (result.success) {
        await this.updateAccount(accountId, {
          connection_state: 'connected',
          session_status: 'connected',
          health_status: 'healthy',
          status: 'active',
          last_validated_at: new Date().toISOString(),
          last_error: null,
          profile_url: result.effectiveProfileUrl,
          profile_name: result.identity?.profileName,
        });
        await this.logSessionEvent(item.workspace_id, accountId, 'validated', {
          test: true,
          persistent_context: true,
        });
        await this.queue.complete(
          item.id,
          {
            healthy: true,
            identity: result.identity,
            persistent_context: true,
          },
          Date.now() - startTime,
        );
      } else {
        const checkpoint = result.errorCode === 'checkpoint_required';
        await this.updateAccount(accountId, {
          connection_state: checkpoint ? 'requires_action' : 'session_expired',
          last_error: result.error,
        });
        logger.info(checkpoint ? 'linkedin_checkpoint_required' : 'linkedin_reauth_required', {
          queue_item_id: item.id,
          workspace_id: item.workspace_id,
          account_id: accountId,
          authentication_state: result.authState,
          identity_state: result.identityState,
        });
        await this.queue.fail(item.id, result.error || 'LinkedIn requires reauthentication', Date.now() - startTime, false);
      }
      return;
    }

    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) {
      await this.updateAccount(accountId, {
        connection_state: 'session_invalid',
        last_error: 'No active session found',
      });
      await this.queue.fail(item.id, 'No active session found', Date.now() - startTime, false);
      return;
    }

    const intendedIdentity = await this.loadIntendedIdentity(accountId, item.workspace_id);
    await this.linkedin.launch(undefined);
    const result = await this.linkedin.testConnection(loaded.session, TEST_CONNECTION_TIMEOUT, intendedIdentity);
    await this.linkedin.close();

    if (result.success) {
      await this.client.rpc('update_session_health', {
        p_session_id: loaded.sessionId,
        p_health_status: 'healthy',
        p_connection_state: 'active',
      });
      await this.updateAccount(accountId, {
        connection_state: 'connected',
        health_status: 'healthy',
        last_validated_at: new Date().toISOString(),
        last_error: null,
        profile_url: result.identity?.profileUrl,
        profile_name: result.identity?.profileName,
      });
      await this.logSessionEvent(item.workspace_id, accountId, 'validated', {
        test: true,
      });
      await this.queue.complete(item.id, { healthy: true, identity: result.identity }, Date.now() - startTime);
    } else {
      await this.client.rpc('expire_session', {
        p_session_id: loaded.sessionId,
        p_reason: result.error,
      });
      const state = result.error?.includes('expired') ? 'session_expired' : 'session_invalid';
      await this.updateAccount(accountId, {
        connection_state: state,
        last_error: result.error,
      });
      await this.queue.fail(item.id, result.error || 'Test connection failed', Date.now() - startTime, false);
    }
  }

  // ── Automation Action Handler ──────────────────────────────

  private async handleAutomationAction(item: QueueItem, startTime: number): Promise<void> {
    const accountId = item.account_id;
    if (!accountId) {
      await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false);
      return;
    }

    if (LINKEDIN_WRITE_ACTIONS.has(item.action_type)) {
      const acceptanceCandidate = productionAcceptanceScheduleCandidate(
        item,
        this.acceptanceAuthorizationId,
        this.executionGate.outboundEnabled,
      );
      let scheduleExempt = false;
      if (acceptanceCandidate) {
        const { data: attestation, error: attestationError } = await this.client.rpc(
          'validate_production_acceptance_schedule_exemption',
          {
            p_task_id: item.id,
            p_attempt_id: item.attempt_id,
            p_worker_id: this.workerId,
            p_authorization_id: acceptanceCandidate,
          },
        );
        if (attestationError) throw new Error(`Production acceptance schedule attestation failed: ${this.sanitizeError(attestationError)}`);
        scheduleExempt = attestation?.allowed === true;
        if (!scheduleExempt) {
          await this.queue.fail(item.id, `Production acceptance schedule exemption denied: ${attestation?.code ?? 'binding_unknown'}`, Date.now() - startTime, false);
          return;
        }
      }
      if (!scheduleExempt) {
        const jobId = typeof item.action_params?.job_id === 'string' ? item.action_params.job_id : null;
        if (!jobId) {
          await this.queue.fail(item.id, 'Campaign schedule missing', Date.now() - startTime, false);
          return;
        }
        const { data: scheduleGate, error: scheduleError } = await this.client.rpc('campaign_outreach_preflight', {
          p_workspace_id: item.workspace_id,
          p_job_id: jobId,
        });
        if (scheduleError) throw new Error(`Campaign schedule validation failed: ${this.sanitizeError(scheduleError)}`);
        if (!scheduleGate?.allowed) {
          if (scheduleGate?.code === 'campaign_paused') {
          await this.client
            .from('browser_execution_queue')
            .update({
              status: 'waiting',
              scheduled_at: null,
              next_retry_at: null,
              started_at: null,
              worker_id: null,
              attempt_id: null,
              lease_expires_at: null,
              error: 'Campaign paused',
            })
            .eq('id', item.id)
            .eq('attempt_id', item.attempt_id);
          logger.info('linkedin_write_deferred_campaign_paused', { queue_item_id: item.id });
          } else if (scheduleGate?.code === 'outside_sending_window' && scheduleGate?.scheduled_at) {
          await this.client
            .from('browser_execution_queue')
            .update({
              status: 'pending',
              scheduled_at: scheduleGate.scheduled_at,
              started_at: null,
              worker_id: null,
              attempt_id: null,
              lease_expires_at: null,
              error: 'Outside sending window',
            })
            .eq('id', item.id)
            .eq('attempt_id', item.attempt_id);
          logger.info('linkedin_write_deferred_to_campaign_window', {
            queue_item_id: item.id,
            scheduled_at: scheduleGate.scheduled_at,
          });
          } else {
            await this.queue.fail(item.id, `LinkedIn write denied: ${scheduleGate?.code ?? 'campaign_schedule_required'}`, Date.now() - startTime, false);
          }
          return;
        }
      }
    }

    const { data: agentAccount, error: agentAccountError } = await this.client.from('linkedin_accounts').select('status').eq('id', accountId).eq('workspace_id', item.workspace_id).maybeSingle();
    if (agentAccountError) throw new Error(`Cloud agent status check failed: ${this.sanitizeError(agentAccountError)}`);
    if (agentAccount?.status === 'paused') {
      await this.queue.fail(item.id, 'Cloud LinkedIn Agent is paused', Date.now() - startTime, false);
      logger.info('agent_paused', {
        queue_item_id: item.id,
        workspace_id: item.workspace_id,
        account_id: accountId,
      });
      return;
    }

    const usePersistentContext = persistentContextsEnabled();
    const loaded = usePersistentContext ? null : await this.loadSessionForAccount(accountId);
    if (!usePersistentContext && !loaded) {
      await this.updateAccount(accountId, {
        connection_state: 'session_invalid',
        last_error: 'No active session for automation',
      });
      await this.queue.fail(item.id, 'No active session — account must be connected first', Date.now() - startTime, false);
      return;
    }

    const sessionData = loaded?.session;
    const sessionId = loaded?.sessionId;
    const intendedIdentity = await this.loadIntendedIdentity(accountId, item.workspace_id);
    const params = item.action_params ?? {};
    if (item.action_type === 'follow_up_message' && params.contact_id) {
      const { data: priorReply, error: replyCheckError } = await this.client
        .from('linkedin_inbound_replies')
        .select('id')
        .eq('workspace_id', item.workspace_id)
        .eq('contact_id', params.contact_id as string)
        .eq('match_status', 'matched')
        .limit(1)
        .maybeSingle();
      if (replyCheckError) throw new Error(`Reply safety check failed: ${this.sanitizeError(replyCheckError)}`);
      if (priorReply) {
        await this.queue.fail(item.id, 'Follow-up cancelled: prospect already replied', Date.now() - startTime, false);
        return;
      }
    }
    let result: {
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
    };
    let writeAuditId: string | null = null;
    let interactionStage: WriteInteractionStage = 'not_started';
    let interactionCrossed = false;
    const recordWriteStage = async (stage: WriteInteractionStage, crossed = interactionCrossed, evidence: Record<string, unknown> = {}) => {
      if (!LINKEDIN_WRITE_ACTIONS.has(item.action_type)) return;
      // Set the in-memory boundary first so an RPC/network exception while durably
      // recording a pre-click intent still fails closed in this worker attempt.
      interactionStage = stage;
      interactionCrossed = interactionCrossed || crossed;
      await this.queue.recordWriteStage(item.id, stage, interactionCrossed, evidence);
    };

    try {
      logger.info('linkedin_job_started', {
        queue_item_id: item.id,
        workspace_id: item.workspace_id,
        account_id: accountId,
        action: item.action_type,
      });
      let persistentContext: ContextRecord | null = null;
      let persistentSessionId: string | null = null;
      if (usePersistentContext) {
        persistentContext = await this.openPersistentContextForTask(item);
        persistentSessionId = this.linkedin.getSessionId();
        await this.queue.recordBrowserCorrelation(item.id, persistentSessionId, persistentContext.id);
        const binding = await this.linkedinContexts.verifiedIdentityBinding(persistentContext);
        const authentication = await this.linkedin.verifyPersistentAuthentication(intendedIdentity, binding);
        if (authentication.identityState === 'mismatch') {
          await this.linkedinContexts.revokeIdentity(persistentContext, 'positive_identity_mismatch');
        }
        if (authentication.success && authentication.senderVerificationMode === 'verified_live_identity' && authentication.effectiveProfileUrl) {
          await this.linkedinContexts.certifyIdentity(persistentContext, authentication.effectiveProfileUrl);
        }
        if (!authentication.success) {
          await this.synchronizePersistentContext(persistentContext, persistentSessionId);
          const checkpoint = authentication.errorCode === 'checkpoint_required';
          if (checkpoint) {
            await this.updateAccount(accountId, {
              connection_state: 'requires_action',
              last_error: authentication.error,
            });
          } else if (authentication.authState !== 'authenticated') {
            await this.updateAccount(accountId, {
              connection_state: 'session_expired',
              last_error: authentication.error,
            });
          } else {
            await this.updateAccount(accountId, {
              last_error: authentication.error,
            });
          }
          logger.info(checkpoint ? 'linkedin_checkpoint_required' : 'linkedin_reauth_required', {
            queue_item_id: item.id,
            workspace_id: item.workspace_id,
            account_id: accountId,
            authentication_state: authentication.authState,
            identity_state: authentication.identityState,
          });
          await this.queue.fail(item.id, authentication.error || 'LinkedIn requires reauthentication', Date.now() - startTime, false);
          return;
        }
        await this.updateAccount(accountId, {
          connection_state: 'connected',
          session_status: 'connected',
          health_status: 'healthy',
          status: 'active',
          last_validated_at: new Date().toISOString(),
          last_error: null,
        });
      } else {
        await this.linkedin.launch(undefined);
        await this.linkedin.newContext();
        await this.queue.recordBrowserCorrelation(item.id, this.linkedin.getSessionId(), null);
        const restored = await this.linkedin.restoreSession(sessionData!);
        if (!restored) {
          await this.linkedin.close();
          await this.client.rpc('expire_session', {
            p_session_id: sessionId,
            p_reason: 'Session restore failed during automation',
          });
          await this.updateAccount(accountId, {
            connection_state: 'session_expired',
            last_error: 'Session expired during automation',
          });
          await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
          return;
        }
        const validation = await this.linkedin.validateSession(intendedIdentity);
        if (!validation.valid) {
          await this.linkedin.close();
          await this.client.rpc('expire_session', {
            p_session_id: sessionId,
            p_reason: validation.reason,
          });
          await this.updateAccount(accountId, {
            connection_state: 'session_expired',
            last_error: validation.reason || 'Session validation failed',
          });
          await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
          return;
        }
      }

      const page = this.linkedin.getPage();
      if (LINKEDIN_WRITE_ACTIONS.has(item.action_type)) {
        const preflight = await preflightLinkedInWrite(this.client, item);
        logger.info('linkedin_write_preflight', {
          queue_item_id: item.id,
          workspace_id: item.workspace_id,
          account_id: accountId,
          action: item.action_type,
          result: preflight.code,
        });
        if (!preflight.allowed) {
          if (persistentContext) await this.synchronizePersistentContext(persistentContext, persistentSessionId);
          else await this.linkedin.close();
          if (preflight.code === 'duplicate_action' && preflight.already_done) {
            await this.queue.complete(item.id, { result_code: 'already_done', safety_result: preflight.code }, Date.now() - startTime);
          } else {
            await this.queue.fail(item.id, `LinkedIn write denied: ${preflight.code}`, Date.now() - startTime, false);
          }
          return;
        }
        writeAuditId = preflight.audit_id ?? null;
        if (!writeAuditId) throw new Error('LinkedIn write preflight returned no audit identifier');
      }

      switch (item.action_type) {
        case 'profile_visit':
        case 'read_profile': {
          const url = params.profile_url as string;
          if (!url) throw new Error('profile_url required');
          const parsed = new URL(url);
          if (!/^https?:$/.test(parsed.protocol) || !/(^|\.)linkedin\.com$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/in/')) {
            throw new Error('A valid LinkedIn personal profile URL is required');
          }
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          if (item.action_type === 'read_profile') {
            await page
              .waitForFunction(
                () => {
                  const candidate = document.querySelector('main h1, h1.text-heading-xlarge, .pv-text-details__left-panel h1');
                  return !!candidate?.textContent?.trim();
                },
                undefined,
                { timeout: 10000 },
              )
              .catch(() => {});
            const profile = await page.evaluate(() => {
              const text = (selectors: string[]) =>
                selectors
                  .map((selector) => {
                    const element = document.querySelector(selector);
                    if (element instanceof HTMLMetaElement) return element.content.trim() || null;
                    return element?.textContent?.replace(/\s+/g, ' ').trim() || null;
                  })
                  .find(Boolean) ?? null;
              const name = text(['main h1', 'h1.text-heading-xlarge', '.pv-text-details__left-panel h1', 'h1', 'meta[property="og:title"]']) ?? (document.title.replace(/\s*\|\s*LinkedIn\s*$/i, '').trim() || null);
              const headline = text(['main .text-body-medium.break-words', '.pv-text-details__left-panel .text-body-medium', 'meta[property="og:description"]']);
              const locationText = text(['main .text-body-small.inline.t-black--light.break-words', '.pv-text-details__left-panel span.text-body-small.inline', '[data-generated-suggestion-target*="location"]']);
              return {
                name: name?.replace(/\s*\|\s*LinkedIn\s*$/i, '') ?? null,
                headline,
                location: locationText,
                canonical_url: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href,
              };
            });
            logger.info('linkedin_profile_extracted', {
              queue_item_id: item.id,
              name_present: !!profile.name,
              headline_present: !!profile.headline,
              location_present: !!profile.location,
              canonical_url_present: !!profile.canonical_url,
            });
            result = {
              success: true,
              data: { result_code: 'success', profile },
            };
          } else {
            result = {
              success: true,
              data: {
                result_code: 'success',
                visited: parsed.origin + parsed.pathname,
              },
            };
          }
          break;
        }
        case 'check_connection_acceptance': {
          const url = params.profile_url as string;
          if (!url) throw new Error('profile_url required');
          const target = normalizeLinkedInTarget(url);
          if (!target) throw new Error('A valid LinkedIn personal profile URL is required');
          const readiness = await waitForLinkedInProfileReady(page, target);
          if (!readiness.targetMatched) {
            result = {
              success: false,
              error: 'Presented LinkedIn profile does not match the acceptance-check target',
              data: { result_code: readiness.code, relationship_classification: 'probe_inconclusive', diagnostic_evidence: readiness },
            };
            break;
          }
          if (!readiness.ready) {
            logger.warn('linkedin_profile_hydration_inconclusive', {
              queue_item_id: item.id, target_path: new URL(target).pathname,
              code: readiness.code, final_path: new URL(readiness.finalUrl).pathname,
              header_found: readiness.headerFound, main_found: readiness.mainFound,
              skeleton_detected: readiness.skeletonDetected, action_row_found: readiness.actionRowFound,
              primary_actions: readiness.relevantActions, more_found: readiness.moreFound,
              overlay_categories: readiness.overlayCategories, hydration_attempts: readiness.attemptCount,
              hydration_elapsed_ms: readiness.elapsedMs, stable_observations: readiness.stableObservations,
              recovery_used: readiness.recoveryUsed,
            });
            result = {
              success: true,
              data: {
                result_code: readiness.code, relationship_classification: 'probe_inconclusive',
                accepted: false, pending: false, connect_available: false, message_available: readiness.relevantActions.includes('message'),
                follow_available: readiness.relevantActions.includes('follow'), first_degree: false, degree: null,
                diagnostic_evidence: readiness,
              },
            };
            break;
          }

          const browserEnvironment = await page.evaluate(() => {
            const ua = navigator.userAgent;
            const family = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
            return {
              viewport: { width: innerWidth, height: innerHeight },
              device_scale_factor: devicePixelRatio,
              user_agent_family: family,
              locale: Intl.DateTimeFormat().resolvedOptions().locale,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: navigator.language,
              languages: [...navigator.languages],
              form_factor: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop',
            };
          });

          const readSanitizedControls = async (scope: 'header' | 'menu') => page.evaluate((requestedScope) => {
            const visible = (element: Element) => {
              const node = element as HTMLElement; const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
              return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const candidates = requestedScope === 'menu'
              ? Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], [role="menu"] button, [role="menu"] [role="button"], .artdeco-dropdown__item, .artdeco-dropdown__content li, [data-control-name]'))
              : Array.from(document.querySelectorAll('[data-yuktris-profile-header] button, [data-yuktris-profile-header] a, [data-yuktris-profile-header] [role="button"]'));
            return candidates.filter(visible).map(element => {
              const html = element as HTMLElement;
              const visibleText = html.innerText?.replace(/\s+/g, ' ').trim().slice(0, 160) || null;
              const ariaLabel = element.getAttribute('aria-label')?.trim().slice(0, 160) || null;
              const title = element.getAttribute('title')?.trim().slice(0, 160) || null;
              return {
                role: element.getAttribute('role') || (element.tagName === 'BUTTON' ? 'button' : element.tagName === 'A' ? 'link' : null),
                accessible_name: ariaLabel || title || visibleText,
                visible_text: visibleText,
                aria_label: ariaLabel,
                title,
                disabled: html.matches(':disabled, [aria-disabled="true"]'),
                element_type: element.tagName.toLowerCase(),
              };
            }).filter((control, index, all) => control.accessible_name && all.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(control)) === index);
          }, scope);

          const readPrimaryEvidence = async (): Promise<RelationshipProbeEvidence> => page.evaluate(() => {
            const visible = (element: Element) => {
              const node = element as HTMLElement;
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const label = (element: Element) => [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
              .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
            const headingCandidates = Array.from(document.querySelectorAll('main h1, main h2, main [role="heading"], .scaffold-layout__main h1, .scaffold-layout__main h2, .scaffold-layout__main [role="heading"]'));
            const heading = headingCandidates.find(element => {
              const node = element as HTMLElement; const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
              return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < Math.max(700, innerHeight) && style.display !== 'none' && style.visibility !== 'hidden';
            }) ?? null;
            const header = heading?.closest('section, [data-view-name*="profile-top"], .pv-top-card') ?? heading?.parentElement?.parentElement ?? document.querySelector('main');
            document.querySelectorAll('[data-yuktris-profile-header]').forEach(element => element.removeAttribute('data-yuktris-profile-header'));
            header?.setAttribute('data-yuktris-profile-header', 'true');
            const headerText = header?.textContent?.replace(/\s+/g, ' ') ?? '';
            const degree = /(?:^|\s)1st(?:\s|$)/i.test(headerText) ? '1st' : /(?:^|\s)2nd(?:\s|$)/i.test(headerText) ? '2nd' : /(?:^|\s)3rd(?:\s|$)/i.test(headerText) ? '3rd' : null;
            const headingRect = heading?.getBoundingClientRect();
            const actionElements = Array.from(header?.querySelectorAll('button, a, [role="button"]') ?? []).filter(element => {
              if (!visible(element)) return false;
              if (!headingRect) return false;
              const rect = element.getBoundingClientRect();
              return rect.top >= headingRect.top - 120 && rect.top <= headingRect.bottom + 700;
            });
            document.querySelectorAll('[data-yuktris-relationship-more]').forEach(element => element.removeAttribute('data-yuktris-relationship-more'));
            actionElements.find(element => /(?:^|\b)more(?:\b|$)|additional\s+actions/i.test(label(element)))?.setAttribute('data-yuktris-relationship-more', 'true');
            const labels = actionElements.map(label);
            const has = (pattern: RegExp) => labels.some(value => pattern.test(value));
            return {
              degree,
              primary: {
                message: has(/(?:^|\b)message(?:\b|$)/i), connect: has(/(?:^|\b)connect(?:\b|$)/i),
                pending: has(/(?:^|\b)pending(?:\b|$)|invitation\s+sent/i), follow: has(/(?:^|\b)follow(?:\b|$)/i),
                connected: has(/remove\s+connection|connection\s+since|1st\s+degree/i),
                more: has(/(?:^|\b)more(?:\b|$)|additional\s+actions/i),
              },
              moreMenu: { inspected: false, connect: false, pending: false, connected: false },
              hydrated: !!heading?.textContent?.trim() && labels.length > 0,
            } as RelationshipProbeEvidence;
          });

          let evidence: RelationshipProbeEvidence | null = null;
          for (let hydrationAttempt = 0; hydrationAttempt < 4; hydrationAttempt++) {
            evidence = await readPrimaryEvidence();
            if (evidence.hydrated) break;
            await page.waitForTimeout(1000 + hydrationAttempt * 500);
          }
          if (!evidence) throw new Error('Relationship probe produced no evidence');

          const headerControls = await readSanitizedControls('header');
          const artifacts: Array<{ id: string; storage_path: string; screenshot_type: string }> = [];
          artifacts.push(await this.storeRelationshipProbeScreenshot(item, page, 'relationship_probe_profile_full'));
          const profileHeader = page.locator('[data-yuktris-profile-header="true"]').first();
          if (await profileHeader.isVisible().catch(() => false)) {
            artifacts.push(await this.storeRelationshipProbeScreenshot(item, page, 'relationship_probe_header_actions', profileHeader));
          }
          let moreMenuControls: Awaited<ReturnType<typeof readSanitizedControls>> = [];

          if (!evidence.primary.connect && evidence.primary.more) {
            const moreButton = page.locator('[data-yuktris-relationship-more="true"]').first();
            if (await moreButton.isVisible().catch(() => false)) {
              await moreButton.click();
              let menuLabels: string[] = [];
              for (let menuAttempt = 0; menuAttempt < 4 && menuLabels.length === 0; menuAttempt++) {
                await page.waitForTimeout(350 + menuAttempt * 200);
                menuLabels = await page.locator('[role="menuitem"], [role="option"], [role="menu"] button, [role="menu"] [role="button"], .artdeco-dropdown__item, .artdeco-dropdown__content li, [data-control-name]')
                  .evaluateAll((elements) => elements.filter(element => {
                    const node = element as HTMLElement; const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
                    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                  }).map(element => [element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('data-control-name'), element.textContent]
                    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase())
                    .filter(label => /connect|pending|invitation|remove\s+connection|follow|unfollow|report|block/i.test(label)));
              }
              evidence.moreMenu = {
                inspected: true,
                connect: menuLabels.some(label => /(?:^|\b)connect(?:\b|$)/i.test(label)),
                pending: menuLabels.some(label => /pending|invitation\s+sent|withdraw\s+invitation/i.test(label)),
                connected: menuLabels.some(label => /remove\s+connection|connection\s+since/i.test(label)),
              };
              moreMenuControls = await readSanitizedControls('menu');
              const visibleMenu = page.locator('[role="menu"]:visible, .artdeco-dropdown__content:visible').first();
              if (await visibleMenu.isVisible().catch(() => false)) {
                artifacts.push(await this.storeRelationshipProbeScreenshot(item, page, 'relationship_probe_more_menu', visibleMenu));
              } else {
                artifacts.push(await this.storeRelationshipProbeScreenshot(item, page, 'relationship_probe_more_menu'));
              }
              await page.keyboard.press('Escape');
            }
          }

          const relationshipClassification = classifyRelationshipProbe(evidence);
          logger.info('linkedin_relationship_probe_classified', {
            queue_item_id: item.id, target_path: new URL(target).pathname,
            classification: relationshipClassification, degree: evidence.degree,
            primary_controls: Object.entries(evidence.primary).filter(([, found]) => found).map(([name]) => name),
            more_menu_inspected: evidence.moreMenu.inspected,
            more_menu_controls: Object.entries(evidence.moreMenu).filter(([name, found]) => name !== 'inspected' && found).map(([name]) => name),
          });
          result = {
            success: true,
            data: {
              result_code: 'success', relationship_classification: relationshipClassification,
              accepted: relationshipClassification === 'already_connected',
              pending: relationshipClassification === 'invitation_pending',
              connect_available: relationshipClassification === 'eligible_for_connection_request',
              message_available: evidence.primary.message,
              follow_available: evidence.primary.follow,
              first_degree: evidence.degree === '1st', degree: evidence.degree,
              diagnostic_evidence: {
                ...readiness,
                sender_identity: intendedIdentity.profileUrl,
                sender_identity_verified: true,
                requested_target: target,
                presented_target: normalizeLinkedInTarget(readiness.finalUrl),
                route_surface: readiness.finalUrl.includes('/sales/') ? 'sales_navigator' : readiness.finalUrl.includes('/mwlite/') ? 'mobile' : 'standard_profile',
                browser_environment: browserEnvironment,
                hydrated: evidence.hydrated,
                header_controls: headerControls,
                more_menu_accessibility_controls: moreMenuControls,
                artifacts,
                primary_controls: Object.entries(evidence.primary).filter(([, found]) => found).map(([name]) => name),
                more_menu_inspected: evidence.moreMenu.inspected,
                more_menu_controls: Object.entries(evidence.moreMenu).filter(([name, found]) => name !== 'inspected' && found).map(([name]) => name),
              },
            },
          };
          break;
        }
        case 'connection_request': {
          const url = params.profile_url as string;
          const note = params.note as string | undefined;
          const productionAcceptanceId = typeof params.production_acceptance_authorization_id === 'string'
            ? params.production_acceptance_authorization_id
            : null;
          if (!url) throw new Error('profile_url required');
          const readiness = await waitForLinkedInProfileReady(page, url);
          if (!readiness.ready || !readiness.targetMatched) {
            result = { success: false, error: 'Final relationship preflight was inconclusive', data: { result_code: readiness.code, write_verified: false, interaction_crossed: false } };
            break;
          }
          const authorizedTarget = normalizeLinkedInTarget(url);
          const presentedTarget = normalizeLinkedInTarget(await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href));
          if (!authorizedTarget || presentedTarget !== authorizedTarget) {
            result = {
              success: false,
              error: 'Presented LinkedIn profile does not match the authorized target',
            };
            break;
          }
          let verifiedDisplayName: string | null = null;
          if (productionAcceptanceId) {
            const displayedNameCandidates = await page.locator(
              'main h1, .pv-text-details__left-panel h1, [data-view-name*="profile-top"] h1, .scaffold-layout__main h1',
            ).evaluateAll((elements) => Array.from(new Set(elements.filter((element) => {
              const node = element as HTMLElement;
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            }).map((element) => element.textContent?.replace(/\s+/g, ' ').trim()).filter((value): value is string => !!value))));
            const displayedName = displayedNameCandidates.length === 1 ? displayedNameCandidates[0] : null;
            const identity = verifyLinkedInDisplayName(params.expected_display_name, displayedName);
            if (!identity.allowed) {
              result = {
                success: false,
                error: 'Displayed LinkedIn identity does not exactly match the production acceptance authorization',
                data: {
                  result_code: 'target_identity_denied',
                  identity_code: identity.code,
                  write_verified: false,
                  retry_allowed: false,
                  interaction_crossed: false,
                  displayed_name_candidate_count: displayedNameCandidates.length,
                },
              };
              break;
            }
            verifiedDisplayName = identity.actual;
          }
          await recordWriteStage('profile_verified', false, {
            authorized_target: authorizedTarget,
            presented_target: presentedTarget,
            expected_display_name_verified: productionAcceptanceId ? true : undefined,
            displayed_name: verifiedDisplayName,
          });
          const readProfileState = async () => page.evaluate(() => {
            const visible = (element: Element) => { const n=element as HTMLElement,r=n.getBoundingClientRect(),s=getComputedStyle(n); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'; };
            const label = (element: Element) => [element.getAttribute('aria-label'),element.getAttribute('title'),element.textContent].filter(Boolean).join(' ').replace(/\s+/g,' ').trim().toLowerCase();
            const heading=Array.from(document.querySelectorAll('main h1,main h2,main [role="heading"],.scaffold-layout__main h1,.scaffold-layout__main h2')).find(visible);
            const header=heading?.closest('section,[data-view-name*="profile-top"],.pv-top-card')??heading?.parentElement?.parentElement??document.querySelector('main');
            document.querySelectorAll('[data-yuktris-write-connect],[data-yuktris-write-more]').forEach(e=>{e.removeAttribute('data-yuktris-write-connect');e.removeAttribute('data-yuktris-write-more');});
            const controls=Array.from(header?.querySelectorAll('button,a,[role="button"]')??[]).filter(visible);
            const connect=controls.find(e=>/(?:^|\b)connect(?:\b|$)|invite\s+.+\s+to\s+connect/i.test(label(e)));
            const more=controls.find(e=>/(?:^|\b)more(?:\b|$)|additional\s+actions/i.test(label(e)));
            connect?.setAttribute('data-yuktris-write-connect','primary'); more?.setAttribute('data-yuktris-write-more','true');
            const labels=controls.map(label),has=(p:RegExp)=>labels.some(v=>p.test(v));
            return { hasPending:has(/\bpending\b|invitation\s+sent|withdraw\s+invitation/),hasConnect:!!connect,hasMessage:has(/(?:^|\b)message(?:\b|$)/),hasConnected:has(/remove\s+connection|connection\s+since|1st\s+degree/),hasMore:!!more };
          });
          let semanticState=await readProfileState();
          let connectLocation: 'primary'|'more_menu'|null=semanticState.hasConnect?'primary':null;
          if (!semanticState.hasConnect && semanticState.hasMore) {
            const more=page.locator('[data-yuktris-write-more="true"]').first();
            await more.click(); await page.waitForTimeout(700);
            const menuConnect=page.locator('[role="menuitem"], [role="menu"] button, .artdeco-dropdown__item, [data-control-name]').filter({hasText:/connect/i}).first();
            if (await menuConnect.isVisible().catch(()=>false)) { await menuConnect.evaluate(e=>e.setAttribute('data-yuktris-write-connect','more_menu')); semanticState={...semanticState,hasConnect:true}; connectLocation='more_menu'; }
          }
          const initialState = classifyConnectionProfileState({ hasPending: semanticState.hasPending, hasConnect: semanticState.hasConnect, hasMessage: semanticState.hasConnected });
          if (initialState === 'already_pending') {
            await recordWriteStage('relationship_verified', false, { relationship: 'already_pending' });
            result = {
              success: true,
              data: {
                result_code: 'already_done',
                connection_state: 'request_already_pending',
                write_verified: false,
              },
            };
            break;
          }
          if (initialState === 'already_connected') {
            await recordWriteStage('relationship_verified', false, { relationship: 'already_connected' });
            result = {
              success: true,
              data: {
                result_code: 'already_done',
                connection_state: 'already_connected',
                write_verified: false,
              },
            };
            break;
          }
          if (initialState === 'unavailable') {
            await recordWriteStage('relationship_verified', false, { relationship: 'unavailable' });
            result = {
              success: false,
              error: 'Connect control not found — action unavailable',
              data: { result_code: 'not_available' },
            };
            break;
          }

          const connectBtn = page.locator('[data-yuktris-write-connect]').first();
          if (!await connectBtn.isVisible().catch(() => false)) {
            result = {
              success: false,
              error: 'Connect button not found — may already be connected',
            };
            break;
          }
          const connectElementType = await connectBtn.evaluate(e=>e.tagName.toLowerCase());
          await recordWriteStage('relationship_verified', false, { relationship: 'eligible_for_connection_request' });
          await recordWriteStage('connect_control_resolved', false, { connect_location: connectLocation, connect_element_type: connectElementType });
          let modalAppeared=false, finalSendClicked=false, immediateSend=false;
          await recordWriteStage('before_connect_click', true, { connect_location: connectLocation, connect_element_type: connectElementType });
          await connectBtn.click();
          await recordWriteStage('connect_clicked', true, { connect_location: connectLocation, connect_element_type: connectElementType });
          await page.waitForTimeout(800 + Math.random() * 1200);

          if (await this.linkedin.detectRestriction()) {
            result = {
              success: false,
              error: 'LinkedIn restriction detected after opening connect dialog',
              data: { result_code: 'outcome_unknown', write_verified: false, retry_allowed: false, interaction_crossed: true, connect_clicked: true, connect_location: connectLocation, connect_element_type: connectElementType },
            };
            break;
          }

          if (note) {
            const addNoteBtn = await page.$('button:has-text("Add a note")');
            if (!addNoteBtn) {
              result = { success: false, error: 'Add note control not found' };
              break;
            }
            await addNoteBtn.click();
            await page.waitForTimeout(500);
            const noteInput = await page.$('#custom-message');
            if (!noteInput) {
              result = {
                success: false,
                error: 'Connection note input not found',
              };
              break;
            }
            await noteInput.fill(note);
            await page.waitForTimeout(300);
            const sendBtn = await page.$('button:has-text("Send")');
            if (!sendBtn || (await sendBtn.isDisabled())) {
              result = {
                success: false,
                error: 'Connection request send control unavailable',
              };
              break;
            }
            await recordWriteStage('confirmation_present', true, { confirmation_kind: 'connection_note_send' });
            await recordWriteStage('before_confirmation_click', true, { confirmation_kind: 'connection_note_send' });
            await recordWriteStage('confirmation_click_attempted', true, { confirmation_kind: 'connection_note_send' });
            await this.clickExpectedLinkedInWriteControl(page, sendBtn, 'connection_note_send');
            finalSendClicked=true;
            await recordWriteStage('confirmation_clicked', true, { confirmation_kind: 'connection_note_send' });
          } else {
            const dialog = await page.$('div[role="dialog"]');
            modalAppeared=!!dialog;
            const scope = dialog ?? page;
            let confirmBtn: Awaited<ReturnType<typeof page.$>> = null;
            for (const label of NO_NOTE_CONFIRM_LABELS) {
              const candidate = await scope.$(`button:visible:has-text("${label}")`);
              if (!candidate) continue;
              const text = (await candidate.textContent())?.trim() ?? '';
              if (!isNoNoteConfirmCandidate(text) || (await candidate.isDisabled())) continue;
              confirmBtn = candidate;
              break;
            }
            if (!confirmBtn) {
              // Some cohorts confirm immediately on the profile Connect click with no dialog at all.
              // Some cohorts send immediately from the profile Connect control.
              // Do not click again: post-click evidence below decides the outcome.
              immediateSend=!dialog;
            } else {
              await recordWriteStage('confirmation_present', true, { confirmation_kind: 'invitation_send', modal_appeared: modalAppeared });
              await recordWriteStage('before_confirmation_click', true, { confirmation_kind: 'invitation_send', modal_appeared: modalAppeared });
              await recordWriteStage('confirmation_click_attempted', true, { confirmation_kind: 'invitation_send', modal_appeared: modalAppeared });
              await this.clickExpectedLinkedInWriteControl(page, confirmBtn, 'invitation_send');
              finalSendClicked=true;
              await recordWriteStage('confirmation_clicked', true, { confirmation_kind: 'invitation_send', modal_appeared: modalAppeared });
            }
          }
          await page.waitForTimeout(2000);
          await recordWriteStage('post_write_verification', true, { modal_appeared: modalAppeared, final_send_clicked: finalSendClicked, immediate_send_flow: immediateSend });
          const postSemanticState = await readProfileState();
          const postState = classifyConnectionProfileState({ hasPending: postSemanticState.hasPending, hasConnect: postSemanticState.hasConnect, hasMessage: postSemanticState.hasConnected });
          const pageText = await page.locator('body').innerText().catch(() => '');
          const hasSentEvidence = /invitation\s+(?:was\s+)?sent|request\s+(?:was\s+)?sent/i.test(pageText);
          const postClickOutcome = classifyPostClickOutcome({
            hasPending: postState === 'already_pending',
            hasMessage: postState === 'already_connected',
            hasSentEvidence,
          });
          if (postClickOutcome !== 'verified_sent') {
            result = {
              success: false,
              error: postClickOutcome === 'connected'
                ? 'Profile became connected without positive invitation-send evidence'
                : 'Connection request outcome is ambiguous',
              data: {
                result_code: 'outcome_unknown',
                connection_state: postClickOutcome,
                write_verified: false,
                retry_allowed: false,
                interaction_crossed: true, connect_clicked: true, connect_location: connectLocation, connect_element_type: connectElementType,
                modal_appeared: modalAppeared, final_send_clicked: finalSendClicked, immediate_send_flow: immediateSend,
              },
            };
            break;
          }
          result = {
            success: true,
            data: {
              result_code: 'success',
              connected: url,
              connection_state: 'request_pending',
              write_verified: true,
              verification: postState === 'already_pending' ? 'pending_control' : 'sent_invitation_evidence',
              interaction_crossed: true, connect_clicked: true, connect_location: connectLocation, connect_element_type: connectElementType,
              modal_appeared: modalAppeared, final_send_clicked: finalSendClicked, immediate_send_flow: immediateSend,
            },
          };
          break;
        }
        case 'send_message':
        case 'follow_up_message': {
          const prospectName = params.prospect_name as string;
          const message = params.message as string;
          const targetProfile = normalizeLinkedInTarget(params.profile_url as string);
          if (!prospectName || !message || !targetProfile) throw new Error('prospect_name, message, and canonical profile_url required');
          await page.goto('https://www.linkedin.com/messaging', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(1500 + Math.random() * 1500);
          const matchingConversations = await page.$$(`div.msg-conversation-listitem:has-text("${prospectName}")`);
          if (matchingConversations.length === 0) {
            result = {
              success: false,
              error: `Conversation with ${prospectName} not found`,
            };
            break;
          }
          if (matchingConversations.length > 1) {
            result = {
              success: false,
              error: `Multiple conversations match "${prospectName}" — refusing to guess the recipient`,
            };
            break;
          }
          const convEl = matchingConversations[0];
          await convEl.click();
          await page.waitForTimeout(1000);
          const presentedRecipient = await page.evaluate(() => {
            const header = document.querySelector('.msg-thread__link-to-profile, .msg-s-message-group__profile-link, a[href*="/in/"]');
            return header instanceof HTMLAnchorElement ? header.href : null;
          });
          if (!presentedRecipient || normalizeLinkedInTarget(presentedRecipient) !== targetProfile) {
            result = {
              success: false,
              error: 'Conversation recipient does not positively match the canonical target',
              data: { result_code: 'recipient_mismatch', write_verified: false, interaction_crossed: false },
            };
            break;
          }
          await recordWriteStage('profile_verified', false, { authorized_target: targetProfile, presented_target: normalizeLinkedInTarget(presentedRecipient) });
          const inputBox = await page.$('div.msg-form__contenteditable');
          if (!inputBox) {
            result = { success: false, error: 'Message input not found' };
            break;
          }
          await inputBox.click();
          await page.keyboard.type(message, { delay: 30 + Math.random() * 50 });
          await page.waitForTimeout(500);
          const submitBtn = await page.$('button[type="submit"]');
          if (!submitBtn || (await submitBtn.isDisabled())) {
            result = {
              success: false,
              error: 'Message send control unavailable',
            };
            break;
          }
          const exactOutboundBefore = await page.$$eval(
            '.msg-s-message-list__event .msg-s-event-listitem--outbound, .msg-s-message-group__message-bubble--outbound',
            (nodes, expected) => nodes.filter(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === expected).length,
            message.replace(/\s+/g, ' ').trim(),
          ).catch(() => 0);
          await recordWriteStage('before_message_send', true, { action_type: item.action_type, target_profile_url: targetProfile });
          await submitBtn.click();
          await recordWriteStage('message_send_attempted', true, { action_type: item.action_type, target_profile_url: targetProfile });
          await page.waitForTimeout(2000);
          await recordWriteStage('post_write_verification', true, { action_type: item.action_type, target_profile_url: targetProfile });
          const exactOutboundAfter = await page.$$eval(
            '.msg-s-message-list__event .msg-s-event-listitem--outbound, .msg-s-message-group__message-bubble--outbound',
            (nodes, expected) => nodes.filter(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === expected).length,
            message.replace(/\s+/g, ' ').trim(),
          ).catch(() => 0);
          if (exactOutboundAfter <= exactOutboundBefore) {
            result = {
              success: false,
              error: 'Message outcome is ambiguous after Send',
              data: { result_code: 'outcome_unknown', write_verified: false, retry_allowed: false, interaction_crossed: true, send_clicked: true },
            };
            break;
          }
          result = {
            success: true,
            data: { result_code: 'success', write_verified: true, sent_to: prospectName, target_profile_url: targetProfile, verification: 'exact_outbound_message_bubble' },
          };
          await recordWriteStage('message_sent', true, { action_type: item.action_type, target_profile_url: targetProfile, verification: 'exact_outbound_message_bubble' });
          break;
        }
        case 'like_post': {
          await page.goto('https://www.linkedin.com/feed', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(2000 + Math.random() * 2000);
          const likeBtn = await page.$('button[aria-label*="Like"]');
          if (!likeBtn) {
            result = { success: false, error: 'No like button found' };
            break;
          }
          await likeBtn.click();
          await page.waitForTimeout(1500);
          result = { success: true, data: { liked: true } };
          break;
        }
        case 'follow_company': {
          const url = params.company_url as string;
          if (!url) throw new Error('company_url required');
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(1500);
          const followBtn = await page.$('button:has-text("Follow")');
          if (!followBtn) {
            result = { success: false, error: 'Follow button not found' };
            break;
          }
          await followBtn.click();
          await page.waitForTimeout(1500);
          result = { success: true, data: { followed: url } };
          break;
        }
        case 'search_people': {
          const query = params.query as string;
          if (!query) throw new Error('query required');
          await page.goto(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000 + Math.random() * 2000);
          const cards = await page.$$('.search-results-container [data-chameleon-result-urn]');
          if (!cards || cards.length === 0) {
            result = { success: false, error: 'No search results found' };
            break;
          }
          const results: Array<Record<string, unknown>> = [];
          for (let i = 0; i < Math.min(cards.length, 10); i++) {
            const card = cards[i];
            const nameEl = await card.$('span.entity-result__title-text');
            const titleEl = await card.$('div.entity-result__primary-subtitle');
            const linkEl = await card.$('a.app-aware-link');
            results.push({
              name: nameEl ? (await nameEl.textContent())?.trim() : null,
              title: titleEl ? (await titleEl.textContent())?.trim() : null,
              profile_url: linkEl ? await linkEl.getAttribute('href') : null,
            });
          }
          result = { success: true, data: { results, count: results.length } };
          break;
        }
        case 'sales_nav_search': {
          const filters = validateSalesNavigatorPayload(params.filters ?? params);
          const unsupported = ['geography', 'industry', 'company_size', 'seniority', 'function', 'relationship', 'company_attributes'].filter((key) => {
            const value = filters[key as keyof typeof filters];
            return Array.isArray(value) ? value.length > 0 : !!value;
          });
          if (unsupported.length > 0) {
            result = {
              success: false,
              error: `Sales Navigator filters not safely supported by the current provider adapter: ${unsupported.join(', ')}`,
            };
            break;
          }
          const keywords = [filters.keywords, ...(filters.title ?? [])].filter(Boolean).join(' ').trim();
          const searchUrl = new URL('https://www.linkedin.com/sales/search/people');
          if (keywords) searchUrl.searchParams.set('keywords', keywords);
          await page.goto(searchUrl.toString(), {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          const current = new URL(page.url());
          if (!/(^|\.)linkedin\.com$/i.test(current.hostname) || !current.pathname.startsWith('/sales/')) {
            result = {
              success: false,
              error: 'Sales Navigator is not available for this LinkedIn account',
            };
            break;
          }
          const limit = filters.limit ?? 10;
          const resultSelector = 'a[href*="/sales/lead/"], a[href*="/in/"], [data-x-search-result], [data-anonymize="person-name"]';
          await page
            .locator(resultSelector)
            .first()
            .waitFor({ state: 'attached', timeout: 15000 })
            .catch(() => {});
          const evidence = await page.evaluate(() => ({
            current_path: location.pathname,
            result_list_surface_detected: !!document.querySelector('[data-x-search-result], ol.artdeco-list, .search-results__result-list, #search-results-container'),
            visible_result_card_count: Array.from(document.querySelectorAll('[data-x-search-result], li.artdeco-list__item, .search-results__result-item')).filter((element) => (element as HTMLElement).offsetParent !== null).length,
            sales_lead_link_count: document.querySelectorAll('a[href*="/sales/lead/"]').length,
            profile_link_count: document.querySelectorAll('a[href*="/in/"]').length,
            pagination_detected: !!document.querySelector('[role="navigation"][aria-label*="pagination" i], button[aria-label*="next" i]'),
            virtualized_surface_detected: !!document.querySelector('[data-virtualized], .artdeco-list, [data-x-search-result]'),
          }));
          const candidates = await page
            .$$eval(
              'a[href*="/sales/lead/"], a[href*="/in/"]',
              (links, max) => {
                const seen = new Set<string>();
                return links
                  .flatMap((link) => {
                    const anchor = link as HTMLAnchorElement;
                    const href = anchor.href.split('?')[0];
                    const card = anchor.closest('li, [data-x-search-result], .artdeco-list__item') ?? anchor.parentElement;
                    const clean = (value?: string | null) => value?.replace(/\s+/g, ' ').trim() || null;
                    const name = clean(anchor.textContent) || clean(anchor.getAttribute('aria-label')) || clean(card?.querySelector('[data-anonymize="person-name"], .artdeco-entity-lockup__title')?.textContent);
                    if (!href || !name || seen.has(href)) return [];
                    seen.add(href);
                    return [
                      {
                        name,
                        profile_url: href.includes('/in/') ? href : null,
                        sales_nav_lead_url: href.includes('/sales/lead/') ? href : null,
                        headline: clean(card?.querySelector('[data-anonymize="headline"], .artdeco-entity-lockup__subtitle')?.textContent),
                        company: clean(card?.querySelector('[data-anonymize="company-name"]')?.textContent),
                        location: clean(card?.querySelector('[data-anonymize="location"], .artdeco-entity-lockup__caption')?.textContent),
                      },
                    ];
                  })
                  .slice(0, max as number);
              },
              limit,
            )
            .catch(() => [] as Array<{ name: string; profile_url: string }>);
          logger.info('linkedin_sales_nav_surface', {
            queue_item_id: item.id,
            ...evidence,
            extracted_candidate_count: candidates.length,
          });
          result = {
            success: true,
            data: {
              result_code: 'success',
              candidates,
              count: candidates.length,
              evidence,
              applied_filters: filters,
            },
          };
          break;
        }
        case 'read_inbox': {
          await page.goto('https://www.linkedin.com/messaging', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(2000);
          const conversations = await page
            .$$eval('div.msg-conversation-listitem', (els) =>
              els.slice(0, 20).map((el) => ({
                name: el.querySelector('span.msg-conversation-listitem__participant-names')?.textContent?.trim() ?? null,
                preview: el.querySelector('p.msg-conversation-listitem__message-snippet')?.textContent?.trim() ?? null,
              })),
            )
            .catch(() => [] as Array<{ name: string | null; preview: string | null }>);
          result = {
            success: true,
            data: { conversations, count: conversations.length },
          };
          break;
        }
        case 'read_replies': {
          await page.goto('https://www.linkedin.com/messaging', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(2000);
          const prospectName = params.prospect_name as string | undefined;
          if (prospectName) {
            const matchingConversations = await page.$$(`div.msg-conversation-listitem:has-text("${prospectName}")`);
            if (matchingConversations.length === 0) {
              result = {
                success: false,
                error: `Conversation with ${prospectName} not found`,
              };
              break;
            }
            if (matchingConversations.length > 1) {
              result = {
                success: false,
                error: `Multiple conversations match "${prospectName}" — refusing to guess the thread`,
              };
              break;
            }
            await matchingConversations[0].click();
            await page.waitForTimeout(1000);
          }
          // Scroll the thread to the top to force LinkedIn's lazy loader to render the full history before extraction.
          await page
            .evaluate(() => {
              document.querySelector('.msg-s-message-list-container')?.scrollTo(0, 0);
            })
            .catch(() => {});
          await page.waitForTimeout(500);
          const messages = await page
            .$$eval('div.msg-s-message-list__event', (els) =>
              els.map((el) => ({
                external_id: el.getAttribute('data-event-urn') ?? el.id ?? null,
                sender: el.querySelector('span.msg-s-message-group__name')?.textContent?.trim() ?? null,
                body: el.querySelector('p.msg-s-event-listitem__body')?.textContent?.trim() ?? null,
                timestamp: el.querySelector('time')?.getAttribute('datetime') ?? null,
              })),
            )
            .catch(
              () =>
                [] as Array<{
                  external_id: string | null;
                  sender: string | null;
                  body: string | null;
                  timestamp: string | null;
                }>,
            );
          const ingested: Array<Record<string, unknown>> = [];
          for (const message of messages) {
            if (!message.body) continue;
            const normalizedSender = message.sender?.trim().toLowerCase();
            const intendedSender = prospectName?.trim().toLowerCase();
            if (intendedSender && normalizedSender !== intendedSender) continue;
            const externalId =
              message.external_id ||
              createHash('sha256')
                .update([accountId, message.sender ?? '', message.timestamp ?? '', message.body].join('\u001f'))
                .digest('hex');
            const classification = classifyLinkedInReply(message.body);
            const { data: reply, error } = await this.client.rpc('ingest_linkedin_reply', {
              p_workspace_id: item.workspace_id,
              p_account_id: accountId,
              p_external_reply_id: externalId,
              p_body: message.body,
              p_received_at: message.timestamp || new Date().toISOString(),
              p_sender_name: message.sender,
              p_conversation_id: (params.conversation_id as string) || null,
              p_contact_id: (params.contact_id as string) || null,
              p_sequence_id: (params.sequence_id as string) || null,
              p_campaign_id: (params.campaign_id as string) || null,
              p_classification: classification.classification,
              p_confidence: classification.confidence,
              p_manual_reason: classification.classification === 'unknown' ? 'Deterministic classifier could not classify safely' : null,
            });
            if (error) throw new Error(`Reply ingestion failed: ${this.sanitizeError(error)}`);
            ingested.push(reply as Record<string, unknown>);
          }
          result = {
            success: true,
            data: {
              messages_seen: messages.length,
              replies_ingested: ingested.length,
              replies: ingested,
            },
          };
          break;
        }
        default:
          result = {
            success: false,
            error: `Unhandled automation action: ${item.action_type}`,
          };
      }

      if (writeAuditId) {
        const pathname = (() => {
          try {
            return new URL(page.url()).pathname.toLowerCase();
          } catch {
            return '';
          }
        })();
        const classification = pathname.includes('/checkpoint') || pathname.includes('/challenge') ? 'verification_required' : result.success ? 'success' : 'failed';
        const positivelyVerifiedWrite = result.success && result.data?.result_code === 'success' && result.data?.write_verified === true;
        const resultCode = positivelyVerifiedWrite ? 'success' : result.data?.result_code === 'outcome_unknown' || (interactionCrossed && !result.success) ? 'outcome_unknown' : String(result.data?.result_code ?? 'failed');
        const outcomeEvidence = {
          ...(result.data ?? {}),
          interaction_stage: interactionStage,
          interaction_crossed: interactionCrossed,
          retry_allowed: resultCode === 'outcome_unknown' ? false : !interactionCrossed,
          error: result.error ?? null,
        };
        await finalizeLinkedInWrite(
          this.client,
          writeAuditId,
          resultCode,
          positivelyVerifiedWrite,
          classification,
          outcomeEvidence,
          typeof params.production_acceptance_authorization_id === 'string' ? params.production_acceptance_authorization_id : null,
        );
        writeAuditId = null;
        if (classification === 'verification_required') {
          result = { success: false, error: 'LinkedIn verification required' };
        }
      }

      const acceptanceGenerationId = params.acceptance_generation_id as string | undefined;
      if (acceptanceGenerationId && item.action_type === 'connection_request') {
        const outcome = result.data?.write_verified === true
          ? 'verified_sent'
          : result.data?.connection_state === 'already_connected'
            ? 'already_connected'
            : result.data?.connection_state === 'request_already_pending'
              ? 'already_pending'
              : 'outcome_unknown';
        const { error: generationError } = await this.client.rpc('finalize_controlled_acceptance_generation', {
          p_generation_id: acceptanceGenerationId,
          p_queue_id: item.id,
          p_outcome: outcome,
          p_evidence: result.data ?? { error: result.error ?? 'unknown' },
        });
        if (generationError) throw new Error(`Acceptance generation finalization failed: ${this.sanitizeError(generationError)}`);
      }

      if (persistentContext) await this.synchronizePersistentContext(persistentContext, persistentSessionId);
      else {
        if (result.success) await this.refreshSessionAfterAutomation(sessionId!);
        await this.linkedin.close();
      }

      if (result.success) {
        await this.updateAccount(accountId, {
          last_activity_at: new Date().toISOString(),
        });
        await this.logSessionEvent(item.workspace_id, accountId, `automation_${item.action_type}`, result.data ?? {});
        await this.queue.complete(item.id, result.data ?? { success: true }, Date.now() - startTime);
        logger.info('linkedin_job_completed', {
          queue_item_id: item.id,
          workspace_id: item.workspace_id,
          account_id: accountId,
          action: item.action_type,
        });
      } else {
        const retryAllowed = !interactionCrossed && result.data?.retry_allowed !== false;
        const explicitUnknown = result.data?.result_code === 'outcome_unknown';
        const outcome = interactionCrossed || explicitUnknown
          ? { ...(result.data ?? {}), result_code: 'outcome_unknown', write_verified: false, retry_allowed: false, interaction_crossed: true, interaction_stage: interactionStage }
          : { ...(result.data ?? {}), result_code: result.data?.result_code ?? 'failed', write_verified: false, retry_allowed: retryAllowed, interaction_crossed: false, interaction_stage: interactionStage };
        await this.queue.fail(item.id, result.error || 'Automation action failed', Date.now() - startTime, retryAllowed, outcome);
        logger.warn('linkedin_job_failed', {
          queue_item_id: item.id,
          workspace_id: item.workspace_id,
          account_id: accountId,
          action: item.action_type,
          reason: result.error,
        });
      }
    } catch (err) {
      if (writeAuditId) {
        let classification = 'failed';
        try {
          const pathname = new URL(this.linkedin.getPage().url()).pathname.toLowerCase();
          if (pathname.includes('/checkpoint') || pathname.includes('/challenge')) classification = 'verification_required';
        } catch {
          /* retain sanitized failure classification */
        }
        const resultCode = interactionCrossed ? 'outcome_unknown' : 'failed';
        const evidence = {
          result_code: resultCode,
          write_verified: false,
          retry_allowed: !interactionCrossed,
          interaction_crossed: interactionCrossed,
          interaction_stage: interactionStage,
          error: this.sanitizeError(err),
        };
        await finalizeLinkedInWrite(
          this.client,
          writeAuditId,
          resultCode,
          false,
          classification,
          evidence,
          typeof item.action_params.production_acceptance_authorization_id === 'string'
            ? item.action_params.production_acceptance_authorization_id
            : null,
        ).catch((finalizeError) => {
          logger.error('linkedin_write_audit_finalize_failed', {
            queue_item_id: item.id,
            error: this.sanitizeError(finalizeError),
          });
        });
      }
      await this.linkedin.close().catch(() => {});
      const msg = this.sanitizeError(err);
      logger.error('Automation action error', {
        action: item.action_type,
        error: msg,
      });
      logger.error('linkedin_job_failed', {
        queue_item_id: item.id,
        workspace_id: item.workspace_id,
        account_id: accountId,
        action: item.action_type,
        reason: msg,
      });
      const outcome = failureOutcomeForStage(interactionStage, msg);
      await this.queue.fail(item.id, msg, Date.now() - startTime, !interactionCrossed, outcome);
    }
  }

  private async clickExpectedLinkedInWriteControl(
    page: Page,
    control: ElementHandle<HTMLElement | SVGElement>,
    expectedKind: 'invitation_send' | 'connection_note_send',
  ): Promise<void> {
    const descriptor = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        accessibleName: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.replace(/\s+/g, ' ').trim() || '',
        center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      };
    });
    if (!descriptor.accessibleName || await this.linkedin.detectRestriction()) throw new Error('Expected LinkedIn confirmation control is not safe to click');
    try {
      await control.click({ timeout: 5000 });
      return;
    } catch (firstError) {
      const obstruction = await page.evaluate(({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        const checkpoint = /checkpoint|challenge|captcha|security verification/i.test(`${location.pathname} ${document.body.innerText.slice(0, 2000)}`);
        return {
          checkpoint,
          tag: top?.tagName.toLowerCase() ?? null,
          id: top?.id || null,
          testId: top?.getAttribute('data-testid') || null,
          benignInteropOutlet: !!top?.closest('#interop-outlet[data-testid="interop-shadowdom"]'),
        };
      }, descriptor.center);
      logger.warn('linkedin_write_control_obstructed', { expected_kind: expectedKind, obstruction });
      if (obstruction.checkpoint || await this.linkedin.detectRestriction()) throw new Error('LinkedIn security or checkpoint UI obstructed confirmation');
      if (!obstruction.benignInteropOutlet) throw new Error(`Unknown LinkedIn UI obstruction before ${expectedKind}`);
      await page.waitForFunction(
        ({ x, y }) => !document.elementFromPoint(x, y)?.closest('#interop-outlet[data-testid="interop-shadowdom"]'),
        descriptor.center,
        { timeout: 2500 },
      ).catch(() => {});
      if (await this.linkedin.detectRestriction()) throw new Error('LinkedIn security UI appeared before confirmation retry');
      const resolved = page.getByRole('button', { name: descriptor.accessibleName, exact: true }).first();
      if (!(await resolved.isVisible().catch(() => false)) || await resolved.isDisabled().catch(() => true)) {
        throw new Error(`Expected ${expectedKind} control was not stable after transient obstruction`);
      }
      const remainsObstructed = await resolved.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return !!document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('#interop-outlet[data-testid="interop-shadowdom"]');
      });
      if (remainsObstructed) throw new Error(`Transient LinkedIn interop outlet did not clear before ${expectedKind}`);
      await resolved.click({ timeout: 5000 });
      logger.info('linkedin_write_control_resolved_after_transient_obstruction', { expected_kind: expectedKind, initial_error: this.sanitizeError(firstError) });
    }
  }

  private async openPersistentContextForTask(item: QueueItem): Promise<ContextRecord> {
    if (!item.account_id) throw new Error('Persistent Context requires an account');
    await this.linkedinContexts.ensureV1Enrollment(item.workspace_id, item.account_id);
    const owner: ContextLeaseOwner = {
      workspaceId: item.workspace_id,
      accountId: item.account_id,
      queueItemId: item.id,
      workerId: this.workerId,
      attemptId: item.attempt_id,
    };
    let context = await this.linkedinContexts.ensureProvisioned(owner);
    const newlyProvisioned = context.status === 'active' && !context.last_synchronized_at;
    context = await this.linkedinContexts.acquire(owner);
    this.activeContextLease = { context, owner };
    await this.linkedinContexts.reconcileBeforeSession(context, owner);
    logger.info(newlyProvisioned ? 'linkedin_context_created' : 'linkedin_context_loaded', {
      queue_item_id: item.id,
      workspace_id: item.workspace_id,
      account_id: item.account_id,
      context_id: context.id,
      context_generation: context.generation,
    });
    await this.linkedin.launch(undefined, sessionOptionsForAccount(true, context));
    await this.linkedin.newContext();
    const sessionId = this.linkedin.getSessionId();
    if (!sessionId) throw new Error('Persistent Browserbase session has no identifier');
    await this.linkedinContexts.attachSession(context.id, sessionId, owner);
    logger.info('linkedin_browser_attached', {
      queue_item_id: item.id,
      workspace_id: item.workspace_id,
      account_id: item.account_id,
      browserbase_session_id: sessionId,
      context_id: context.id,
      playwright_connected: true,
    });
    return context;
  }

  private async synchronizePersistentContext(context: ContextRecord, sessionId: string | null): Promise<void> {
    const active = this.activeContextLease;
    if (!active || active.context.id !== context.id || !sessionId) throw new Error('Persistent Context synchronization ownership is unavailable');
    await this.linkedin.close();
    await this.linkedinContexts.synchronize(context, sessionId, active.owner);
    this.activeContextLease = null;
  }

  // ── RPC Helpers ────────────────────────────────────────────

  private async updateAccount(accountId: string, updates: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.rpc('update_linkedin_account_state', {
      p_account_id: accountId,
      p_updates: updates,
    });
    if (error) throw new Error(`Failed to persist LinkedIn account state: ${this.sanitizeError(error)}`);
  }

  private async loadIntendedIdentity(accountId: string, workspaceId?: string): Promise<IntendedLinkedInIdentity> {
    let query = this.client.from('linkedin_accounts').select('expected_profile_url, profile_url, profile_name, linkedin_email').eq('id', accountId);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Unable to load intended LinkedIn account identity: ${this.sanitizeError(error)}`);
    if (!data) throw new Error('LinkedIn account was not found in the expected workspace');
    return {
      profileUrl: data.expected_profile_url || data.profile_url,
      profileName: data.profile_name,
      linkedinEmail: data.linkedin_email,
    };
  }

  private async bindAuthenticatedIdentity(workspaceId: string, accountId: string, profileUrl?: string | null): Promise<void> {
    if (!profileUrl) throw new Error('Authenticated LinkedIn identity has no personal profile URL');
    const { error } = await this.client.rpc('bind_linkedin_account_identity', {
      p_workspace_id: workspaceId,
      p_account_id: accountId,
      p_profile_url: profileUrl,
    });
    if (error) throw new Error(`Failed to bind authenticated LinkedIn identity: ${this.sanitizeError(error)}`);
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? 'Unknown error');
    return message
      .replace(/(li_at|jsessionid|password|token|cookie|authorization)=?[^\s&]*/gi, '$1=[redacted]')
      .replace(/https?:\/\/[^\s]+/gi, '[url redacted]')
      .slice(0, 500);
  }

  private async logSessionEvent(workspaceId: string, accountId: string, eventType: string, eventData: Record<string, unknown>): Promise<void> {
    try {
      await this.client.rpc('log_linkedin_session_event', {
        p_workspace_id: workspaceId,
        p_account_id: accountId,
        p_event_type: eventType,
        p_event_data: eventData,
      });
    } catch (err) {
      logger.error('Failed to log session event', { error: String(err) });
    }
  }

  private async cleanupConnectionArtifacts(workspaceId: string, accountId: string): Promise<void> {
    const { data, error } = await this.client.from('linkedin_auth_interactions').select('id, metadata, status').eq('workspace_id', workspaceId).eq('account_id', accountId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;

    for (const interaction of data ?? []) {
      const metadata = {
        ...((interaction.metadata as Record<string, unknown> | null) ?? {}),
      };
      delete metadata.browserbase_live_url;
      delete metadata.debugger_url;
      await this.client
        .from('linkedin_auth_interactions')
        .update({
          metadata,
          user_response: null,
          status: interaction.status === 'pending' ? 'expired' : interaction.status,
        })
        .eq('id', interaction.id);
    }
    await this.updateAccount(accountId, {
      browserbase_session_id: null,
      browser_connected_at: null,
    });
  }

  private async saveSession(workspaceId: string, accountId: string, session: SessionData): Promise<string | null> {
    const cookiesEnc = encrypt(JSON.stringify(session.cookies), this.encryptionSecret);
    const storageEnc = encrypt(JSON.stringify(session.storageState), this.encryptionSecret);
    const localEnc = encrypt(JSON.stringify(session.localStorage), this.encryptionSecret);
    const sessionEnc = encrypt(JSON.stringify(session.sessionStorage), this.encryptionSecret);

    const { data, error } = await this.client.rpc('save_linkedin_session', {
      p_workspace_id: workspaceId,
      p_account_id: accountId,
      p_session_name: `session-${accountId.slice(0, 8)}`,
      p_cookies_encrypted: cookiesEnc,
      p_storage_state_encrypted: storageEnc,
      p_local_storage_encrypted: localEnc,
      p_session_storage_encrypted: sessionEnc,
      p_encryption_key_id: getKeyId(),
      p_user_agent: session.userAgent,
      p_viewport: session.viewport,
      p_browser_version: session.browserVersion || null,
      p_playwright_version: session.playwrightVersion || null,
      p_timezone: session.timezone || null,
      p_language: session.language || null,
      p_browserbase_session_id: this.linkedin.getSessionId(),
      p_browser_fingerprint: session.fingerprint || {},
    });

    if (error) {
      logger.error('Failed to save session', { error: error.message });
      return null;
    }
    const sid = data as unknown as string;
    logger.info('Session saved', {
      session_id: sid,
      browser_version: session.browserVersion,
      fingerprint: !!session.fingerprint,
    });
    return sid || null;
  }

  private async loadSessionForAccount(accountId: string): Promise<{ session: SessionData; sessionId: string } | null> {
    const { data, error } = await this.client.rpc('load_latest_linkedin_session', {
      p_account_id: accountId,
    });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      logger.warn('No active session found', { account_id: accountId });
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    try {
      const session: SessionData = {
        cookies: JSON.parse(decrypt(row.cookies_encrypted, this.encryptionSecret)),
        storageState: JSON.parse(decrypt(row.storage_state_encrypted, this.encryptionSecret)),
        localStorage: JSON.parse(decrypt(row.local_storage_encrypted, this.encryptionSecret)),
        sessionStorage: JSON.parse(decrypt(row.session_storage_encrypted, this.encryptionSecret)),
        userAgent: row.user_agent || 'Mozilla/5.0',
        viewport: row.viewport || { width: 1440, height: 900 },
        timezone: row.timezone || null,
        language: row.language || null,
        browserVersion: row.browser_version || null,
        playwrightVersion: row.playwright_version || null,
        fingerprint: row.browser_fingerprint || null,
      };
      return { session, sessionId: row.id };
    } catch (err) {
      logger.error('Session decryption failed', { error: String(err) });
      return null;
    }
  }

  // ── Session Validation: verify restored session before automation ──

  private async validateSessionForAutomation(accountId: string): Promise<{
    valid: boolean;
    session: SessionData;
    sessionId: string;
  } | null> {
    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) return null;

    const { session, sessionId } = loaded;

    try {
      await this.linkedin.launch(undefined);
      await this.linkedin.newContext();
      const restored = await this.linkedin.restoreSession(session);
      if (!restored) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', {
          p_session_id: sessionId,
          p_reason: 'Session restore failed during validation',
        });
        await this.updateAccount(accountId, {
          connection_state: 'session_expired',
          last_error: 'Session expired during validation',
        });
        logger.warn('Session validation failed: restore failed', {
          account_id: accountId,
        });
        return null;
      }

      const intendedIdentity = await this.loadIntendedIdentity(accountId);
      const validation = await this.linkedin.validateSession(intendedIdentity);
      if (!validation.valid) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', {
          p_session_id: sessionId,
          p_reason: validation.reason,
        });
        await this.updateAccount(accountId, {
          connection_state: 'session_expired',
          last_error: validation.reason || 'Session validation failed',
        });
        logger.warn('Session validation failed', {
          account_id: accountId,
          reason: validation.reason,
        });
        return null;
      }

      // Session is valid — update health
      await this.client.rpc('update_session_health', {
        p_session_id: sessionId,
        p_health_status: 'healthy',
        p_connection_state: 'active',
      });
      await this.updateAccount(accountId, {
        connection_state: 'connected',
        health_status: 'healthy',
        last_validated_at: new Date().toISOString(),
        last_error: null,
      });
      logger.info('Session validated successfully', {
        account_id: accountId,
        session_id: sessionId,
      });
      return { valid: true, session, sessionId };
    } catch (err) {
      await this.linkedin.close().catch(() => {});
      logger.error('Session validation error', { error: String(err) });
      return null;
    }
  }

  // ── Refresh session data after automation ──

  private async refreshSessionAfterAutomation(sessionId: string): Promise<void> {
    try {
      const refreshed = await this.linkedin.refreshSession();
      if (!refreshed) {
        logger.warn('Session refresh returned null', { session_id: sessionId });
        return;
      }

      const cookiesEnc = encrypt(JSON.stringify(refreshed.cookies), this.encryptionSecret);
      const storageEnc = encrypt(JSON.stringify(refreshed.storageState), this.encryptionSecret);
      const localEnc = encrypt(JSON.stringify(refreshed.localStorage), this.encryptionSecret);
      const sessionEnc = encrypt(JSON.stringify(refreshed.sessionStorage), this.encryptionSecret);

      await this.client.rpc('refresh_session_data', {
        p_session_id: sessionId,
        p_cookies_encrypted: cookiesEnc,
        p_storage_state_encrypted: storageEnc,
        p_local_storage_encrypted: localEnc,
        p_session_storage_encrypted: sessionEnc,
        p_last_verified_at: new Date().toISOString(),
        p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      logger.info('Session refreshed after automation', {
        session_id: sessionId,
      });
    } catch (err) {
      logger.error('Session refresh failed', { error: String(err) });
    }
  }

  // ── Session Health Check (runs in heartbeat loop) ──

  private async checkSessionHealth(): Promise<void> {
    try {
      const { data, error } = await this.client.rpc('get_connected_linkedin_accounts');
      if (error || !data) return;

      const accounts = Array.isArray(data) ? data : [data];
      for (const account of accounts) {
        const accountId = account.id as string;
        try {
          const loaded = await this.loadSessionForAccount(accountId);
          if (!loaded) {
            await this.updateAccount(accountId, {
              connection_state: 'session_invalid',
              health_status: 'expired',
              last_error: 'No active session found',
            });
            continue;
          }

          // Decryption proves storage integrity only. It must never promote a
          // LinkedIn session to healthy without a real browser validation.
        } catch (err) {
          logger.error('Health check failed for account', {
            account_id: accountId,
            error: String(err),
          });
        }
      }
    } catch (err) {
      logger.error('Session health check error', { error: String(err) });
    }
  }

  // ── Session Recovery: reconnect after browser crash or disconnect ──

  private async recoverSession(accountId: string, workspaceId: string): Promise<boolean> {
    logger.info('Attempting session recovery', { account_id: accountId });

    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) {
      logger.warn('No session to recover', { account_id: accountId });
      return false;
    }

    const { session, sessionId } = loaded;

    try {
      // Close any existing browser
      await this.linkedin.close().catch(() => {});

      // Fresh browser launch
      await this.linkedin.launch(undefined);
      await this.linkedin.newContext();

      // Restore session
      const restored = await this.linkedin.restoreSession(session);
      if (!restored) {
        await this.client.rpc('update_session_health', {
          p_session_id: sessionId,
          p_health_status: 'expired',
          p_failure_reason: 'Session restore failed during recovery',
          p_connection_state: 'expired',
        });
        await this.updateAccount(accountId, {
          connection_state: 'session_expired',
          last_error: 'Session expired during recovery',
        });
        await this.linkedin.close();
        return false;
      }

      // Validate restored session
      const intendedIdentity = await this.loadIntendedIdentity(accountId, workspaceId);
      const validation = await this.linkedin.validateSession(intendedIdentity);
      if (!validation.valid) {
        await this.client.rpc('update_session_health', {
          p_session_id: sessionId,
          p_health_status: 'expired',
          p_failure_reason: validation.reason,
          p_connection_state: 'expired',
        });
        await this.updateAccount(accountId, {
          connection_state: 'session_expired',
          last_error: validation.reason || 'Validation failed',
        });
        await this.linkedin.close();
        return false;
      }

      // Recovery successful
      await this.client.rpc('update_session_health', {
        p_session_id: sessionId,
        p_health_status: 'healthy',
        p_connection_state: 'active',
      });
      await this.updateAccount(accountId, {
        connection_state: 'connected',
        session_status: 'connected',
        health_status: 'healthy',
        last_validated_at: new Date().toISOString(),
        last_error: null,
      });

      logger.info('Session recovery successful', { account_id: accountId });
      await this.linkedin.close();
      return true;
    } catch (err) {
      await this.linkedin.close().catch(() => {});
      logger.error('Session recovery failed', { error: String(err) });
      return false;
    }
  }
}

async function readSafeFunctionError(response: Response): Promise<{ error_code?: string; error_message?: string }> {
  const text = (await response.text()).slice(0, 2000);
  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const message = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : undefined;
    return {
      ...(code ? { error_code: code.slice(0, 100) } : {}),
      ...(message ? { error_message: message.slice(0, 500) } : {}),
    };
  } catch {
    return { error_message: 'Non-JSON Edge Function error response' };
  }
}

type ReplyClassification = 'positive' | 'interested' | 'neutral' | 'objection' | 'not_interested' | 'wrong_person' | 'do_not_contact' | 'unknown';

function classifyLinkedInReply(body: string): {
  classification: ReplyClassification;
  confidence: number;
} {
  const text = body.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(do not contact|don't contact|stop messaging|remove me|unsubscribe)\b/.test(text)) return { classification: 'do_not_contact', confidence: 0.98 };
  if (/\b(not interested|no interest|not a fit|no thanks|please don't)\b/.test(text)) return { classification: 'not_interested', confidence: 0.95 };
  if (/\b(wrong person|not the right person|speak to|contact .* instead)\b/.test(text)) return { classification: 'wrong_person', confidence: 0.9 };
  if (/\b(too expensive|already use|not now|concern|however|but we)\b/.test(text)) return { classification: 'objection', confidence: 0.8 };
  if (/\b(interested|tell me more|more information|send details|learn more)\b/.test(text)) return { classification: 'interested', confidence: 0.9 };
  if (/\b(yes|sounds good|let's talk|book|schedule|available|happy to chat)\b/.test(text)) return { classification: 'positive', confidence: 0.85 };
  if (/\b(thanks|thank you|received|okay|ok)\b/.test(text)) return { classification: 'neutral', confidence: 0.7 };
  return { classification: 'unknown', confidence: 0 };
}
