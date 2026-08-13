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

const INTERACTIVE_AUTH_TIMEOUT_MS = interactiveAuthTimeoutMs();
const TEST_CONNECTION_TIMEOUT = parseInt(process.env.TEST_CONNECTION_TIMEOUT_MS || '120000', 10);
const INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS = interactiveBrowserSessionTimeoutMs();
const HEARTBEAT_INTERVAL = parseInt(process.env.WORKER_HEARTBEAT_INTERVAL || '15000', 10);
const POLL_INTERVAL = parseInt(process.env.QUEUE_POLL_INTERVAL || '3000', 10);
const SESSION_HEARTBEAT_INTERVAL = parseInt(process.env.SESSION_HEARTBEAT_INTERVAL_MS || '120000', 10);

export class Worker {
  private client: SupabaseClient;
  private workerId: string;
  private workerName: string;
  private region: string;
  private encryptionSecret: string;
  private credentialEncryptionSecret: string;
  private queue: Queue;
  private linkedin: LinkedInBrowser;
  private linkedinContexts: LinkedInContextService;
  private activeContextLease: { context: ContextRecord; owner: ContextLeaseOwner } | null = null;
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentTaskId: string | null = null;
  private workspaceId: string | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encKey = process.env.LINKEDIN_SESSION_ENCRYPTION_KEY;
    const credentialKey = process.env.LINKEDIN_CREDENTIAL_ENCRYPTION_KEY;

    if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    if (!encKey) throw new Error('Missing LINKEDIN_SESSION_ENCRYPTION_KEY — generate with: openssl rand -base64 32');

    const executionMode = process.env.LINKEDIN_EXECUTION_MODE || 'cloud_persistent_agent';
    if (executionMode !== 'cloud_persistent_agent') throw new Error('LINKEDIN_EXECUTION_MODE must be cloud_persistent_agent');
    if (credentialKey && credentialKey.length < 32) throw new Error('Invalid LINKEDIN_CREDENTIAL_ENCRYPTION_KEY');
    this.client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    this.workerId = process.env.WORKER_ID || crypto.randomUUID();
    this.workerName = `linkedin-worker-${this.workerId}`;
    this.region = process.env.WORKER_REGION || 'local';
    this.encryptionSecret = encKey;
    this.credentialEncryptionSecret = credentialKey || '';

