import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { Queue, QueueItem } from './queue.js';
import { LinkedInBrowser, SessionData, ProgressStep, ProgressCallback } from './linkedin.js';
import { encrypt, decrypt, getKeyId } from './session.js';
import { browserbase, BrowserbaseError } from './browserbase.js';

const CONNECTION_TIMEOUT = parseInt(process.env.CONNECTION_TIMEOUT_MS || '600000', 10);
const TEST_CONNECTION_TIMEOUT = parseInt(process.env.TEST_CONNECTION_TIMEOUT_MS || '120000', 10);
const HEARTBEAT_INTERVAL = parseInt(process.env.WORKER_HEARTBEAT_INTERVAL || '15000', 10);
const POLL_INTERVAL = parseInt(process.env.QUEUE_POLL_INTERVAL || '3000', 10);
const SESSION_HEARTBEAT_INTERVAL = parseInt(process.env.SESSION_HEARTBEAT_INTERVAL_MS || '120000', 10);

export class Worker {
  private client: SupabaseClient;
  private workerId: string;
  private workerName: string;
  private region: string;
  private encryptionSecret: string;
  private queue: Queue;
  private linkedin: LinkedInBrowser;
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentTaskId: string | null = null;
  private workspaceId: string | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encKey = process.env.LINKEDIN_SESSION_ENCRYPTION_KEY;

    if (!supabaseUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    if (!encKey) throw new Error('Missing LINKEDIN_SESSION_ENCRYPTION_KEY — generate with: openssl rand -base64 32');

    this.client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    this.workerId = process.env.WORKER_ID || crypto.randomUUID();
    this.workerName = `linkedin-worker-${this.workerId}`;
    this.region = process.env.WORKER_REGION || 'local';
    this.encryptionSecret = encKey;

    this.queue = new Queue(this.client, this.workerId, POLL_INTERVAL);
    this.linkedin = new LinkedInBrowser(this.client, true, this.encryptionSecret);
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
      BROWSERBASE_API_KEY_set: !!process.env.BROWSERBASE_API_KEY,
      BROWSERBASE_PROJECT_ID_set: !!process.env.BROWSERBASE_PROJECT_ID,
      WORKER_ID: this.workerId,
      WORKER_PORT: process.env.WORKER_PORT || '3100',
      POLL_INTERVAL: POLL_INTERVAL,
      HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
      CONNECTION_TIMEOUT: CONNECTION_TIMEOUT,
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

    // Get a workspace ID for worker registration
    const { data: wsId, error: wsError } = await this.client.rpc('get_any_workspace_id');
    if (wsError || !wsId) throw new Error('No workspaces available for worker registration');
    this.workspaceId = wsId as string;

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

    // Register in browser_workers table
    await this.register();

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
    const now = new Date().toISOString();
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

  private async heartbeat(): Promise<void> {
    const now = new Date().toISOString();
    try {
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
        logger.info(`Poll #${pollCount}: calling claimNext()`, { worker_id: this.workerId });
        const item = await this.queue.claimNext();
        if (item) {
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
      switch (item.action_type) {
        case 'linkedin_connect':
          await this.handleConnect(item, startTime);
          break;
        case 'linkedin_test_connection':
          await this.handleTestConnection(item, startTime);
          break;
        case 'profile_visit':
        case 'connection_request':
        case 'send_message':
        case 'follow_up_message':
        case 'like_post':
        case 'follow_company':
        case 'endorse_skills':
        case 'search_people':
        case 'read_inbox':
        case 'read_replies':
          await this.handleAutomationAction(item, startTime);
          break;
        default:
          logger.warn('Unknown action type', { action: item.action_type });
          await this.queue.fail(item.id, `Unknown action type: ${item.action_type}`, Date.now() - startTime, false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isBbError = err instanceof BrowserbaseError;
      const isRetryable = isBbError && (err as BrowserbaseError).statusCode !== 401;
      logger.error('Task processing error', { id: item.id, error: msg, browserbase_error: isBbError, retryable: isRetryable });
      await this.queue.fail(item.id, msg, Date.now() - startTime, isRetryable);
    }
  }

  // ── Progress Helper ─────────────────────────────────────────

  private makeProgressCallback(workspaceId: string, accountId: string, queueItemId: string): ProgressCallback {
    return async (step: ProgressStep, message: string, metadata?: Record<string, unknown>) => {
      logger.info('Progress', { step, message, account_id: accountId });
      try {
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

  private async handleConnect(item: QueueItem, startTime: number): Promise<void> {
    const workspaceId = item.workspace_id;
    const accountId = item.account_id;
    if (!accountId) {
      logger.error('handleConnect: missing account_id', { queue_item_id: item.id });
      await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false);
      return;
    }

    const onProgress = this.makeProgressCallback(workspaceId, accountId, item.id);

    // STATE: authenticating (transition from IDLE)
    await this.updateAccount(accountId, { connection_state: 'authenticating', last_error: null, browserbase_session_id: null, browser_connected_at: null });
    await this.logSessionEvent(workspaceId, accountId, 'created', { action: 'linkedin_connect' });

    // ── Try session reuse first ──────────────────────────────────
    const existingSession = await this.loadSessionForAccount(accountId);
    if (existingSession) {
      logger.info('Found existing session, attempting reuse', { account_id: accountId });
      await onProgress('creating_session', 'Existing session found. Attempting to restore...');

      try {
        await this.linkedin.launch(onProgress);
        const reuseResult = await this.linkedin.connectWithSession(existingSession.session, TEST_CONNECTION_TIMEOUT, onProgress);

        if (reuseResult.success) {
          await this.updateAccount(accountId, {
            connection_state: 'connected', session_status: 'connected', status: 'active',
            last_validated_at: new Date().toISOString(), last_login_at: new Date().toISOString(), last_error: null,
            profile_url: reuseResult.identity?.profileUrl, profile_name: reuseResult.identity?.profileName,
            profile_headline: reuseResult.identity?.profileHeadline,
          });
          await this.logSessionEvent(workspaceId, accountId, 'login_success', {
            profile_url: reuseResult.identity?.profileUrl, profile_name: reuseResult.identity?.profileName, reused: true,
          });
          await this.linkedin.close();
          await this.queue.complete(item.id, {
            connected: true, reused: true, identity: reuseResult.identity, duration_ms: Date.now() - startTime,
          }, Date.now() - startTime);
          logger.info('LinkedIn account connected via session reuse', { account_id: accountId });
          return;
        }

        logger.info('Session reuse failed, proceeding to fresh login', { account_id: accountId });
        await onProgress('creating_session', 'Previous session expired. Starting fresh login...');
        await this.linkedin.close();
      } catch (err) {
        logger.warn('Session reuse error, proceeding to fresh login', { error: String(err) });
        await this.linkedin.close().catch(() => {});
      }
    }

    // ── Fresh login flow: strict state machine ───────────────────
    // STATE: CREATING_SESSION + CONNECTING_BROWSER (handled inside launch)
    logger.info('handleConnect: starting fresh login flow', { account_id: accountId });

    try {
      await this.linkedin.launch(onProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('handleConnect: launch failed', { error: msg });
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: `Browser launch failed: ${msg}` });
      await onProgress('login_failed', `Browser launch failed: ${msg}`);
      await this.queue.fail(item.id, `Browser launch failed: ${msg}`, Date.now() - startTime, false);
      return;
    }

    // ── Verify: Browserbase session exists ──────────────────────
    const bbSessionId = this.linkedin.getSessionId();
    const liveUrl = this.linkedin.getLiveUrl();
    logger.info('handleConnect: Browserbase session ready', { account_id: accountId, bbSessionId, liveUrl });

    if (!bbSessionId && browserbase.isConfigured()) {
      const msg = 'No Browserbase session ID after launch';
      logger.error('handleConnect: verification failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: msg });
      await onProgress('login_failed', msg);
      await this.queue.fail(item.id, msg, Date.now() - startTime, false);
      return;
    }

    // Store session ID + live URL in DB immediately so frontend can show "Open Browser"
    await this.updateAccount(accountId, {
      browserbase_session_id: bbSessionId,
      browser_connected_at: new Date().toISOString(),
    });

    await onProgress('browser_connected', 'Secure browser ready. Complete LinkedIn sign-in in the browser window.', {
      browserbase_session_id: bbSessionId,
      browserbase_live_url: liveUrl,
    });

    // ── Create browser context ──────────────────────────────────
    try {
      await this.linkedin.newContext();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('handleConnect: context creation failed', { error: msg });
      await this.linkedin.close();
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: `Context creation failed: ${msg}` });
      await onProgress('login_failed', `Context creation failed: ${msg}`);
      await this.queue.fail(item.id, `Context creation failed: ${msg}`, Date.now() - startTime, false);
      return;
    }

    // ── Connect: open LinkedIn → wait for auth → verify → save ──
    logger.info('handleConnect: calling linkedin.connect()', { account_id: accountId, timeout: CONNECTION_TIMEOUT });
    const result = await this.linkedin.connect(
      CONNECTION_TIMEOUT,
      onProgress,
      workspaceId,
      accountId,
      item.id,
    );

    logger.info('handleConnect: linkedin.connect() returned', { account_id: accountId, success: result.success, requiresAction: result.requiresAction, error: result.error });

    if (!result.success) {
      await this.linkedin.close();

      const isNonRetryable = (result as { nonRetryable?: boolean }).nonRetryable === true;

      if (result.requiresAction) {
        await this.updateAccount(accountId, {
          connection_state: 'requires_action',
          last_error: result.error || 'LinkedIn verification required',
        });
        await this.logSessionEvent(workspaceId, accountId, 'login_failed', { error: result.error, challenge: result.challengeType });

        await this.client.rpc('insert_auth_interaction', {
          p_workspace_id: workspaceId,
          p_account_id: accountId,
          p_queue_item_id: item.id,
          p_interaction_type: 'challenge',
          p_step: 'challenge_detected',
          p_message: result.error || 'LinkedIn verification required',
          p_status: 'pending',
          p_metadata: { queue_item_id: item.id },
          p_challenge_type: result.challengeType,
          p_challenge_description: result.error,
        });

        await this.client.rpc('set_queue_item_waiting', { p_queue_item_id: item.id });
        logger.warn('Challenge detected, queue item set to waiting', { account_id: accountId, challenge: result.challengeType });
        return;
      }

      await this.updateAccount(accountId, { connection_state: 'failed', status: 'failed', session_status: 'disconnected', last_error: result.error || 'Connection failed' });
      await this.logSessionEvent(workspaceId, accountId, 'login_failed', { error: result.error });
      await this.queue.fail(item.id, result.error || 'Connection failed', Date.now() - startTime, !isNonRetryable);
      return;
    }

    // ── Save encrypted session ──────────────────────────────────
    await onProgress('saving_session', 'Login successful. Encrypting and saving session...');

    const sessionId = await this.saveSession(workspaceId, accountId, result.session!);
    if (!sessionId) {
      await this.linkedin.close();
      await this.updateAccount(accountId, { connection_state: 'failed', last_error: 'Session save failed — cookies were not persisted' });
      await this.queue.fail(item.id, 'Session save failed', Date.now() - startTime, true);
      return;
    }

    await this.client.rpc('insert_auth_interaction', {
      p_workspace_id: workspaceId,
      p_account_id: accountId,
      p_queue_item_id: item.id,
      p_interaction_type: 'session_saved',
      p_step: 'saving_session',
      p_message: 'Session encrypted and saved successfully.',
      p_status: 'completed',
      p_metadata: { session_id: sessionId },
    });

    // STATE: AUTHENTICATED — only after session is saved AND verified
    await this.updateAccount(accountId, {
      connection_state: 'connected', session_status: 'connected', status: 'active',
      last_validated_at: new Date().toISOString(), last_login_at: new Date().toISOString(), last_error: null,
      profile_url: result.identity?.profileUrl, profile_name: result.identity?.profileName,
      profile_headline: result.identity?.profileHeadline,
    });

    await this.logSessionEvent(workspaceId, accountId, 'login_success', {
      profile_url: result.identity?.profileUrl, profile_name: result.identity?.profileName,
    });
    await this.logSessionEvent(workspaceId, accountId, 'validated', { session_id: sessionId });

    await onProgress('connected', 'LinkedIn connected successfully. Session encrypted and verified.');

    await this.linkedin.close();

    await this.queue.complete(item.id, {
      connected: true, session_id: sessionId, identity: result.identity,
      duration_ms: Date.now() - startTime,
    }, Date.now() - startTime);

    logger.info('LinkedIn account connected', { account_id: accountId, session_id: sessionId });
  }

  // ── Test Connection Handler ────────────────────────────────

  private async handleTestConnection(item: QueueItem, startTime: number): Promise<void> {
    const accountId = item.account_id;
    if (!accountId) { await this.queue.fail(item.id, 'Missing account_id', Date.now() - startTime, false); return; }

    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) {
      await this.updateAccount(accountId, { connection_state: 'session_invalid', last_error: 'No active session found' });
      await this.queue.fail(item.id, 'No active session found', Date.now() - startTime, false);
      return;
    }

    await this.linkedin.launch(undefined);
    const result = await this.linkedin.testConnection(loaded.session, TEST_CONNECTION_TIMEOUT);
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

    const loaded = await this.loadSessionForAccount(accountId);
    if (!loaded) {
      await this.updateAccount(accountId, { connection_state: 'session_invalid', last_error: 'No active session for automation' });
      await this.queue.fail(item.id, 'No active session — account must be connected first', Date.now() - startTime, false);
      return;
    }

    const { session: sessionData, sessionId } = loaded;
    const params = item.action_params ?? {};
    let result: { success: boolean; data?: Record<string, unknown>; error?: string };

    try {
      await this.linkedin.launch(undefined);
      await this.linkedin.newContext();
      const restored = await this.linkedin.restoreSession(sessionData);
      if (!restored) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: 'Session restore failed during automation' });
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: 'Session expired during automation' });
        await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
        return;
      }