    this.queue = new Queue(this.client, this.workerId, POLL_INTERVAL);
    this.linkedin = new LinkedInBrowser(this.client, true, this.encryptionSecret);
    this.linkedinContexts = new LinkedInContextService(this.client);
    logger.info('Worker environment identity', {
      environment: process.env.NODE_ENV || 'unspecified',
      supabase_host: new URL(supabaseUrl).hostname,
      browserbase_project_suffix: process.env.BROWSERBASE_PROJECT_ID?.slice(-6) || null,
    });
  }

  getHealth(): { workerId: string; browserbase: boolean; running: boolean; currentTask: string | null } {
    return { workerId: this.workerId, browserbase: browserbase.isConfigured(), running: this.running, currentTask: this.currentTaskId };
  }

  async start(): Promise<void> {
    const useBrowserbase = browserbase.isConfigured();
    logger.info('Worker starting', { id: this.workerId, region: this.region, provider: useBrowserbase ? 'browserbase' : 'local-chromium' });
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

    // Fix 9: Recover orphaned queue tasks from previous worker crash
    try {
      const { data: recovered, error: recoverError } = await this.client.rpc('recover_orphaned_queue_tasks', { p_timeout_minutes: 10 });
      if (recoverError) {
        logger.warn('Queue recovery RPC error', { error: recoverError.message });
      } else if (recovered && Number(recovered) > 0) {
        logger.info('Recovered orphaned queue tasks', { count: Number(recovered) });
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
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.sessionHeartbeatTimer) { clearInterval(this.sessionHeartbeatTimer); this.sessionHeartbeatTimer = null; }
    await this.linkedin.close();
    const { error: stopErr } = await this.client.rpc('set_browser_worker_closing', { p_worker_id: this.workerId });
    if (stopErr) logger.error('Failed to mark worker as closing', { error: stopErr.message });
    logger.info('Worker stopped');
  }

  private async register(): Promise<void> {
    const metadata = {
      worker_region: this.region,
      browser_provider: browserbase.isConfigured() ? 'browserbase' : 'local-chromium',
      capabilities: ['linkedin_connect', 'linkedin_test_connection', 'linkedin_action'],
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
        p_metadata: { last_heartbeat: now, current_task: this.currentTaskId, browser_provider: browserbase.isConfigured() ? 'browserbase' : 'local-chromium' },
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
        await this.client.rpc('touch_account_activity', { p_account_id: acc.id });
      }

      const cutoff = new Date(Date.now() - 3600000).toISOString();
      await this.client.rpc('cleanup_old_heartbeats', { p_cutoff: cutoff });

      logger.info('Session heartbeat sent', { accounts: accountList.length });
    } catch (err) {
      logger.error('Session heartbeat failed', { error: String(err) });
    }
  }

  private async pollLoop(): Promise<void> {
    logger.info('Poll loop started', { worker_id: this.workerId, poll_interval_ms: POLL_INTERVAL });
    let pollCount = 0;
    while (this.running) {
      pollCount++;
      try {
        if (browserbase.isConfigured()) {
          await this.linkedinContexts.processOneDeletion(this.workerId);
        }
        logger.info(`Poll #${pollCount}: calling claimNext()`, { worker_id: this.workerId });
        const item = await this.queue.claimNext();
        if (item) {
          if (item.action_type === 'linkedin_connect') logger.info('LinkedIn queue orchestration timing', {
            queue_item_id: item.id, workspace_id: item.workspace_id, account_id: item.account_id,
            stage: 'Q3_worker_claimed', timestamp: new Date().toISOString(),
          });
          this.currentTaskId = item.id;
          logger.info(`Poll #${pollCount}: task claimed, processing`, { task_id: item.id, action: item.action_type });
          await this.processTask(item);
          this.currentTaskId = null;
        } else {
          logger.info(`Poll #${pollCount}: no tasks`, { worker_id: this.workerId });
        }
      } catch (err) {
        logger.error('Poll loop error', { poll_count: pollCount, error: String(err) });
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
    logger.info('Poll loop stopped', { worker_id: this.workerId });
  }

  private async processTask(item: QueueItem): Promise<void> {
    const startTime = Date.now();
    let leaseLost = false;
    let leaseRenewalFailures = 0;
    const leaseTimer = setInterval(() => {
      void this.queue.renew(item.id).then((renewed) => {
        leaseRenewalFailures = 0;
        if (!renewed) {
          leaseLost = true;
          this.linkedin.cancel('Queue lease ownership lost');
        }
      }).catch((error) => {
        leaseRenewalFailures++;
        logger.warn('Queue lease renewal failed', { task_id: item.id, error: this.sanitizeError(error) });
        if (leaseRenewalFailures >= 2) {
          leaseLost = true;
          this.linkedin.cancel('Queue lease could not be renewed');
        }
      });
      const active = this.activeContextLease;
      if (active) void this.linkedinContexts.renew(active.context.id, active.owner).then((renewed) => {
        if (!renewed) this.linkedin.cancel('Persistent Context lease ownership lost');
      }).catch((error) => {
        logger.warn('Persistent Context lease renewal failed', { error: this.sanitizeError(error) });
        this.linkedin.cancel('Persistent Context lease could not be renewed');
      });
    }, 30000);
    logger.info('Processing task', { id: item.id, action: item.action_type, workspace: item.workspace_id, account: item.account_id });

    try {
      await this.client.rpc('heartbeat_browser_worker', {
        p_worker_id: this.workerId, p_status: 'busy',
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
      const msg = this.sanitizeError(err);
      const isBbError = err instanceof BrowserbaseError;
      const isRetryable = isBbError && ![401, 402, 403].includes((err as BrowserbaseError).statusCode);
      logger.error('Task processing error', { id: item.id, error: msg, browserbase_error: isBbError, retryable: isRetryable });
      await this.queue.fail(item.id, msg, Date.now() - startTime, isRetryable);
    } finally {
      clearInterval(leaseTimer);
      // Every task owns a short-lived browser session. Cleanup is idempotent and
      // prevents Browserbase keep-alive sessions from leaking on unexpected errors.
      await this.linkedin.close().catch((error) => {
        logger.warn('Browser cleanup after task failed', { task_id: item.id, error: this.sanitizeError(error) });
      });
      if (this.activeContextLease) {
        const active = this.activeContextLease;
        this.activeContextLease = null;
        await this.linkedinContexts.release(active.context.id, active.owner).catch((error) => {
          logger.warn('Persistent Context lease release failed', { error: this.sanitizeError(error) });
        });
      }
      if (item.action_type === 'linkedin_connect' && item.account_id) {
        await this.cleanupConnectionArtifacts(item.workspace_id, item.account_id).catch((error) => {
          logger.warn('Connection artifact cleanup failed', { account_id: item.account_id, error: this.sanitizeError(error) });
        });
      }
      if (leaseLost) logger.warn('Task ended after queue lease ownership was lost', { task_id: item.id });
    }
  }

  // ── Progress Helper ─────────────────────────────────────────

  private makeProgressCallback(workspaceId: string, accountId: string, queueItemId: string): ProgressCallback {
    return async (step: ProgressStep, message: string, metadata?: Record<string, unknown>) => {
      logger.info('Progress', { step, message, account_id: accountId });
      try {
        if (step === 'challenge_detected' || step === 'waiting_for_user' || step === 'human_challenge_required' || step === 'provider_rechallenge') {
          await this.updateAccount(accountId, { connection_state: 'requires_action', last_error: null });
        } else if (step === 'waiting_for_login' || step === 'verifying_authentication' || step === 'saving_session') {
          await this.updateAccount(accountId, { connection_state: 'authenticating', last_error: null });
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
      p_workspace_id: item.workspace_id, p_account_id: item.account_id, p_queue_item_id: item.id,
      p_worker_id: this.workerId, p_attempt_id: item.attempt_id,
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
      p_workspace_id: item.workspace_id, p_account_id: item.account_id, p_queue_item_id: item.id,
      p_worker_id: this.workerId, p_attempt_id: item.attempt_id, p_success: success, p_invalid: invalid,
    });
    if (error) logger.warn('Unable to update LinkedIn credential status', { account_id: item.account_id, success, invalid });
  }

  private async handleConnect(item: QueueItem, startTime: number): Promise<void> {
    const workspaceId = item.workspace_id;
    const accountId = item.account_id;
    if (!accountId) {
      logger.error('handleConnect: missing account_id', { queue_item_id: item.id });
      await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false);
      return;
    }

    const logPersistentFastPath = (stage: string, at = Date.now()): void => logger.info('LinkedIn persistent fast-path latency', {
      queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId, stage,
      timestamp: new Date(at).toISOString(), elapsed_from_claim_ms: at - startTime,
    });
    logPersistentFastPath('P0_connect_claimed');
    const onProgress = this.makeProgressCallback(workspaceId, accountId, item.id);
    const intendedIdentity = await this.loadIntendedIdentity(accountId, workspaceId);
    if (persistentContextsEnabled()) await this.linkedinContexts.ensureV1Enrollment(workspaceId, accountId);
    const usePersistentContext = await this.linkedinContexts.shouldUsePersistentContext(
      workspaceId, accountId, persistentContextsEnabled(),
    );
    let persistentContext: ContextRecord | null = null;
    let launchOptions = {
      ...sessionOptionsForAccount(false),
      timeoutMs: INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS,
    };
    if (usePersistentContext) {
      const owner: ContextLeaseOwner = {
        workspaceId, accountId, queueItemId: item.id, workerId: this.workerId, attemptId: item.attempt_id,
      };
      persistentContext = await this.linkedinContexts.ensureProvisioned(owner);
      persistentContext = await this.linkedinContexts.acquire(owner);
      logPersistentFastPath('P1_context_lease_acquired');
      this.activeContextLease = { context: persistentContext, owner };
      await this.linkedinContexts.reconcileBeforeSession(persistentContext, owner);
      launchOptions = {
        ...sessionOptionsForAccount(true, persistentContext),
        timeoutMs: INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS,
      };
      await onProgress('checking_existing_session', 'Checking your LinkedIn connection...');
    }

    // STATE: authenticating (transition from IDLE)
    await this.updateAccount(accountId, { connection_state: 'authenticating', last_error: null, browserbase_session_id: null, browser_connected_at: null });
    await this.logSessionEvent(workspaceId, accountId, 'created', { action: 'linkedin_connect' });

    // ── Try session reuse first ──────────────────────────────────
    const existingSession = usePersistentContext ? null : await this.loadSessionForAccount(accountId);
    let reuseOpenBrowserForAuthentication = false;
    let preserveRestoredPage = false;
    if (existingSession) {
      logger.info('Found existing session, attempting reuse', { account_id: accountId });
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
            connection_state: 'connected', session_status: 'connected', status: 'active',
            last_validated_at: new Date().toISOString(), last_login_at: new Date().toISOString(), last_error: null,
            profile_url: effectiveProfileUrl, profile_name: reuseResult.identity?.profileName,
            profile_headline: reuseResult.identity?.profileHeadline,
          });
          await this.logSessionEvent(workspaceId, accountId, 'login_success', {
            profile_url: effectiveProfileUrl, profile_name: reuseResult.identity?.profileName, reused: true,
          });
          await this.linkedin.close();
          await onProgress('connected', reuseResult.identityState === 'unresolved'
            ? 'Authenticated LinkedIn session restored. Identity verification remains pending.'
            : 'LinkedIn connected successfully using the restored session.');
          await this.queue.complete(item.id, {
            connected: true, reused: true, identity: reuseResult.identity,
            identity_state: reuseResult.identityState, duration_ms: Date.now() - startTime,
          }, Date.now() - startTime);
          logger.info('LinkedIn account connected via session reuse', { account_id: accountId });
          return;
        }

        if (reuseResult.reuseExistingBrowser && reuseResult.requiresAction) {
          reuseOpenBrowserForAuthentication = true;
          preserveRestoredPage = reuseResult.preserveCurrentPage === true;
          logger.info('Restored session requires human authentication in the same browser', {
            account_id: accountId, authentication_state: reuseResult.authState,
            preserve_current_page: preserveRestoredPage,
          });
        } else {
          logger.warn('Restored session verification failed without changing authentication classification', {
            account_id: accountId, authentication_state: reuseResult.authState,
            identity_state: reuseResult.identityState, error_code: reuseResult.errorCode,
          });
          await onProgress('connection_failed', reuseResult.error || 'Existing LinkedIn connection could not be verified.', {
            error_code: reuseResult.errorCode || 'existing_session_verification_failed',
            authentication_state: reuseResult.authState || 'unknown', identity_state: reuseResult.identityState || 'unresolved',
          });
          await this.linkedin.close();
          await this.updateAccount(accountId, { connection_state: 'failed', status: 'error', last_error: reuseResult.error });
          await this.queue.fail(item.id, reuseResult.error || 'Existing session verification failed', Date.now() - startTime, reuseResult.retryable === true);
          return;
        }
      } catch (err) {
        logger.warn('Session reuse error; failing without creating a second browser session', { error: this.sanitizeError(err) });
        await this.linkedin.close().catch(() => {});
        await this.updateAccount(accountId, { connection_state: 'failed', status: 'error', last_error: 'Existing LinkedIn session check failed' });
        await this.queue.fail(item.id, 'Existing LinkedIn session check failed', Date.now() - startTime, true);
        return;
      }
    }

    // ── Fresh login flow: strict state machine ───────────────────
    // STATE: CREATING_SESSION + CONNECTING_BROWSER (handled inside launch)
    logger.info('handleConnect: starting fresh login flow', { account_id: accountId });

    try {
      if (!reuseOpenBrowserForAuthentication) await this.linkedin.launch(usePersistentContext ? undefined : onProgress, launchOptions);
    } catch (err) {
      const msg = this.sanitizeError(err);
      const retryable = err instanceof BrowserbaseError && ![401, 402, 403].includes(err.statusCode);
      logger.error('handleConnect: launch failed', { error: msg });
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: `Browser launch failed: ${msg}` });
      await onProgress('login_failed', `Browser launch failed: ${msg}`);
      await this.queue.fail(item.id, `Browser launch failed: ${msg}`, Date.now() - startTime, retryable);
      return;
    }

    // ── Verify: Browserbase session exists ──────────────────────
    const bbSessionId = this.linkedin.getSessionId();
    const liveUrl = this.linkedin.getLiveUrl();
    logger.info('handleConnect: browser session ready', { account_id: accountId, bbSessionId, liveUrlAvailable: !!liveUrl });
    if (usePersistentContext) logPersistentFastPath('P2_context_session_created');

    if (!bbSessionId && browserbase.isConfigured()) {
      const msg = 'No Browserbase session ID after launch';
      logger.error('handleConnect: verification failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: msg });
      await onProgress('login_failed', msg);
      await this.queue.fail(item.id, msg, Date.now() - startTime, false);
      return;
    }

    if (persistentContext && bbSessionId && this.activeContextLease) {
      await this.linkedinContexts.attachSession(persistentContext.id, bbSessionId, this.activeContextLease.owner);
    }

    // ── Create browser context ──────────────────────────────────
    try {
      if (!reuseOpenBrowserForAuthentication) await this.linkedin.newContext();
    } catch (err) {
      const msg = this.sanitizeError(err);
      logger.error('handleConnect: context creation failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: `Context creation failed: ${msg}` });
      await onProgress('login_failed', `Context creation failed: ${msg}`);
      await this.queue.fail(item.id, `Context creation failed: ${msg}`, Date.now() - startTime, false);
      return;
    }

    // ── Connect: open LinkedIn → wait for auth → verify → save ──
    let result;
    if (usePersistentContext) {
      const preflight = await this.linkedin.checkExistingAuthenticatedSession(intendedIdentity);
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
        await this.updateAccount(accountId, { browserbase_session_id: bbSessionId, browser_connected_at: new Date().toISOString() });
        result = await this.linkedin.connect(
          INTERACTIVE_AUTH_TIMEOUT_MS, onProgress, workspaceId, accountId, item.id, intendedIdentity,
          preflight.preserveCurrentPage, true,
        );
      }
    } else {
      await onProgress('auth_required', 'Sign in to LinkedIn once in the secure browser.', { lifecycle_stage: 'L0_auth_required' });
      await this.updateAccount(accountId, { browserbase_session_id: bbSessionId, browser_connected_at: new Date().toISOString() });
      result = await this.linkedin.connect(INTERACTIVE_AUTH_TIMEOUT_MS, onProgress, workspaceId, accountId, item.id, intendedIdentity, preserveRestoredPage);
    }

    logger.info('handleConnect: linkedin.connect() returned', { account_id: accountId, success: result.success, requiresAction: result.requiresAction, error: result.error });

    if (!result.success) {
      if (result.errorCode === 'identity_resolution_pending' && result.authState === 'authenticated' && result.session) {
        const pendingError = result.error || 'LinkedIn identity verification is pending.';
        const sessionId = await this.saveSession(workspaceId, accountId, result.session);
        if (!sessionId) {
          await this.linkedin.close();
          await this.updateAccount(accountId, { connection_state: 'failed', status: 'error', session_status: 'disconnected', last_error: 'Session save failed — cookies were not persisted' });
          await this.queue.fail(item.id, 'Session save failed', Date.now() - startTime, true);
          return;
        }
        logger.info('fresh_session_persisted', {
          account_id: accountId, browserbase_session_id: bbSessionId,
          authentication_state: 'authenticated', identity_state: 'unresolved',
          canonical_identity_found: false, final_connect_classification: 'identity_resolution_pending',
        });
        await this.updateAccount(accountId, { browserbase_session_id: null, browser_connected_at: null });
        await this.linkedin.close();
        if (persistentContext && bbSessionId && this.activeContextLease) {
          await this.linkedinContexts.synchronize(persistentContext, bbSessionId, this.activeContextLease.owner);
          this.activeContextLease = null;
        }
        await this.updateAccount(accountId, {
          connection_state: 'requires_action', status: 'pending_login', session_status: 'disconnected', last_error: pendingError,
        });
        await onProgress('identity_resolution_pending', pendingError, {
          error_code: result.errorCode, authentication_state: 'authenticated', identity_state: 'unresolved',
        });
        await this.queue.fail(item.id, pendingError, Date.now() - startTime, true);
        return;
      }
      await this.linkedin.close();

      const isNonRetryable = (result as { nonRetryable?: boolean }).nonRetryable === true;

      if (result.cancelled) {
        await this.updateAccount(accountId, { connection_state: 'cancelled', session_status: 'disconnected', status: 'disconnected', last_error: null });
        await this.logSessionEvent(workspaceId, accountId, 'login_failed', { reason: 'user_cancelled' });
        return;
      }

      await this.updateAccount(accountId, { connection_state: 'failed', status: 'error', session_status: 'disconnected', last_error: result.error || 'Connection failed' });
      await this.logSessionEvent(workspaceId, accountId, 'login_failed', { error: result.error });
      await this.queue.fail(item.id, result.error || 'Connection failed', Date.now() - startTime, result.retryable === true || !isNonRetryable);
      return;
    }

    // ── Save encrypted session ──────────────────────────────────
    const identityVerifiedAt = result.identityVerifiedAt ?? Date.now();
    const logPostAuthStage = (stage: string, stageStartedAt = identityVerifiedAt): void => logger.info('LinkedIn post-auth latency', {
      queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId, stage,
      timestamp: new Date().toISOString(), elapsed_from_identity_verified_ms: Date.now() - identityVerifiedAt,
      stage_duration_ms: Date.now() - stageStartedAt,
    });
    logPostAuthStage('identity_verified');
    if (result.stateCapturedAt) logPostAuthStage('authenticated_state_captured', result.identityVerifiedAt);

    // Authentication and canonical identity are verified and browser state is
    // captured. Revoke customer Live View access before backend finalization.
    await this.updateAccount(accountId, { browserbase_session_id: null, browser_connected_at: null });
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
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: 'Session save failed — cookies were not persisted' });
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
      const synchronization = await this.linkedinContexts.synchronize(persistentContext, bbSessionId, this.activeContextLease.owner);
      logger.info('LinkedIn post-auth latency', {
        queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId, stage: 'browserbase_session_terminal_observed',
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
        queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId,
        context_id: persistentContext.id, context_generation: persistentContext.generation,
      });
      const proofContext = await this.openPersistentContextForTask(item);
      const proofSessionId = this.linkedin.getSessionId();
      const proof = await this.linkedin.verifyPersistentAuthentication({
        ...intendedIdentity, profileUrl: effectiveProfileUrl || intendedIdentity.profileUrl,
      });
      await this.synchronizePersistentContext(proofContext, proofSessionId);
      if (!proof.success) {
        const proofError = proof.error || 'Persistent LinkedIn authentication could not be verified in a new secure session.';
        await this.updateAccount(accountId, {
          connection_state: proof.errorCode === 'checkpoint_required' ? 'requires_action' : 'session_expired',
          session_status: 'disconnected', status: 'pending_login', last_error: proofError,
        });
        await onProgress('connection_failed', proofError, {
          error_code: 'context_persistence_not_verified', authentication_state: proof.authState,
        });
        await this.queue.fail(item.id, proofError, Date.now() - startTime, false);
        logger.warn('linkedin_persistence_proof_failed', {
          queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId,
          context_id: proofContext.id, context_generation: proofContext.generation,
          authentication_state: proof.authState, identity_state: proof.identityState,
        });
        return;
      }
      logger.info('linkedin_persistence_proof_completed', {
        queue_item_id: item.id, workspace_id: workspaceId, account_id: accountId,
        context_id: proofContext.id, context_generation: proofContext.generation,
        duration_ms: Date.now() - proofStartedAt,
      });
    }

    await this.updateAccount(accountId, {
      connection_state: 'connected', session_status: 'connected', status: 'active',
      last_validated_at: new Date().toISOString(), last_login_at: new Date().toISOString(), last_error: null,
      profile_url: effectiveProfileUrl, profile_name: result.identity?.profileName,
      profile_headline: result.identity?.profileHeadline,
    });
    logPostAuthStage('durable_account_connected');
    if (usePersistentContext) logPersistentFastPath('P8_durable_connected');

    await onProgress('connected', persistentContext
      ? 'LinkedIn connected successfully using its persistent secure browser.'
      : 'LinkedIn connected successfully. Session encrypted and verified.');

    await this.queue.complete(item.id, {
      connected: true, session_id: sessionId, identity: result.identity, persistent_context: !!persistentContext,
      duration_ms: Date.now() - startTime,
    }, Date.now() - startTime);

    await Promise.allSettled([
      this.client.rpc('insert_auth_interaction', {
        p_workspace_id: workspaceId, p_account_id: accountId, p_queue_item_id: item.id,
        p_interaction_type: 'session_saved', p_step: 'saving_session',
        p_message: 'Session encrypted and saved successfully.', p_status: 'completed', p_metadata: { session_id: sessionId },
      }),
      this.logSessionEvent(workspaceId, accountId, 'login_success', {
        profile_url: result.identity?.profileUrl, profile_name: result.identity?.profileName,
      }),
      this.logSessionEvent(workspaceId, accountId, 'validated', { session_id: sessionId }),
    ]);

    await this.linkedin.close();

    logger.info('linkedin_connected', { account_id: accountId, session_id: sessionId, persistent_context: !!persistentContext });
  }

  // ── Test Connection Handler ────────────────────────────────

  private async handleTestConnection(item: QueueItem, startTime: number): Promise<void> {
    const accountId = item.account_id;
    if (!accountId) { await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false); return; }

    if (persistentContextsEnabled()) {
      const intendedIdentity = await this.loadIntendedIdentity(accountId, item.workspace_id);
      const context = await this.openPersistentContextForTask(item);
      const browserbaseSessionId = this.linkedin.getSessionId();
      const result = await this.linkedin.verifyPersistentAuthentication(intendedIdentity);
      await this.synchronizePersistentContext(context, browserbaseSessionId);
      if (result.success) {
        await this.updateAccount(accountId, {
          connection_state: 'connected', session_status: 'connected', status: 'active',
          last_validated_at: new Date().toISOString(), last_error: null,
          profile_url: result.effectiveProfileUrl, profile_name: result.identity?.profileName,
        });
        await this.logSessionEvent(item.workspace_id, accountId, 'validated', { test: true, persistent_context: true });
        await this.queue.complete(item.id, { healthy: true, identity: result.identity, persistent_context: true }, Date.now() - startTime);
      } else {
        const checkpoint = result.errorCode === 'checkpoint_required';
        await this.updateAccount(accountId, { connection_state: checkpoint ? 'requires_action' : 'session_expired', last_error: result.error });
        logger.info(checkpoint ? 'linkedin_checkpoint_required' : 'linkedin_reauth_required', {
          queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId,
          authentication_state: result.authState, identity_state: result.identityState,
        });
        await this.queue.fail(item.id, result.error || 'LinkedIn requires reauthentication', Date.now() - startTime, false);
      }
      return;
    }

    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) {
      await this.updateAccount(accountId, { connection_state: 'session_invalid', last_error: 'No active session found' });
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
        connection_state: 'connected', last_validated_at: new Date().toISOString(), last_error: null,
        profile_url: result.identity?.profileUrl, profile_name: result.identity?.profileName,
      });
      await this.logSessionEvent(item.workspace_id, accountId, 'validated', { test: true });
      await this.queue.complete(item.id, { healthy: true, identity: result.identity }, Date.now() - startTime);
    } else {
      await this.client.rpc('expire_session', { p_session_id: loaded.sessionId, p_reason: result.error });
      const state = result.error?.includes('expired') ? 'session_expired' : 'session_invalid';
      await this.updateAccount(accountId, { connection_state: state, last_error: result.error });
      await this.queue.fail(item.id, result.error || 'Test connection failed', Date.now() - startTime, false);
    }
  }

  // ── Automation Action Handler ──────────────────────────────

  private async handleAutomationAction(item: QueueItem, startTime: number): Promise<void> {
    const accountId = item.account_id;
    if (!accountId) { await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false); return; }

    const { data: agentAccount, error: agentAccountError } = await this.client.from('linkedin_accounts')
      .select('status').eq('id', accountId).eq('workspace_id', item.workspace_id).maybeSingle();
    if (agentAccountError) throw new Error(`Cloud agent status check failed: ${this.sanitizeError(agentAccountError)}`);
    if (agentAccount?.status === 'paused') {
      await this.queue.fail(item.id, 'Cloud LinkedIn Agent is paused', Date.now() - startTime, false);
      logger.info('agent_paused', { queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId });
      return;
    }

    const usePersistentContext = persistentContextsEnabled();
    const loaded = usePersistentContext ? null : await this.loadSessionForAccount(accountId);
    if (!usePersistentContext && !loaded) {
      await this.updateAccount(accountId, { connection_state: 'session_invalid', last_error: 'No active session for automation' });
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
    let result: { success: boolean; data?: Record<string, unknown>; error?: string };

    try {
      logger.info('linkedin_job_started', { queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId, action: item.action_type });
      let persistentContext: ContextRecord | null = null;
      let persistentSessionId: string | null = null;
      if (usePersistentContext) {
        persistentContext = await this.openPersistentContextForTask(item);
        persistentSessionId = this.linkedin.getSessionId();
        const authentication = await this.linkedin.verifyPersistentAuthentication(intendedIdentity);
        if (!authentication.success) {
          await this.synchronizePersistentContext(persistentContext, persistentSessionId);
          const checkpoint = authentication.errorCode === 'checkpoint_required';
          await this.updateAccount(accountId, { connection_state: checkpoint ? 'requires_action' : 'session_expired', last_error: authentication.error });
          logger.info(checkpoint ? 'linkedin_checkpoint_required' : 'linkedin_reauth_required', {
            queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId,
            authentication_state: authentication.authState, identity_state: authentication.identityState,
          });
          await this.queue.fail(item.id, authentication.error || 'LinkedIn requires reauthentication', Date.now() - startTime, false);
          return;
        }
      } else {
        await this.linkedin.launch(undefined);
        await this.linkedin.newContext();
        const restored = await this.linkedin.restoreSession(sessionData!);
        if (!restored) {
          await this.linkedin.close();
          await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: 'Session restore failed during automation' });
          await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: 'Session expired during automation' });
          await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
          return;
        }
        const validation = await this.linkedin.validateSession(intendedIdentity);
        if (!validation.valid) {
          await this.linkedin.close();
          await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: validation.reason });
          await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: validation.reason || 'Session validation failed' });
          await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
          return;
        }
      }

      const page = this.linkedin.getPage();

      switch (item.action_type) {
        case 'profile_visit':
        case 'read_profile': {
          const url = params.profile_url as string;
          if (!url) throw new Error('profile_url required');
          const parsed = new URL(url);
          if (!/^https?:$/.test(parsed.protocol) || !/(^|\.)linkedin\.com$/i.test(parsed.hostname) || !parsed.pathname.startsWith('/in/')) {
            throw new Error('A valid LinkedIn personal profile URL is required');
          }
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (item.action_type === 'read_profile') {
            const profile = await page.evaluate(() => ({
              name: document.querySelector('main h1')?.textContent?.trim() || null,
              headline: document.querySelector('main .text-body-medium')?.textContent?.trim() || null,
              location: document.querySelector('main .text-body-small.inline')?.textContent?.trim() || null,
              canonical_url: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || location.href,
            }));
            result = { success: true, data: { result_code: 'success', profile } };
          } else {
            result = { success: true, data: { result_code: 'success', visited: parsed.origin + parsed.pathname } };
          }
          break;
        }
        case 'connection_request': {
          const url = params.profile_url as string;
          const note = params.note as string | undefined;
          if (!url) throw new Error('profile_url required');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500 + Math.random() * 2000);
          const connectBtn = await page.$('button span:has-text("Connect")');
          if (!connectBtn) {
            result = { success: false, error: 'Connect button not found — may already be connected' };
            break;
          }
          await connectBtn.click();
          await page.waitForTimeout(800 + Math.random() * 1200);
          if (note) {
            const addNoteBtn = await page.$('button:has-text("Add a note")');
            if (!addNoteBtn) { result = { success: false, error: 'Add note control not found' }; break; }
            await addNoteBtn.click();
            await page.waitForTimeout(500);
            const noteInput = await page.$('#custom-message');
            if (!noteInput) { result = { success: false, error: 'Connection note input not found' }; break; }
            await noteInput.fill(note);
            await page.waitForTimeout(300);
            const sendBtn = await page.$('button:has-text("Send")');
            if (!sendBtn || await sendBtn.isDisabled()) { result = { success: false, error: 'Connection request send control unavailable' }; break; }
            await sendBtn.click();
          } else {
            const sendBtn = await page.$('button:has-text("Send without note")');
            if (!sendBtn || await sendBtn.isDisabled()) { result = { success: false, error: 'Connection request send control unavailable' }; break; }
            await sendBtn.click();
          }
          await page.waitForTimeout(2000);
          const stillOpen = await page.$('#custom-message, button:has-text("Send without note")');
          if (stillOpen) { result = { success: false, error: 'Connection request was not confirmed as sent' }; break; }
          result = { success: true, data: { connected: url } };
          break;
        }
        case 'send_message':
        case 'follow_up_message': {
          const prospectName = params.prospect_name as string;
          const message = params.message as string;
          if (!prospectName || !message) throw new Error('prospect_name and message required');
          await page.goto('https://www.linkedin.com/messaging', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500 + Math.random() * 1500);
          const convEl = await page.$(`div.msg-conversation-listitem:has-text("${prospectName}")`);
          if (!convEl) { result = { success: false, error: `Conversation with ${prospectName} not found` }; break; }
          await convEl.click();
          await page.waitForTimeout(1000);
          const inputBox = await page.$('div.msg-form__contenteditable');
          if (!inputBox) { result = { success: false, error: 'Message input not found' }; break; }
          await inputBox.click();
          await page.keyboard.type(message, { delay: 30 + Math.random() * 50 });
          await page.waitForTimeout(500);
          const submitBtn = await page.$('button[type="submit"]');
          if (!submitBtn || await submitBtn.isDisabled()) { result = { success: false, error: 'Message send control unavailable' }; break; }
          await submitBtn.click();
          await page.waitForTimeout(2000);
          const composerText = (await inputBox.textContent())?.trim() ?? '';
          if (composerText === message.trim()) { result = { success: false, error: 'Message was not confirmed as sent' }; break; }
          result = { success: true, data: { sent_to: prospectName } };
          break;
        }
        case 'like_post': {
          await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000 + Math.random() * 2000);
          const likeBtn = await page.$('button[aria-label*="Like"]');
          if (!likeBtn) { result = { success: false, error: 'No like button found' }; break; }
          await likeBtn.click();
          await page.waitForTimeout(1500);
          result = { success: true, data: { liked: true } };
          break;
        }
        case 'follow_company': {
          const url = params.company_url as string;
          if (!url) throw new Error('company_url required');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500);
          const followBtn = await page.$('button:has-text("Follow")');
          if (!followBtn) { result = { success: false, error: 'Follow button not found' }; break; }
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
          const unsupported = ['geography', 'industry', 'company_size', 'seniority', 'function', 'relationship', 'company_attributes']
            .filter(key => {
              const value = filters[key as keyof typeof filters];
              return Array.isArray(value) ? value.length > 0 : !!value;
            });
          if (unsupported.length > 0) {
            result = { success: false, error: `Sales Navigator filters not safely supported by the current provider adapter: ${unsupported.join(', ')}` };
            break;
          }
          const keywords = [filters.keywords, ...(filters.title ?? [])].filter(Boolean).join(' ').trim();
          const searchUrl = new URL('https://www.linkedin.com/sales/search/people');
          if (keywords) searchUrl.searchParams.set('keywords', keywords);
          await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
          const current = new URL(page.url());
          if (!/(^|\.)linkedin\.com$/i.test(current.hostname) || !current.pathname.startsWith('/sales/')) {
            result = { success: false, error: 'Sales Navigator is not available for this LinkedIn account' };
            break;
          }
          const limit = filters.limit ?? 10;
          const candidates = await page.$$eval('a[href*="/sales/lead/"], a[href*="/in/"]', (links, max) => {
            const seen = new Set<string>();
            return links.flatMap(link => {
              const anchor = link as HTMLAnchorElement;
              const href = anchor.href.split('?')[0];
              const name = anchor.textContent?.trim() || null;
              if (!href || !name || seen.has(href)) return [];
              seen.add(href);
              return [{ name, profile_url: href }];
            }).slice(0, max as number);
          }, limit).catch(() => [] as Array<{ name: string; profile_url: string }>);
          result = { success: true, data: { result_code: 'success', candidates, count: candidates.length, applied_filters: filters } };
          break;
        }
        case 'read_inbox': {
          await page.goto('https://www.linkedin.com/messaging', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
          const conversations = await page.$$eval('div.msg-conversation-listitem', (els) =>
            els.slice(0, 20).map((el) => ({
              name: el.querySelector('span.msg-conversation-listitem__participant-names')?.textContent?.trim() ?? null,
              preview: el.querySelector('p.msg-conversation-listitem__message-snippet')?.textContent?.trim() ?? null,
            }))
          ).catch(() => [] as Array<{ name: string | null; preview: string | null }>);
          result = { success: true, data: { conversations, count: conversations.length } };
          break;
        }
        case 'read_replies': {
          await page.goto('https://www.linkedin.com/messaging', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
          const prospectName = params.prospect_name as string | undefined;
          if (prospectName) {
            const conversation = await page.$(`div.msg-conversation-listitem:has-text("${prospectName}")`);
            if (!conversation) { result = { success: false, error: `Conversation with ${prospectName} not found` }; break; }
            await conversation.click();
            await page.waitForTimeout(1000);
          }
          const messages = await page.$$eval('div.msg-s-message-list__event', (els) =>
            els.map((el) => ({
              external_id: el.getAttribute('data-event-urn') ?? el.id ?? null,
              sender: el.querySelector('span.msg-s-message-group__name')?.textContent?.trim() ?? null,
              body: el.querySelector('p.msg-s-event-listitem__body')?.textContent?.trim() ?? null,
              timestamp: el.querySelector('time')?.getAttribute('datetime') ?? null,
            }))
          ).catch(() => [] as Array<{ external_id: string | null; sender: string | null; body: string | null; timestamp: string | null }>);
          const ingested: Array<Record<string, unknown>> = [];
          for (const message of messages) {
            if (!message.body) continue;
            const normalizedSender = message.sender?.trim().toLowerCase();
            const intendedSender = prospectName?.trim().toLowerCase();
            if (intendedSender && normalizedSender !== intendedSender) continue;
            const externalId = message.external_id || createHash('sha256')
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
          result = { success: true, data: { messages_seen: messages.length, replies_ingested: ingested.length, replies: ingested } };
          break;
        }
        default:
          result = { success: false, error: `Unhandled automation action: ${item.action_type}` };
      }

      if (persistentContext) await this.synchronizePersistentContext(persistentContext, persistentSessionId);
      else {
        if (result.success) await this.refreshSessionAfterAutomation(sessionId!);
        await this.linkedin.close();
      }

      if (result.success) {
        await this.updateAccount(accountId, { last_activity_at: new Date().toISOString() });
        await this.logSessionEvent(item.workspace_id, accountId, `automation_${item.action_type}`, result.data ?? {});
        await this.queue.complete(item.id, result.data ?? { success: true }, Date.now() - startTime);
        logger.info('linkedin_job_completed', { queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId, action: item.action_type });
      } else {
        await this.queue.fail(item.id, result.error || 'Automation action failed', Date.now() - startTime, true);
        logger.warn('linkedin_job_failed', { queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId, action: item.action_type, reason: result.error });
      }
    } catch (err) {
      await this.linkedin.close().catch(() => {});
      const msg = this.sanitizeError(err);
      logger.error('Automation action error', { action: item.action_type, error: msg });
      logger.error('linkedin_job_failed', { queue_item_id: item.id, workspace_id: item.workspace_id, account_id: accountId, action: item.action_type, reason: msg });
      await this.queue.fail(item.id, msg, Date.now() - startTime, true);
    }
  }

  private async openPersistentContextForTask(item: QueueItem): Promise<ContextRecord> {
    if (!item.account_id) throw new Error('Persistent Context requires an account');
    await this.linkedinContexts.ensureV1Enrollment(item.workspace_id, item.account_id);
    const owner: ContextLeaseOwner = {
      workspaceId: item.workspace_id, accountId: item.account_id, queueItemId: item.id,
      workerId: this.workerId, attemptId: item.attempt_id,
    };
    let context = await this.linkedinContexts.ensureProvisioned(owner);
    const newlyProvisioned = context.status === 'active' && !context.last_synchronized_at;
    context = await this.linkedinContexts.acquire(owner);
    this.activeContextLease = { context, owner };
    await this.linkedinContexts.reconcileBeforeSession(context, owner);
    logger.info(newlyProvisioned ? 'linkedin_context_created' : 'linkedin_context_loaded', {
      queue_item_id: item.id, workspace_id: item.workspace_id, account_id: item.account_id,
      context_id: context.id, context_generation: context.generation,
    });
    await this.linkedin.launch(undefined, sessionOptionsForAccount(true, context));
    await this.linkedin.newContext();
    const sessionId = this.linkedin.getSessionId();
    if (!sessionId) throw new Error('Persistent Browserbase session has no identifier');
    await this.linkedinContexts.attachSession(context.id, sessionId, owner);
    logger.info('linkedin_browser_attached', {
      queue_item_id: item.id, workspace_id: item.workspace_id, account_id: item.account_id,
      browserbase_session_id: sessionId, context_id: context.id, playwright_connected: true,
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
    let query = this.client
      .from('linkedin_accounts')
      .select('expected_profile_url, profile_url, profile_name, linkedin_email')
      .eq('id', accountId);
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
    const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? 'Unknown error');
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
    const { data, error } = await this.client
      .from('linkedin_auth_interactions')
      .select('id, metadata, status')
      .eq('workspace_id', workspaceId)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    for (const interaction of data ?? []) {
      const metadata = { ...((interaction.metadata as Record<string, unknown> | null) ?? {}) };
      delete metadata.browserbase_live_url;
      delete metadata.debugger_url;
      await this.client.from('linkedin_auth_interactions').update({
        metadata,
        user_response: null,
        status: interaction.status === 'pending' ? 'expired' : interaction.status,
      }).eq('id', interaction.id);
    }
    await this.updateAccount(accountId, { browserbase_session_id: null, browser_connected_at: null });
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

    if (error) { logger.error('Failed to save session', { error: error.message }); return null; }
    const sid = data as unknown as string;
    logger.info('Session saved', { session_id: sid, browser_version: session.browserVersion, fingerprint: !!session.fingerprint });
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

  private async validateSessionForAutomation(accountId: string): Promise<{ valid: boolean; session: SessionData; sessionId: string } | null> {
    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) return null;

    const { session, sessionId } = loaded;

    try {
      await this.linkedin.launch(undefined);
      await this.linkedin.newContext();
      const restored = await this.linkedin.restoreSession(session);
      if (!restored) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: 'Session restore failed during validation' });
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: 'Session expired during validation' });
        logger.warn('Session validation failed: restore failed', { account_id: accountId });
        return null;
      }

      const intendedIdentity = await this.loadIntendedIdentity(accountId);
      const validation = await this.linkedin.validateSession(intendedIdentity);
      if (!validation.valid) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: validation.reason });
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: validation.reason || 'Session validation failed' });
        logger.warn('Session validation failed', { account_id: accountId, reason: validation.reason });
        return null;
      }

      // Session is valid — update health
      await this.client.rpc('update_session_health', {
        p_session_id: sessionId,
        p_health_status: 'healthy',
        p_connection_state: 'active',
      });
      await this.updateAccount(accountId, { connection_state: 'connected', last_validated_at: new Date().toISOString(), last_error: null });
      logger.info('Session validated successfully', { account_id: accountId, session_id: sessionId });
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

      logger.info('Session refreshed after automation', { session_id: sessionId });
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
            await this.updateAccount(accountId, { connection_state: 'session_invalid', health_status: 'expired', last_error: 'No active session found' });
            continue;
          }

          // Decryption proves storage integrity only. It must never promote a
          // LinkedIn session to healthy without a real browser validation.
        } catch (err) {
          logger.error('Health check failed for account', { account_id: accountId, error: String(err) });
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
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: 'Session expired during recovery' });
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
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: validation.reason || 'Validation failed' });
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

type ReplyClassification = 'positive' | 'interested' | 'neutral' | 'objection' | 'not_interested' | 'wrong_person' | 'do_not_contact' | 'unknown';

function classifyLinkedInReply(body: string): { classification: ReplyClassification; confidence: number } {
  const text = body.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\b(do not contact|don't contact|stop messaging|remove me|unsubscribe)\b/.test(text)) return { classification: 'do_not_contact', confidence: 0.98 };
  if (/\b(not interested|no interest|not a fit|no thanks|please don't)\b/.test(text)) return { classification: 'not_interested', confidence: 0.95 };
  if (/\b(wrong person|not the right person|speak to|contact .* instead)\b/.test(text)) return { classification: 'wrong_person', confidence: 0.9 };
  if (/\b(too expensive|already use|not now|concern|however|but we)\b/.test(text)) return { classification: 'objection', confidence: 0.8 };
  if (/\b(interested|tell me more|more information|send details|learn more)\b/.test(text)) return { classification: 'interested', confidence: 0.9 };
  if (/\b(yes|sounds good|let's talk|book|schedule|available|happy to chat)\b/.test(text)) return { classification: 'positive', confidence: 0.85 };
  if (/\b(thanks|thank you|received|okay|ok)\b/.test(text)) return { classification: 'neutral', confidence: 0.7 };
  return { classification: 'unknown', confidence: 0 };
}