      // Validate session before automation
      const validation = await this.linkedin.validateSession();
      if (!validation.valid) {
        await this.linkedin.close();
        await this.client.rpc('expire_session', { p_session_id: sessionId, p_reason: validation.reason });
        await this.updateAccount(accountId, { connection_state: 'session_expired', last_error: validation.reason || 'Session validation failed' });
        await this.queue.fail(item.id, 'Session expired — reconnect required', Date.now() - startTime, true);
        return;
      }

      const page = this.linkedin.getPage();

      switch (item.action_type) {
        case 'profile_visit': {
          const url = params.profile_url as string;
          if (!url) throw new Error('profile_url required');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000 + Math.random() * 3000);
          result = { success: true, data: { visited: url } };
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
            if (addNoteBtn) {
              await addNoteBtn.click();
              await page.waitForTimeout(500);
              const noteInput = await page.$('#custom-message');
              if (noteInput) { await noteInput.fill(note); await page.waitForTimeout(300); }
              const sendBtn = await page.$('button:has-text("Send")');
              if (sendBtn) await sendBtn.click();
            }
          } else {
            const sendBtn = await page.$('button:has-text("Send without note")');
            if (sendBtn) await sendBtn.click();
          }
          await page.waitForTimeout(2000);
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
          if (submitBtn) await submitBtn.click();
          await page.waitForTimeout(2000);
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
          const messages = await page.$$eval('div.msg-s-message-list__event', (els) =>
            els.map((el) => ({
              sender: el.querySelector('span.msg-s-message-group__name')?.textContent?.trim() ?? null,
              body: el.querySelector('p.msg-s-event-listitem__body')?.textContent?.trim() ?? null,
              timestamp: el.querySelector('time')?.getAttribute('datetime') ?? null,
            }))
          ).catch(() => [] as Array<{ sender: string | null; body: string | null; timestamp: string | null }>);
          result = { success: true, data: { messages, count: messages.length } };
          break;
        }
        default:
          result = { success: false, error: `Unhandled automation action: ${item.action_type}` };
      }

      // Auto-refresh session data after automation
      if (result.success) {
        await this.refreshSessionAfterAutomation(sessionId);
      }
      await this.linkedin.close();

      if (result.success) {
        await this.updateAccount(accountId, { last_activity_at: new Date().toISOString() });
        await this.logSessionEvent(item.workspace_id, accountId, `automation_${item.action_type}`, result.data ?? {});
        await this.queue.complete(item.id, result.data ?? { success: true }, Date.now() - startTime);
      } else {
        await this.queue.fail(item.id, result.error || 'Automation action failed', Date.now() - startTime, true);
      }
    } catch (err) {
      await this.linkedin.close().catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Automation action error', { action: item.action_type, error: msg });
      await this.queue.fail(item.id, msg, Date.now() - startTime, true);
    }
  }

  // ── RPC Helpers ────────────────────────────────────────────

  private async updateAccount(accountId: string, updates: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.rpc('update_linkedin_account_state', {
      p_account_id: accountId,
      p_updates: updates,
    });
    if (error) logger.error('Failed to update account', { account_id: accountId, error: error.message });
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

      const validation = await this.linkedin.validateSession();
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

          // Lightweight check: just verify the session row health status
          // Full browser-based validation happens on automation or test_connection
          const { sessionId } = loaded;
          await this.client.rpc('update_session_health', {
            p_session_id: sessionId,
            p_health_status: 'healthy',
            p_connection_state: 'active',
          });
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
      const validation = await this.linkedin.validateSession();
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
