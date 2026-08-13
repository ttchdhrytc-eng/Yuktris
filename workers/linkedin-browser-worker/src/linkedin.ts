import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { browserbase, BrowserbaseError, BrowserbaseSession, CreateSessionOptions } from './browserbase.js';

const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';
const LINKEDIN_FEED_URL = 'https://www.linkedin.com/feed';
const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/me';

const CDP_CONNECT_TIMEOUT_MS = 30000;
const PAGE_LOAD_TIMEOUT_MS = 30000;
const AUTH_SIGNAL_TIMEOUT_MS = 5000;
const TRANSIENT_RETRY_LIMIT = 2;
const TRANSIENT_RETRY_DELAY_MS = 1500;
// Normal sign-in remains bounded by CONNECTION_TIMEOUT_MS. A verified human
// challenge may extend that window, but never beyond the absolute lifetime.
const HUMAN_CHALLENGE_EXTENSION_MS = 20 * 60 * 1000;
const MAX_AUTH_ATTEMPT_LIFETIME_MS = 30 * 60 * 1000;
const CHALLENGE_DISAPPEAR_GRACE_MS = 10 * 1000;
const IDENTITY_RESOLUTION_ATTEMPTS = 4;
const IDENTITY_RESOLUTION_DELAY_MS = 2000;
const IDENTITY_NAVIGATION_TIMEOUT_MS = 10000;
const FAST_REUSE_IDENTITY_TIMEOUT_MS = 2500;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type LinkedInAuthenticationState =
  | 'authenticated'
  | 'unauthenticated'
  | 'checkpoint'
  | 'login_in_progress'
  | 'unknown';

export interface AuthenticationAssessment {
  state: LinkedInAuthenticationState;
  confidence: 'high' | 'medium' | 'low';
  url: string;
  signals: string[];
}

export interface AuthenticationSignals {
  isCheckpoint: boolean;
  isLogin: boolean;
  isAuthenticatedRoute: boolean;
  loginForm: boolean;
  checkpointControl: boolean;
  globalNav: boolean;
  meControl: boolean;
  feedContent: boolean;
  hasSessionCookie: boolean;
}

export function classifyLinkedInAuthentication(signals: AuthenticationSignals): Pick<AuthenticationAssessment, 'state' | 'confidence'> {
  if (signals.isCheckpoint || signals.checkpointControl) return { state: 'checkpoint', confidence: 'high' };
  if (signals.loginForm && !signals.globalNav) {
    return { state: signals.isLogin ? 'unauthenticated' : 'login_in_progress', confidence: 'high' };
  }
  const strongUiSignal = signals.globalNav && signals.meControl;
  const contentSignal = signals.globalNav && signals.feedContent;
  // A LinkedIn session cookie plus an authenticated product route is strong
  // evidence even when LinkedIn's frequently-changing feed DOM lacks legacy
  // navigation selectors. A route alone is never sufficient.
  if (signals.hasSessionCookie && (signals.isAuthenticatedRoute || strongUiSignal || contentSignal)) {
    return { state: 'authenticated', confidence: 'high' };
  }
  if ((strongUiSignal || contentSignal) && !signals.isLogin) return { state: 'authenticated', confidence: 'medium' };
  if (signals.isLogin && signals.hasSessionCookie) return { state: 'login_in_progress', confidence: 'medium' };
  if (signals.isLogin) return { state: 'unauthenticated', confidence: 'medium' };
  return { state: 'unknown', confidence: 'low' };
}

export interface IntendedLinkedInIdentity {
  profileUrl?: string | null;
  profileName?: string | null;
  linkedinEmail?: string | null;
}

type LoginFlowState = 'idle' | 'opening_browser' | 'waiting_for_login' | 'challenge_detected' | 'waiting_for_user' | 'verifying_authentication' | 'verifying_identity' | 'capturing_session' | 'connected' | 'failed' | 'cancelled';

export interface LinkedInIdentity {
  profileUrl: string | null;
  profileName: string | null;
  profileHeadline: string | null;
}

export interface BrowserFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  hardwareConcurrency: number;
}

export interface SessionData {
  cookies: unknown[];
  storageState: Record<string, unknown>;
  localStorage: Record<string, unknown>;
  sessionStorage: Record<string, unknown>;
  userAgent: string;
  viewport: { width: number; height: number };
  timezone: string | null;
  language: string | null;
  browserVersion: string | null;
  playwrightVersion: string | null;
  fingerprint: BrowserFingerprint | null;
}

export interface ConnectionResult {
  success: boolean;
  identity?: LinkedInIdentity;
  session?: SessionData;
  error?: string;
  requiresAction?: boolean;
  challengeType?: string;
  authState?: LinkedInAuthenticationState;
  nonRetryable?: boolean;
  retryable?: boolean;
  cancelled?: boolean;
  identityVerifiedAt?: number;
  stateCapturedAt?: number;
  authenticationDetectedAt?: number;
  errorCode?: string;
  identityState?: 'verified' | 'unresolved' | 'mismatch';
  reuseExistingBrowser?: boolean;
  preserveCurrentPage?: boolean;
  effectiveProfileUrl?: string;
  reuseBoundIdentity?: boolean;
}

export type ProgressStep =
  | 'creating_session'
  | 'session_created'
  | 'connecting_browser'
  | 'browser_connected'
  | 'checking_existing_session'
  | 'existing_session_authenticated'
  | 'auth_required'
  | 'auth_surface_ready'
  | 'live_view_disconnected'
  | 'recovering_auth_surface'
  | 'connection_failed'
  | 'opening_linkedin'
  | 'ready_for_login'
  | 'waiting_for_login'
  | 'challenge_detected'
  | 'human_challenge_required'
  | 'provider_rechallenge'
  | 'invalid_credentials'
  | 'waiting_for_user'
  | 'verifying_authentication'
  | 'identity_resolution_pending'
  | 'identity_verified'
  | 'saving_session'
  | 'finalizing_connection'
  | 'connected'
  | 'login_timeout'
  | 'login_failed';

export interface ProgressCallback {
  (step: ProgressStep, message: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface ChallengeInfo {
  type: 'email_otp' | 'captcha' | 'two_factor' | 'phone_verification';
  description: string;
}

export interface ExistingSessionCheck {
  result: ConnectionResult | null;
  authRequired: boolean;
  preserveCurrentPage: boolean;
}

export class LinkedInBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private encryptionSecret: string;
  private client: SupabaseClient;
  private bbSession: BrowserbaseSession | null = null;
  private cancellationReason: string | null = null;

  constructor(client: SupabaseClient, _headless: boolean, encryptionSecret: string) {
    this.client = client;
    this.encryptionSecret = encryptionSecret;
  }

  getLiveUrl(): string | null {
    return this.bbSession?.liveUrl || null;
  }

  getSessionId(): string | null {
    return this.bbSession?.id || null;
  }

  async refreshLiveUrl(): Promise<string | null> {
    if (!this.bbSession?.id) return null;
    try {
      const liveUrls = await browserbase.getLiveUrls(this.bbSession.id);
      if (liveUrls.debuggerFullscreenUrl) {
        this.bbSession.liveUrl = liveUrls.debuggerFullscreenUrl;
        logger.info('Live URL refreshed from Browserbase /debug', {
          sessionId: this.bbSession.id,
          pageCount: liveUrls.pages.length,
        });
        return this.bbSession.liveUrl;
      }
    } catch (err) {
      logger.warn('Failed to refresh live URL', { error: String(err) });
    }
    return null;
  }

  // ── LAUNCH: Create Browserbase session + attach Playwright ────

  async launch(onProgress?: ProgressCallback, sessionOptions: CreateSessionOptions = { keepAlive: true }): Promise<void> {
    this.cancellationReason = null;
    const useBrowserbase = browserbase.isConfigured();

    if (!useBrowserbase) {
      // Fix 4: Auto-detect — no Browserbase config, use local Chromium automatically
      logger.info('Browserbase not configured, using local Chromium automatically');
      await this.launchLocalChromium();
      return;
    }

    // Try Browserbase, fall back to local Chromium on ANY failure (Fix 5)
    try {
      if (onProgress) await onProgress('creating_session', 'Creating secure browser session...');
      logger.info('Creating Browserbase session');

      this.bbSession = await browserbase.createSession(sessionOptions);

      if (!this.bbSession?.id) {
        throw new Error('Browserbase session creation returned no session ID');
      }

      logger.info('Browserbase session created', { id: this.bbSession.id });
      if (onProgress) await onProgress('session_created', 'Browser session created. Attaching Playwright...', {
        browserbase_session_id: this.bbSession.id,
        browserbase_live_url: this.bbSession.liveUrl,
      });

      if (onProgress) await onProgress('connecting_browser', 'Attaching Playwright to browser session...');
      logger.info('Connecting via CDP');

      try {
        this.browser = await withTimeout(
          chromium.connectOverCDP(this.bbSession.wsUrl),
          CDP_CONNECT_TIMEOUT_MS,
          `CDP connection timed out after ${CDP_CONNECT_TIMEOUT_MS}ms`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Browserbase CDP connection failed', { error: this.sanitizeError(msg) });
        await browserbase.endSession(this.bbSession.id).catch(() => {});
        this.bbSession = null;
        if (!sessionOptions.requirePersistentContext && this.localFallbackEnabled()) {
          await this.launchLocalChromium();
          return;
        }
        throw new Error('Unable to attach to the secure Browserbase session');
      }

      if (!this.browser) {
        await browserbase.endSession(this.bbSession.id).catch(() => {});
        this.bbSession = null;
        throw new Error('Playwright attach succeeded but browser object is null');
      }

      try {
        const version = this.browser.version();
        logger.info('Browserbase browser attached', { version });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Browserbase browser verification failed', { error: this.sanitizeError(msg) });
        await browserbase.endSession(this.bbSession.id).catch(() => {});
        this.bbSession = null;
        if (!sessionOptions.requirePersistentContext && this.localFallbackEnabled()) {
          await this.launchLocalChromium();
          return;
        }
        throw new Error('Secure Browserbase session could not be verified');
      }

      if (onProgress) await onProgress('browser_connected', 'Playwright attached to browser. Creating context...');
    } catch (err) {
      // Fix 5: Any Browserbase failure (401, 402, 403, 429, timeout, network) → local Chromium
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Browserbase launch failed', { error: this.sanitizeError(msg) });
      this.bbSession = null;
      if (!sessionOptions.requirePersistentContext && this.localFallbackEnabled()) {
        await this.launchLocalChromium();
        return;
      }
      const status = err instanceof BrowserbaseError ? err.statusCode : 503;
      throw new BrowserbaseError('Secure browser provider is unavailable', status);
    }
  }

  /** Reconcile the two independent browser transports without creating a session or Context. */
  async recoverAuthSurface(onProgress?: ProgressCallback): Promise<{ liveUrl: string } | { errorCode: string; error: string }> {
    const session = this.bbSession;
    if (!session) return { errorCode: 'browserbase_session_terminated', error: 'The secure browser session is no longer available.' };
    await onProgress?.('recovering_auth_surface', 'Reconnecting the secure LinkedIn sign-in window.', { lifecycle_stage: 'L6_provider_session_state_checked' });
    const providerState = await browserbase.getSessionStatus(session.id);
    logger.info('Browserbase auth surface recovery', { lifecycle_stage: 'L6_provider_session_state_checked', provider_state: providerState });
    if (providerState !== 'running') {
      const errorCode = providerState === 'unknown' ? 'browserbase_reattach_failed' : 'browserbase_session_terminated';
      return { errorCode, error: 'The secure browser session ended. Please retry the connection.' };
    }

    if (!this.browser?.isConnected()) {
      logger.info('Browserbase auth surface recovery', { lifecycle_stage: 'L7_reattach_attempted', transport: 'playwright_cdp' });
      try {
        this.browser = await withTimeout(chromium.connectOverCDP(session.wsUrl), CDP_CONNECT_TIMEOUT_MS, 'CDP reattach timed out');
        const contexts = this.browser.contexts();
        this.context = contexts.find(context => context.pages().some(page => this.isUsablePage(page) && this.isLinkedInUrl(page.url()))) ?? contexts[0] ?? null;
        this.page = this.context ? this.selectBestPage(this.context.pages()) : null;
        if (!this.context || !this.page) throw new Error('The existing browser page could not be recovered');
      } catch (error) {
        logger.warn('Browserbase CDP reattach failed', { lifecycle_stage: 'L8_reattach_failed', error: this.sanitizeError(error) });
        return { errorCode: 'browserbase_reattach_failed', error: 'The secure browser could not be reconnected. Please retry.' };
      }
    }

    logger.info('Browserbase auth surface recovery', { lifecycle_stage: 'L7_debugger_authorization_requested' });
    const liveUrl = await this.refreshLiveUrl();
    if (!liveUrl) return { errorCode: 'browserbase_live_view_failed', error: 'A secure sign-in window could not be authorized. Please retry.' };
    logger.info('Browserbase auth surface recovery', { lifecycle_stage: 'L8_reattach_succeeded' });
    await onProgress?.('auth_surface_ready', 'Secure LinkedIn sign-in is ready.', {
      lifecycle_stage: 'L8_reattach_succeeded', browserbase_session_id: session.id, browserbase_live_url: liveUrl,
    });
    return { liveUrl };
  }

  cancel(reason = 'Operation cancelled'): void {
    this.cancellationReason = reason;
  }

  private localFallbackEnabled(): boolean {
    return process.env.PLAYWRIGHT_LOCAL_FALLBACK === 'true';
  }

  private async launchLocalChromium(): Promise<void> {
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;
    this.browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    logger.info('Local Chromium launched', { version: this.browser.version() });
  }

  // ── NEW CONTEXT: Create browser context + page ─────────────────

  async newContext(): Promise<BrowserContext> {
    if (!this.browser) throw new Error('Browser not launched — call launch() first');

    if (this.bbSession) {
      // Browserbase owns the default context. Reuse it, but never assume pages[0]
      // is the application page: provider tooling and LinkedIn can open extra tabs.
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        this.context = contexts.find(context => context.pages().some(page => this.isUsablePage(page) && this.isLinkedInUrl(page.url())))
          ?? contexts.find(context => context.pages().some(page => this.isUsablePage(page)))
          ?? contexts[0];
        this.page = this.selectBestPage(this.context.pages());
        if (!this.page) {
          this.page = await this.context.newPage();
          logger.info('Created new page in Browserbase default context');
        } else {
          logger.info('Reusing Browserbase context with selected page', {
            contextCount: contexts.length,
            pageCount: this.context.pages().filter(page => !page.isClosed()).length,
            selectedHost: this.safeHostname(this.page.url()),
          });
        }
      } else {
        this.context = await this.browser.newContext({
          viewport: { width: 1440, height: 900 },
          locale: 'en-US',
          timezoneId: 'America/New_York',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        });
        this.page = await this.context.newPage();
        logger.info('Created new context + page for Browserbase (no default context found)');
      }
      await this.page.bringToFront().catch(() => {});
    } else {
      this.context = await this.browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
      this.page = await this.context.newPage();
      logger.info('Browser context + page created (local Chromium)');
    }
    return this.context;
  }

  private isUsablePage(page: Page): boolean {
    return !page.isClosed();
  }

  private isLinkedInUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
    } catch {
      return false;
    }
  }

  private safeHostname(url: string): string {
    try { return new URL(url).hostname; } catch { return 'non-http'; }
  }

  private safeOrigin(url: string): string {
    try { return new URL(url).origin; } catch { return 'non-http'; }
  }

  private safePathname(url: string): string {
    try { return new URL(url).pathname; } catch { return ''; }
  }

  private selectBestPage(pages: Page[]): Page | null {
    const livePages = pages.filter(page => this.isUsablePage(page));
    if (livePages.length === 0) return null;

    const score = (page: Page): number => {
      const url = page.url();
      if (this.isLinkedInUrl(url)) {
        if (url.includes('/feed') || url.includes('/mynetwork') || url.includes('/notifications') || url.includes('/messaging')) return 110;
        if (url.includes('/checkpoint') || url.includes('/challenge')) return 100;
        if (url.includes('/login') || url.includes('/uas/')) return 80;
        return 70;
      }
      return url === 'about:blank' ? 0 : 10;
    };

    return [...livePages].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  private async ensureActivePage(preferLinkedIn = true, focusSelectedPage = true): Promise<Page> {
    if (!this.browser) throw new Error('Browser is not available');
    const allPages = this.browser.contexts().flatMap(context => context.pages()).filter(page => this.isUsablePage(page));
    const linkedInPages = allPages.filter(page => this.isLinkedInUrl(page.url()));
    const selected = this.selectBestPage(preferLinkedIn && linkedInPages.length > 0 ? linkedInPages : allPages);

    if (selected) {
      this.context = selected.context();
      this.page = selected;
      if (focusSelectedPage) await selected.bringToFront().catch(() => {});
      return selected;
    }

    if (!this.context) {
      this.context = this.browser.contexts()[0] ?? await this.browser.newContext();
    }
    this.page = await this.context.newPage();
    return this.page;
  }

  async close(): Promise<void> {
    // keepAlive sessions survive CDP disconnects. Explicitly request release
    // before closing Playwright so Browserbase can begin Context persistence
    // immediately rather than waiting for the provider session timeout.
    if (this.bbSession) await browserbase.endSession(this.bbSession.id);
    if (this.page) { await this.page.close().catch(() => {}); this.page = null; }
    if (this.context) { await this.context.close().catch(() => {}); this.context = null; }
    if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null; }
    this.bbSession = null;
    logger.info('Browser closed');
  }

  getPage(): Page {
    if (!this.page || this.page.isClosed()) throw new Error('No active page available — call newContext() first');
    return this.page;
  }

  /** Remove authenticated LinkedIn content from the customer-visible page after state capture. */
  async neutralizeVisiblePage(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    await this.page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 }).catch((error) => {
      logger.warn('Could not neutralize the completed authentication page', { error: String(error) });
    });
  }

  // ── OPEN LINKEDIN: Navigate to login page + verify loaded ──────

  async openLinkedIn(onProgress?: ProgressCallback): Promise<void> {
    const page = await this.ensureActivePage(false);

    if (onProgress) await onProgress('opening_linkedin', 'Opening LinkedIn login page...');
    logger.info('OPENING LINKEDIN: Navigating to login page');

    // Log only counts/hosts. Full URLs can contain sensitive checkpoint parameters.
    if (this.browser) {
      const contexts = this.browser.contexts();
      logger.info('Browser state before LinkedIn navigation', {
        contextCount: contexts.length,
        contexts: contexts.map(c => ({
          pageCount: c.pages().length,
          pageHosts: c.pages().filter(p => !p.isClosed()).map(p => this.safeHostname(p.url())),
        })),
      });
    }

    // Ensure this page is the active tab in Browserbase Live View
    await page.bringToFront().catch(() => {});

    try {
      await this.navigateWithRetry(page, LINKEDIN_LOGIN_URL, PAGE_LOAD_TIMEOUT_MS);
    } catch (err) {
      const msg = this.sanitizeError(err);
      logger.error('OPENING LINKEDIN FAILED: Navigation failed', { error: msg });
      throw new Error(`Failed to open LinkedIn login page: ${msg}`);
    }

    // ── Verify page actually loaded ──────────────────────────────
    const url = page.url();
    logger.info('LinkedIn navigation completed', { host: this.safeHostname(url) });

    if (!url.includes('linkedin.com')) {
      throw new Error(`Page did not load LinkedIn — current URL: ${url}`);
    }

    // Wait for page to finish rendering before checking selectors
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const usernameSelectors = [
      'input[type=email]',
      'input[name=session_key]',
      'input[name=username]',
      'input[autocomplete=username]',
      'input[autocomplete=email]',
      'input[type=text]',
    ];
    const passwordSelectors = [
      'input[type=password]',
      'input[name=session_password]',
      'input[autocomplete=current-password]',
    ];

    let usernameFound = false;
    let passwordFound = false;

    // Use evaluate first — Playwright's waitForSelector has issues finding elements
    // on LinkedIn's login page due to CSP nonce restrictions on the selector engine
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(el => ({
        type: el.type, name: el.name || '', id: el.id || '',
      }));
    }).catch(() => [] as Array<{ type: string; name: string; id: string }>);

    if (Array.isArray(inputs) && inputs.length > 0) {
      logger.info('Inputs found via evaluate', { count: inputs.length, types: inputs.map(i => i.type) });
      usernameFound = inputs.some(i => i.type === 'email' || i.type === 'text');
      passwordFound = inputs.some(i => i.type === 'password');
    }

    // If evaluate didn't find inputs, try waitForSelector as fallback
    if (!usernameFound) {
      for (const sel of usernameSelectors) {
        try {
          const el = await page.waitForSelector(sel, { timeout: 3000 });
          if (el) { usernameFound = true; break; }
        } catch {
          // Try the next known LinkedIn username selector.
        }
      }
    }

    if (!passwordFound) {
      for (const sel of passwordSelectors) {
        try {
          const el = await page.waitForSelector(sel, { timeout: 3000 });
          if (el) { passwordFound = true; break; }
        } catch {
          // Try the next known LinkedIn password selector.
        }
      }
    }

    // Check if already authenticated
    if (!usernameFound && !passwordFound) {
      const assessment = await this.assessAuthentication();
      if (assessment.state === 'authenticated') {
        logger.info('Already authenticated', { host: this.safeHostname(assessment.url), confidence: assessment.confidence });
        if (onProgress) await onProgress('ready_for_login', 'Already logged in to LinkedIn.');
        return;
      }
    }

    if (usernameFound && passwordFound) {
      logger.info('Login form detected (username + password fields found)');
    } else if (usernameFound || passwordFound) {
      logger.info('Login form partially detected', { username: usernameFound, password: passwordFound });
    } else {
      throw new Error('LinkedIn login page loaded but no form elements found — page may not be interactive');
    }

    if (onProgress) await onProgress('ready_for_login', 'LinkedIn login page is ready. Complete your sign-in in the browser window.', {
      login_url: url,
      browserbase_session_id: this.bbSession?.id,
      browserbase_live_url: this.bbSession?.liveUrl,
    });
  }

  // ── CONNECTION FLOW: open LinkedIn → wait for auth → verify ────

  async connect(
    timeoutMs: number,
    onProgress?: ProgressCallback,
    workspaceId?: string,
    accountId?: string,
    queueItemId?: string,
    intendedIdentity?: IntendedLinkedInIdentity,
    preserveCurrentPage = false,
  ): Promise<ConnectionResult> {
    if (!this.page) throw new Error('No page — call newContext() first');
    let flowState: LoginFlowState = 'idle';
    const transition = (next: LoginFlowState): void => {
      const allowed: Record<LoginFlowState, LoginFlowState[]> = {
        idle: ['opening_browser', 'failed', 'cancelled'],
        opening_browser: ['waiting_for_login', 'failed', 'cancelled'],
        waiting_for_login: ['challenge_detected', 'verifying_authentication', 'failed', 'cancelled'],
        challenge_detected: ['waiting_for_user', 'failed', 'cancelled'],
        waiting_for_user: ['waiting_for_login', 'challenge_detected', 'verifying_authentication', 'failed', 'cancelled'],
        verifying_authentication: ['verifying_identity', 'failed', 'cancelled'],
        verifying_identity: ['capturing_session', 'failed'],
        capturing_session: ['connected', 'failed'],
        connected: [],
        failed: [],
        cancelled: [],
      };
      if (!allowed[flowState].includes(next)) throw new Error(`Invalid login transition ${flowState} -> ${next}`);
      logger.info('LinkedIn login state transition', { from: flowState, to: next });
      flowState = next;
    };

    try {
      // ── Open LinkedIn login page ────────────────────────────────
      transition('opening_browser');
      if (!preserveCurrentPage) await this.openLinkedIn(onProgress);

      // ── Refresh Live URL after navigation ───────────────────────
      // After page.goto() navigates to LinkedIn, fetch the updated debug URL
      // from Browserbase so the frontend's "Open Browser" button opens the
      // live debugger view showing the actual LinkedIn page, not about:blank.
      logger.info('LinkedIn auth lifecycle', { lifecycle_stage: 'L2_debugger_authorization_requested' });
      const refreshedLiveUrl = await this.refreshLiveUrl();
      if (refreshedLiveUrl && onProgress) {
        await onProgress('auth_surface_ready', 'Secure LinkedIn sign-in is ready.', {
          lifecycle_stage: 'L3_auth_surface_ready',
          browserbase_session_id: this.getSessionId(),
          browserbase_live_url: refreshedLiveUrl,
          login_url: LINKEDIN_LOGIN_URL,
        });
      }

      // ── Wait for authentication ────────────────────────────────
      transition('waiting_for_login');
      if (onProgress) await onProgress('waiting_for_login', 'Waiting for login. Complete LinkedIn sign-in in the browser window...');
      const authResult = await this.waitForAuthenticationWithChallenges(
        timeoutMs, onProgress, workspaceId, accountId, queueItemId,
        (state) => {
          if (state === 'challenge_detected' && (flowState === 'waiting_for_login' || flowState === 'waiting_for_user')) transition('challenge_detected');
          if (state === 'waiting_for_user' && flowState === 'challenge_detected') transition('waiting_for_user');
          if (state === 'waiting_for_login' && flowState === 'waiting_for_user') transition('waiting_for_login');
        },
      );

      if (authResult.cancelled) {
        transition('cancelled');
        return { success: false, cancelled: true, nonRetryable: true, error: 'LinkedIn connection was cancelled' };
      } else if (this.bbSession) {
        return { success: false, errorCode: 'browserbase_live_view_failed', error: 'A secure LinkedIn sign-in window could not be opened. Please retry.', retryable: true };
      }

      if (!authResult.authenticated) {
        transition('failed');
        if (authResult.failure) {
          return { success: false, error: authResult.failure, nonRetryable: true, challengeType: authResult.challenge?.type };
        }
        if (onProgress) await onProgress('login_timeout', 'LinkedIn authentication not completed within timeout.');
        const challengeSuffix = authResult.challenge ? ' Additional verification was not completed in the secure browser.' : '';
        return { success: false, error: `LinkedIn authentication not completed within timeout.${challengeSuffix}`, nonRetryable: true, challengeType: authResult.challenge?.type };
      }

      transition('verifying_authentication');
      if (onProgress) await onProgress('verifying_authentication', 'LinkedIn sign-in detected. Verifying authentication...');
      logger.info('Authentication detected, verifying identity');
      transition('verifying_identity');

      // ── Verify identity ────────────────────────────────────────
      const identity = await this.verifyIdentityWithRetry(queueItemId, workspaceId, accountId);
      if (!identity) {
        transition('failed');
        return { success: false, error: 'Identity verification failed — could not read LinkedIn profile' };
      }
      const identityMismatch = this.getIdentityMismatch(identity, intendedIdentity);
      if (identityMismatch) {
        transition('failed');
        return { success: false, error: identityMismatch, nonRetryable: true, authState: 'authenticated' };
      }
      logger.info('Identity verified', { canonical_identity_found: !!identity.profileUrl });
      if (onProgress) await onProgress('identity_verified', 'LinkedIn identity verified. Closing secure sign-in view...');
      const identityVerifiedAt = Date.now();
      logger.info('Identity verified progress emitted', {
        queue_item_id: queueItemId,
        workspace_id: workspaceId,
        account_id: accountId,
        progress_step: 'identity_verified',
      });

      // ── Capture session ────────────────────────────────────────
      transition('capturing_session');
      const session = await this.captureSession();
      const stateCapturedAt = Date.now();

      // ── Test session restore ────────────────────────────────────
      // Session persistence and the final connected transition are owned by
      // Worker.handleConnect. Avoid a second cloud-browser login immediately
      // after human verification; the original session has already supplied
      // authenticated UI, canonical identity, and the authenticated cookie.
      return { success: true, identity, session, identityVerifiedAt, stateCapturedAt };
    } catch (err) {
      try { transition('failed'); } catch { /* preserve the original failure */ }
      const msg = this.sanitizeError(err);
      logger.error('Connection flow error', { error: msg });
      if (onProgress) await onProgress('login_failed', `Connection failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  // ── Connect with existing session (session reuse) ──────────────

  async connectWithSession(
    session: SessionData,
    _timeoutMs: number,
    onProgress?: ProgressCallback,
    intendedIdentity?: IntendedLinkedInIdentity,
  ): Promise<ConnectionResult> {
    if (!this.browser) throw new Error('Browser not launched');

    try {
      if (onProgress) await onProgress('creating_session', 'Restoring existing session...');
      await this.newContext();
      const restored = await this.restoreSession(session);
      if (!restored) {
        return { success: false, error: 'Session restore failed — please reconnect your account' };
      }

      if (onProgress) await onProgress('opening_linkedin', 'Verifying session on LinkedIn...');
      await this.page!.goto(LINKEDIN_FEED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const assessment = await this.assessAuthentication();
      logger.info('Restored LinkedIn session classified', {
        authentication_state: assessment.state, confidence: assessment.confidence,
        origin: this.safeOrigin(assessment.url), pathname: this.safePathname(assessment.url),
      });
      if (assessment.state === 'checkpoint') return {
        success: false, authState: 'checkpoint', requiresAction: true, reuseExistingBrowser: true,
        preserveCurrentPage: true, error: 'LinkedIn security verification is required',
      };
      if (assessment.state === 'unauthenticated' || assessment.state === 'login_in_progress') return {
        success: false, authState: assessment.state, requiresAction: true, reuseExistingBrowser: true,
        error: 'LinkedIn authentication is required',
      };
      if (assessment.state !== 'authenticated') {
        return { success: false, authState: 'unknown', errorCode: 'authentication_state_unknown', retryable: true,
          error: 'The restored LinkedIn authentication state could not be confirmed' };
      }

      await onProgress?.('identity_resolution_pending', 'LinkedIn is authenticated. Checking the bound account identity...');
      // Existing bound accounts get one bounded, best-effort identity check.
      // Authentication usability is not coupled to LinkedIn's /in/me redirect.
      const identity = await this.verifyIdentity(1, undefined, undefined, undefined, FAST_REUSE_IDENTITY_TIMEOUT_MS);
      if (!identity) {
        const boundProfileUrl = intendedIdentity?.profileUrl
          ? this.canonicalPersonalProfileUrl(intendedIdentity.profileUrl)
          : null;
        if (boundProfileUrl) {
          logger.warn('Bound LinkedIn account identity remains unresolved after fast verification', {
            authentication_state: 'authenticated', identity_state: 'unresolved',
            canonical_identity_bound: true,
          });
          return {
            success: true,
            identity: { profileUrl: boundProfileUrl, profileName: intendedIdentity?.profileName || null, profileHeadline: null },
            effectiveProfileUrl: boundProfileUrl, reuseBoundIdentity: true,
            authState: 'authenticated', identityState: 'unresolved',
          };
        }
        return { success: false, authState: 'authenticated', identityState: 'unresolved',
          errorCode: 'identity_resolution_failed', nonRetryable: true,
          error: 'LinkedIn is authenticated, but its canonical personal profile URL could not be verified. Please retry identity verification.' };
      }
      const identityMismatch = this.getIdentityMismatch(identity, intendedIdentity);
      if (identityMismatch) return { success: false, error: identityMismatch, nonRetryable: true, authState: 'authenticated', identityState: 'mismatch' };

      return { success: true, identity, effectiveProfileUrl: identity.profileUrl || undefined, authState: 'authenticated', identityState: 'verified' };
    } catch (err) {
      const msg = this.sanitizeError(err);
      return { success: false, error: msg };
    }
  }

  // ── Test Connection ─────────────────────────────────────────────

  async testConnection(session: SessionData, _timeoutMs: number, intendedIdentity?: IntendedLinkedInIdentity): Promise<ConnectionResult> {
    try {
      await this.newContext();
      const restored = await this.restoreSession(session);
      if (!restored) return { success: false, error: 'Session restore failed' };

      await this.page!.goto(LINKEDIN_FEED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const auth = await this.waitForAuthentication(15000);
      if (!auth) return { success: false, error: 'Session expired — LinkedIn did not show authenticated state' };

      const identity = await this.verifyIdentity();
      if (!identity) return { success: false, error: 'Identity verification failed' };
      const identityMismatch = this.getIdentityMismatch(identity, intendedIdentity);
      if (identityMismatch) return { success: false, error: identityMismatch, nonRetryable: true, authState: 'authenticated' };

      return { success: true, identity };
    } catch (err) {
      const msg = this.sanitizeError(err);
      return { success: false, error: msg };
    }
  }

  // ── Authentication Detection ────────────────────────────────────

  async assessAuthentication(pageOverride?: Page, focusSelectedPage = true): Promise<AuthenticationAssessment> {
    let page: Page;
    try {
      if (pageOverride) {
        if (pageOverride.isClosed()) return { state: 'unknown', confidence: 'low', url: '', signals: ['pinned_page_closed'] };
        page = pageOverride;
        this.context = page.context();
        this.page = page;
      } else {
        page = await this.ensureActivePage(true, focusSelectedPage);
      }
    } catch {
      return { state: 'unknown', confidence: 'low', url: '', signals: ['no_live_page'] };
    }

    const url = page.url();
    const lowerUrl = url.toLowerCase();
    const signals: string[] = [];
    const isCheckpointUrl = lowerUrl.includes('/checkpoint') || lowerUrl.includes('/challenge') || lowerUrl.includes('/captcha');
    const isLoginUrl = lowerUrl.includes('/login') || lowerUrl.includes('/uas/login') || lowerUrl.includes('/signin');
    const isAuthenticatedRoute = /^\/(feed|mynetwork|jobs|messaging|notifications|in)(\/|$)/i.test(new URL(url).pathname);

    if (isCheckpointUrl) signals.push('checkpoint_url');
    if (isLoginUrl) signals.push('login_url');

    const selectorFlags = await Promise.race([
      page.evaluate(() => {
        const elementVisible = (element: HTMLElement): boolean => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        };
        const visible = (selector: string): boolean => Array.from(document.querySelectorAll<HTMLElement>(selector)).some(elementVisible);
        return {
          loginForm: visible('input[type="password"], input[name="session_key"], form.login__form'),
          checkpoint: visible('input[name="pin"], input[name="verificationCode"], input[name="otp"], #captcha, [data-test-challenge], .challenge'),
          globalNav: visible('.global-nav, nav[aria-label="Primary"], nav[aria-label="Main"]'),
          meControl: visible('.global-nav__me, .global-nav__me-photo, button[aria-label*="Me"], img.global-nav__me-photo'),
          feedContent: visible('.feed-update-wrapper, .core-entry-card, div[class*="feed-shared"]'),
          invalidCredentials: Array.from(document.querySelectorAll<HTMLElement>('[role="alert"], .alert, .form__label--error, #error-for-password, #error-for-username'))
            .filter(elementVisible)
            .some(element => /incorrect|not accepted|wrong (email|password)|couldn['’]t find|could not find/i.test(element.textContent || '')),
        };
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth signal timeout')), AUTH_SIGNAL_TIMEOUT_MS)),
    ]).catch(() => ({ loginForm: false, checkpoint: false, globalNav: false, meControl: false, feedContent: false, invalidCredentials: false }));

    if (selectorFlags.loginForm) signals.push('login_form');
    if (selectorFlags.checkpoint) signals.push('checkpoint_control');
    if (selectorFlags.globalNav) signals.push('global_nav');
    if (selectorFlags.meControl) signals.push('me_control');
    if (selectorFlags.feedContent) signals.push('feed_content');
    if (selectorFlags.invalidCredentials) signals.push('invalid_credentials');

    let hasSessionCookie = false;
    try {
      const cookies = await page.context().cookies('https://www.linkedin.com');
      hasSessionCookie = cookies.some(cookie => cookie.name === 'li_at' && cookie.value.length > 0);
      if (hasSessionCookie) signals.push('session_cookie');
    } catch {
      signals.push('cookie_check_failed');
    }

    if (isCheckpointUrl || selectorFlags.checkpoint) {
      return { state: 'checkpoint', confidence: 'high', url, signals };
    }
    if (selectorFlags.loginForm && !selectorFlags.globalNav) {
      return { state: isLoginUrl ? 'unauthenticated' : 'login_in_progress', confidence: 'high', url, signals };
    }

    if (isAuthenticatedRoute) signals.push('authenticated_route');
    return { ...classifyLinkedInAuthentication({
      isCheckpoint: isCheckpointUrl,
      isLogin: isLoginUrl,
      isAuthenticatedRoute,
      loginForm: selectorFlags.loginForm,
      checkpointControl: selectorFlags.checkpoint,
      globalNav: selectorFlags.globalNav,
      meControl: selectorFlags.meControl,
      feedContent: selectorFlags.feedContent,
      hasSessionCookie,
    }), url, signals };
  }

  async checkExistingAuthenticatedSession(intendedIdentity?: IntendedLinkedInIdentity): Promise<ExistingSessionCheck> {
    if (!this.page) throw new Error('No page — call newContext() first');
    await this.navigateWithRetry(this.page, LINKEDIN_FEED_URL, PAGE_LOAD_TIMEOUT_MS);
    const assessment = await this.assessAuthentication(undefined, false);
    logger.info('Persistent Context preflight authentication assessed', {
      auth_state: assessment.state, confidence: assessment.confidence,
      origin: this.safeOrigin(assessment.url), pathname: this.safePathname(assessment.url), signals: assessment.signals,
    });
    if (assessment.state !== 'authenticated') {
      return { result: null, authRequired: true, preserveCurrentPage: assessment.state === 'checkpoint' };
    }

    const authenticationDetectedAt = Date.now();
    const identity = await this.verifyIdentityWithRetry();
    if (!identity) return { result: null, authRequired: true, preserveCurrentPage: false };
    const identityMismatch = this.getIdentityMismatch(identity, intendedIdentity);
    if (identityMismatch) {
      return { result: { success: false, error: identityMismatch, nonRetryable: true, authState: 'authenticated' }, authRequired: false, preserveCurrentPage: false };
    }
    const identityVerifiedAt = Date.now();
    const session = await this.captureSession();
    return {
      result: { success: true, identity, session, authenticationDetectedAt, identityVerifiedAt, stateCapturedAt: Date.now() },
      authRequired: false,
      preserveCurrentPage: false,
    };
  }

  private async navigateWithRetry(page: Page, url: string, timeoutMs: number): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= TRANSIENT_RETRY_LIMIT; attempt++) {
      if (page.isClosed()) throw new Error('Browser page closed during navigation');
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message.toLowerCase();
        const recoverable = message.includes('timeout') || message.includes('net::') || message.includes('navigation') || message.includes('target closed');
        if (!recoverable || attempt === TRANSIENT_RETRY_LIMIT || page.isClosed()) break;
        logger.warn('Transient browser navigation failure', { attempt: attempt + 1, host: this.safeHostname(url), error: this.sanitizeError(lastError) });
        await new Promise(resolve => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
    throw new Error(`LinkedIn navigation failed: ${this.sanitizeError(lastError)}`);
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return message
      .replace(/(li_at|jsessionid|password|token|cookie|authorization)=?[^\s&]*/gi, '$1=[redacted]')
      .replace(/https?:\/\/[^\s]+/gi, '[url redacted]')
      .slice(0, 500);
  }

  private async waitForAuthentication(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const assessment = await this.assessAuthentication();
      if (assessment.state === 'authenticated') {
        logger.info('Authenticated state verified', { host: this.safeHostname(assessment.url), confidence: assessment.confidence, signals: assessment.signals });
        return true;
      }
      if (assessment.state === 'checkpoint') return false;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }

  // ── Authentication with Challenge Detection ─────────────────────

  private async waitForAuthenticationWithChallenges(
    timeoutMs: number,
    onProgress?: ProgressCallback,
    workspaceId?: string,
    accountId?: string,
    queueItemId?: string,
    onFlowState?: (state: 'waiting_for_login' | 'challenge_detected' | 'waiting_for_user') => void,
  ): Promise<{ authenticated: boolean; challenge: ChallengeInfo | null; cancelled: boolean; failure?: string }> {
    if (!this.page) return { authenticated: false, challenge: null, cancelled: false, failure: 'Secure LinkedIn browser page is unavailable' };

    const startedAt = Date.now();
    const normalDeadline = startedAt + timeoutMs;
    const absoluteDeadline = startedAt + MAX_AUTH_ATTEMPT_LIFETIME_MS;
    let challengeDeadline: number | null = null;
    let pinnedChallengePage: Page | null = null;
    let challengeMissingSince: number | null = null;
    let lastChallengeCheck = 0;
    let lastCancellationCheck = 0;
    let lastRecoveryCheck = 0;
    let activeChallenge: ChallengeInfo | null = null;
    let lastDiagnosticState = '';
    let challengeOccurrenceCount = 0;
    let mainFrameNavigationCount = 0;
    let lastChallengeNavigationCount = -1;
    let wasCheckpoint = false;
    let invalidCredentialsReported = false;
    const CHALLENGE_CHECK_INTERVAL = 5000;
    const observedPage = this.page;
    const observeMainFrameNavigation = (frame: import('playwright').Frame): void => {
      if (frame === observedPage.mainFrame()) mainFrameNavigationCount++;
    };
    observedPage.on('framenavigated', observeMainFrameNavigation);

    try {
    while (Date.now() < absoluteDeadline) {
      if (!this.browser?.isConnected()) {
        logger.warn('LinkedIn auth lifecycle', { lifecycle_stage: 'L5_cdp_disconnected' });
        await onProgress?.('live_view_disconnected', 'The secure LinkedIn sign-in connection was interrupted.', { lifecycle_stage: 'L5_cdp_disconnected' });
        const recovery = await this.recoverAuthSurface(onProgress);
        if ('error' in recovery) {
          await onProgress?.('connection_failed', recovery.error, { lifecycle_stage: 'L9_terminal_failure_published', error_code: recovery.errorCode });
          return { authenticated: false, challenge: activeChallenge, cancelled: false, failure: recovery.error };
        }
      }
      if (pinnedChallengePage?.isClosed()) {
        return { authenticated: false, challenge: activeChallenge, cancelled: false, failure: 'LinkedIn security-check page was closed. Start a new connection attempt.' };
      }

      // Once a challenge is detected, observe that exact page without page
      // selection, focus changes, navigation, reloads, clicks, or form input.
      const assessment = await this.assessAuthentication(pinnedChallengePage ?? undefined, pinnedChallengePage === null);
      const url = assessment.url;
      const diagnosticState = `${assessment.state}:${assessment.confidence}:${assessment.signals.join(',')}:${mainFrameNavigationCount}`;
      if (diagnosticState !== lastDiagnosticState) {
        lastDiagnosticState = diagnosticState;
        logger.info('Human authentication state observed', {
          queue_item_id: queueItemId,
          workspace_id: workspaceId,
          account_id: accountId,
          auth_state: assessment.state,
          confidence: assessment.confidence,
          origin: this.safeOrigin(url),
          pathname: this.safePathname(url),
          challenge_classification: activeChallenge?.type ?? null,
          login_form_exists: assessment.signals.includes('login_form'),
          authenticated_cookie_exists: assessment.signals.includes('session_cookie'),
          navigation_change_detected: mainFrameNavigationCount > 0,
          challenge_pinned: !!pinnedChallengePage,
          challenge_occurrence_count: challengeOccurrenceCount,
          browserbase_session_id: this.bbSession?.id ?? null,
          worker_action: assessment.state === 'checkpoint'
            ? 'observe_only'
            : assessment.state === 'authenticated'
              ? 'verify_canonical_identity'
              : 'reassess_authentication',
        });
      }

      if (assessment.state === 'authenticated') {
        logger.info('Authenticated state verified after human authentication', {
          queue_item_id: queueItemId,
          workspace_id: workspaceId,
          account_id: accountId,
          browserbase_session_id: this.bbSession?.id ?? null,
          origin: this.safeOrigin(url),
          pathname: this.safePathname(url),
          authentication_classification: assessment.state,
          challenge_classification: activeChallenge?.type ?? null,
          login_form_exists: assessment.signals.includes('login_form'),
          authenticated_cookie_exists: assessment.signals.includes('session_cookie'),
          challenge_occurrence_count: challengeOccurrenceCount,
          worker_action: 'verify_canonical_identity',
        });
        return { authenticated: true, challenge: activeChallenge, cancelled: false };
      }

      if (assessment.state === 'unauthenticated' && assessment.signals.includes('invalid_credentials')) {
        if (!invalidCredentialsReported && onProgress) {
          invalidCredentialsReported = true;
          await onProgress('invalid_credentials', 'LinkedIn reported that the sign-in details were not accepted. Check them directly in the secure LinkedIn browser and try again.');
        }
      } else if (!assessment.signals.includes('invalid_credentials')) {
        invalidCredentialsReported = false;
      }

      const now = Date.now();
      const enteredCheckpoint = assessment.state === 'checkpoint' && !wasCheckpoint;
      if (assessment.state === 'checkpoint') {
        challengeMissingSince = null;
        if (!pinnedChallengePage) pinnedChallengePage = this.page;
        if (!challengeDeadline) {
          challengeDeadline = Math.min(now + HUMAN_CHALLENGE_EXTENSION_MS, absoluteDeadline);
          logger.info('Human challenge window activated', {
            extensionMs: HUMAN_CHALLENGE_EXTENSION_MS,
            absoluteLifetimeMs: MAX_AUTH_ATTEMPT_LIFETIME_MS,
          });
        }
      } else if (pinnedChallengePage) {
        challengeMissingSince ??= now;
        if (now - challengeMissingSince >= CHALLENGE_DISAPPEAR_GRACE_MS) {
          pinnedChallengePage = null;
          activeChallenge = null;
          challengeMissingSince = null;
          onFlowState?.('waiting_for_login');
          if (onProgress) await onProgress('waiting_for_login', 'Security check completed. Waiting for LinkedIn to confirm sign-in...');
        }
      }

      const effectiveDeadline = pinnedChallengePage && challengeDeadline ? challengeDeadline : normalDeadline;
      if (now >= effectiveDeadline) break;

      if (this.cancellationReason) return { authenticated: false, challenge: activeChallenge, cancelled: true };
      if (queueItemId && now - lastCancellationCheck > 3000) {
        lastCancellationCheck = now;
        const { data } = await this.client.from('browser_execution_queue').select('status').eq('id', queueItemId).maybeSingle();
        if (data?.status === 'cancelled') return { authenticated: false, challenge: activeChallenge, cancelled: true };
      }

      if (queueItemId && now - lastRecoveryCheck > 1000) {
        lastRecoveryCheck = now;
        const { data: recoveryRequest } = await this.client.from('linkedin_auth_interactions')
          .select('id').eq('queue_item_id', queueItemId).eq('interaction_type', 'auth_surface_recovery')
          .eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (recoveryRequest?.id) {
          logger.info('LinkedIn auth lifecycle', { lifecycle_stage: 'L5_live_view_disconnect_reported', queue_item_id: queueItemId });
          await onProgress?.('live_view_disconnected', 'The secure LinkedIn sign-in view was interrupted.', { lifecycle_stage: 'L5_live_view_disconnect_reported' });
          const recovery = await this.recoverAuthSurface(onProgress);
          await this.client.from('linkedin_auth_interactions').update({
            status: 'completed', updated_at: new Date().toISOString(),
            user_response: 'error' in recovery ? { outcome: 'failed', error_code: recovery.errorCode } : { outcome: 'recovered' },
          }).eq('id', recoveryRequest.id);
          if ('error' in recovery) {
            await onProgress?.('connection_failed', recovery.error, { lifecycle_stage: 'L9_terminal_failure_published', error_code: recovery.errorCode });
            return { authenticated: false, challenge: activeChallenge, cancelled: false, failure: recovery.error };
          }
        }
      }

      if (now - lastChallengeCheck > CHALLENGE_CHECK_INTERVAL) {
        lastChallengeCheck = now;
        const challenge = assessment.state === 'checkpoint' ? await this.detectChallengeDetailed(pinnedChallengePage ?? undefined) : null;
        if (challenge) {
          const providerRechallenge = challengeOccurrenceCount > 0
            && (enteredCheckpoint || mainFrameNavigationCount !== lastChallengeNavigationCount);
          const isNewChallenge = challengeOccurrenceCount === 0 || activeChallenge?.type !== challenge.type || providerRechallenge;
          activeChallenge = challenge;
          if (isNewChallenge) {
            challengeOccurrenceCount++;
            lastChallengeNavigationCount = mainFrameNavigationCount;
          }
          logger.warn('Challenge detected during auth wait', {
            queue_item_id: queueItemId,
            workspace_id: workspaceId,
            account_id: accountId,
            browserbase_session_id: this.bbSession?.id ?? null,
            origin: this.safeOrigin(url),
            pathname: this.safePathname(url),
            type: challenge.type,
            challenge_occurrence_count: challengeOccurrenceCount,
            classification: providerRechallenge ? 'provider_rechallenge' : 'human_challenge_required',
            worker_action: 'observe_only',
          });
          if (isNewChallenge) {
            onFlowState?.('challenge_detected');
            if (onProgress) {
              await onProgress('challenge_detected', `LinkedIn verification required: ${challenge.description}`, {
                challenge_type: challenge.type,
                challenge_deadline: challengeDeadline ? new Date(challengeDeadline).toISOString() : null,
                challenge_occurrence_count: challengeOccurrenceCount,
                challenge_classification: providerRechallenge ? 'provider_rechallenge' : 'human_challenge_required',
              });
              await onProgress('human_challenge_required', 'Complete verification directly in the secure LinkedIn browser. Yuktris will remain passive.', {
                challenge_type: challenge.type,
                challenge_occurrence_count: challengeOccurrenceCount,
              });
              if (providerRechallenge && challengeOccurrenceCount >= 2) {
                await onProgress('provider_rechallenge', 'LinkedIn is requesting additional verification for this sign-in. Complete it directly in the secure browser. If verification continues, you can cancel and try again later.', {
                  challenge_type: challenge.type,
                  challenge_occurrence_count: challengeOccurrenceCount,
                });
              }
            }
            onFlowState?.('waiting_for_user');
            if (onProgress) {
              await onProgress('waiting_for_user', 'Complete verification in the secure LinkedIn browser. Yuktris never collects verification codes. Keep this same secure browser open until sign-in completes.');
            }
          }
          if (workspaceId && accountId && isNewChallenge) {
            await this.writeChallengeInteraction(workspaceId, accountId, queueItemId, challenge);
          }
        }
      }

      wasCheckpoint = assessment.state === 'checkpoint';
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { authenticated: false, challenge: activeChallenge, cancelled: false };
    } finally {
      observedPage.off('framenavigated', observeMainFrameNavigation);
    }
  }

  // ── Challenge Detection ─────────────────────────────────────────

  private async detectChallengeDetailed(pageOverride?: Page): Promise<ChallengeInfo | null> {
    const page = pageOverride ?? this.page;
    if (!page || page.isClosed()) return null;
    const url = page.url();

    if (url.includes('/checkpoint/challenge/') || url.includes('/uas/challenge')) {
      const pageText = await page.textContent('body').catch(() => '') || '';
      if (pageText.toLowerCase().includes('enter the verification code') || pageText.toLowerCase().includes('enter the code we sent')) {
        return { type: 'email_otp', description: 'Complete email verification inside the secure LinkedIn browser' };
      }
      if (pageText.toLowerCase().includes('authenticator') || pageText.toLowerCase().includes('two-factor') || pageText.toLowerCase().includes('2fa')) {
        return { type: 'two_factor', description: 'Complete two-factor verification inside the secure LinkedIn browser' };
      }
      return { type: 'email_otp', description: 'Complete the LinkedIn verification challenge' };
    }

    if (url.includes('/captcha') || url.includes('/challenge/captcha')) {
      return { type: 'captcha', description: 'Complete the CAPTCHA verification' };
    }

    if (url.includes('/checkpoint') || url.includes('/challenge')) {
      return { type: 'email_otp', description: 'Complete the LinkedIn security check' };
    }

    const challengeSelectors = [
      '[data-test-challenge]', '.challenge', '#captcha', '.captcha',
      'input[name="pin"]', 'input[name="verificationCode"]', 'input[name="otp"]',
    ];

    for (const sel of challengeSelectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const isVisible = await el.isVisible().catch(() => false);
        if (isVisible) {
          logger.warn('Challenge element detected', { selector: sel });
          return { type: 'email_otp', description: 'Complete the LinkedIn verification challenge' };
        }
      }
    }

    return null;
  }

  private async writeChallengeInteraction(
    workspaceId: string,
    accountId: string,
    queueItemId: string | undefined,
    challenge: ChallengeInfo,
  ): Promise<void> {
    try {
      await this.client.from('linkedin_auth_interactions').insert({
        workspace_id: workspaceId,
        account_id: accountId,
        queue_item_id: queueItemId || null,
        interaction_type: 'challenge',
        step: 'challenge_detected',
        message: challenge.description,
        challenge_type: challenge.type,
        challenge_description: challenge.description,
        status: 'pending',
        metadata: { host: this.page ? this.safeHostname(this.page.url()) : '' },
      });
      logger.info('Challenge interaction written to DB', { type: challenge.type });
    } catch (err) {
      logger.error('Failed to write challenge interaction', { error: String(err) });
    }
  }

  // ── Identity Verification ────────────────────────────────────────

  private canonicalPersonalProfileUrl(value: string): string | null {
    try {
      const parsed = new URL(value, 'https://www.linkedin.com');
      if (!this.isLinkedInUrl(parsed.toString())) return null;
      const match = parsed.pathname.match(/^\/in\/([A-Za-z0-9_%.-]+)\/?$/i);
      if (!match || match[1].toLowerCase() === 'me') return null;
      return `https://www.linkedin.com/in/${match[1]}`;
    } catch {
      return null;
    }
  }

  private async verifyIdentity(attempt = 1, queueItemId?: string, workspaceId?: string, accountId?: string, navigationTimeoutMs = IDENTITY_NAVIGATION_TIMEOUT_MS): Promise<LinkedInIdentity | null> {
    if (!this.page) return null;
    const startedAt = Date.now();
    const timing = (stage: string, method: string, stageStartedAt = startedAt, metadata: Record<string, unknown> = {}): void => {
      const now = Date.now();
      logger.info('Canonical LinkedIn identity timing', {
        queue_item_id: queueItemId,
        workspace_id: workspaceId,
        account_id: accountId,
        attempt,
        stage,
        method,
        timestamp: new Date(now).toISOString(),
        elapsed_ms: now - startedAt,
        stage_duration_ms: now - stageStartedAt,
        ...metadata,
      });
    };
    timing('I0_identity_resolution_started', 'authenticated_navigation_dom');

    try {
      const domStartedAt = Date.now();
      timing('identity_fallback_started', 'authenticated_navigation_dom', domStartedAt);
      const selfNavigationIdentity = await this.page.evaluate(() => {
        const selectors = [
          '.global-nav__me a[href*="/in/"]',
          'a[data-control-name="identity_profile_photo"][href*="/in/"]',
          'a[data-test-global-nav-link="me"][href*="/in/"]',
          'a[data-view-name="profile-card-profile-link"][href*="/in/"]',
        ];
        for (const selector of selectors) {
          const anchor = document.querySelector<HTMLAnchorElement>(selector);
          if (anchor?.href) return { href: anchor.href, name: anchor.textContent?.trim() || null };
        }
        const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || null;
        return canonical ? { href: canonical, name: document.querySelector('h1')?.textContent?.trim() || null } : null;
      }).catch(() => null);
      const domProfileUrl = selfNavigationIdentity?.href ? this.canonicalPersonalProfileUrl(selfNavigationIdentity.href) : null;
      timing('identity_fallback_completed', 'authenticated_navigation_dom', domStartedAt, { canonical_identity_found: !!domProfileUrl });
      if (domProfileUrl) {
        const identity = { profileUrl: domProfileUrl, profileName: selfNavigationIdentity?.name || null, profileHeadline: null };
        timing('I4_canonical_url_available', 'authenticated_navigation_dom', startedAt, { pathname: this.safePathname(domProfileUrl) });
        timing('I5_identity_parsed', 'authenticated_navigation_dom');
        timing('I6_identity_resolution_completed', 'authenticated_navigation_dom');
        logger.info('Identity extracted', { canonical_identity_found: true, method: 'authenticated_navigation_dom', pathname: this.safePathname(domProfileUrl) });
        return identity;
      }

      const navigationStartedAt = Date.now();
      timing('identity_fallback_started', 'linkedin_profile_redirect', navigationStartedAt);
      timing('I1_navigation_started', 'linkedin_profile_redirect', navigationStartedAt, { timeout_ms: navigationTimeoutMs });
      const response = await this.page.goto(LINKEDIN_PROFILE_URL, { waitUntil: 'commit', timeout: navigationTimeoutMs });
      timing('I2_navigation_response_received', 'linkedin_profile_redirect', navigationStartedAt, { response_received: !!response });
      const resolvedUrl = this.page.url();
      timing('I3_redirect_resolved', 'linkedin_profile_redirect', navigationStartedAt, { origin: this.safeOrigin(resolvedUrl), pathname: this.safePathname(resolvedUrl) });
      const profileUrl = this.canonicalPersonalProfileUrl(resolvedUrl);
      if (!profileUrl) {
        const linkedinControlledUrl = await this.page.evaluate(() => {
          const selectors = [
            'link[rel="canonical"]',
            '.global-nav__me a[href*="/in/"]',
            'a[data-test-global-nav-link="me"][href*="/in/"]',
            'a[data-view-name="profile-card-profile-link"][href*="/in/"]',
          ];
          for (const selector of selectors) {
            const element = document.querySelector<HTMLAnchorElement | HTMLLinkElement>(selector);
            if (element?.href) return element.href;
          }
          return null;
        }).catch(() => null);
        const domProfileUrl = linkedinControlledUrl ? this.canonicalPersonalProfileUrl(linkedinControlledUrl) : null;
        if (domProfileUrl) {
          timing('I4_canonical_url_available', 'linkedin_profile_dom_after_navigation', navigationStartedAt, { pathname: this.safePathname(domProfileUrl) });
          timing('I5_identity_parsed', 'linkedin_profile_dom_after_navigation');
          timing('I6_identity_resolution_completed', 'linkedin_profile_dom_after_navigation');
          return { profileUrl: domProfileUrl, profileName: null, profileHeadline: null };
        }
        timing('identity_fallback_completed', 'linkedin_profile_redirect', navigationStartedAt, { canonical_identity_found: false });
        logger.warn('Profile URL not resolved', { origin: this.safeOrigin(resolvedUrl), pathname: this.safePathname(resolvedUrl) });
        return null;
      }
      timing('I4_canonical_url_available', 'linkedin_profile_redirect', navigationStartedAt, { pathname: this.safePathname(profileUrl) });

      // Canonical identity is established by LinkedIn's authenticated redirect.
      // Profile presentation fields are optional and sampled without selector waits.
      const presentation = await this.page.evaluate(() => ({
        name: document.querySelector('h1')?.textContent?.trim() || null,
        headline: document.querySelector('.text-body-medium, [class*="headline"]')?.textContent?.trim() || null,
      })).catch(() => ({ name: null, headline: null }));

      const identity: LinkedInIdentity = {
        profileUrl,
        profileName: presentation.name,
        profileHeadline: presentation.headline,
      };

      timing('I5_identity_parsed', 'linkedin_profile_redirect');
      timing('identity_fallback_completed', 'linkedin_profile_redirect', navigationStartedAt, { canonical_identity_found: true });
      timing('I6_identity_resolution_completed', 'linkedin_profile_redirect');
      logger.info('Identity extracted', { canonical_identity_found: true, method: 'linkedin_profile_redirect', pathname: this.safePathname(profileUrl) });
      return identity;
    } catch (err) {
      timing('identity_fallback_completed', 'linkedin_profile_redirect', startedAt, { canonical_identity_found: false, failed: true });
      logger.error('Identity verification failed', { error: this.sanitizeError(err), attempt });
      return null;
    }
  }

  private async verifyIdentityWithRetry(queueItemId?: string, workspaceId?: string, accountId?: string): Promise<LinkedInIdentity | null> {
    for (let attempt = 1; attempt <= IDENTITY_RESOLUTION_ATTEMPTS; attempt++) {
      const identity = await this.verifyIdentity(attempt, queueItemId, workspaceId, accountId);
      logger.info('Canonical LinkedIn identity resolution attempt', {
        queue_item_id: queueItemId,
        workspace_id: workspaceId,
        account_id: accountId,
        attempt,
        method: 'linkedin_profile_redirect',
        canonical_identity_found: !!identity?.profileUrl,
        pathname: this.page ? this.safePathname(this.page.url()) : '',
      });
      if (identity?.profileUrl) return identity;
      if (attempt < IDENTITY_RESOLUTION_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, IDENTITY_RESOLUTION_DELAY_MS));
    }
    return null;
  }

  private normalizeProfileUrl(value?: string | null): string | null {
    if (!value) return null;
    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
      if (!this.isLinkedInUrl(parsed.toString())) return null;
      const match = parsed.pathname.toLowerCase().match(/^\/in\/([^/?#]+)/);
      return match ? match[1].replace(/\/$/, '') : null;
    } catch {
      return null;
    }
  }

  private normalizeName(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.toLocaleLowerCase('en-US').normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
    return normalized.length >= 3 ? normalized : null;
  }

  private getIdentityMismatch(actual: LinkedInIdentity, intended?: IntendedLinkedInIdentity): string | null {
    if (!intended) return null;
    const expectedProfile = this.normalizeProfileUrl(intended.profileUrl);
    const actualProfile = this.normalizeProfileUrl(actual.profileUrl);
    if (expectedProfile && actualProfile && expectedProfile !== actualProfile) {
      return 'Authenticated LinkedIn profile does not match the account being connected';
    }

    const expectedName = this.normalizeName(intended.profileName);
    const actualName = this.normalizeName(actual.profileName);
    if (!expectedProfile && expectedName && actualName && expectedName !== actualName) {
      return 'Authenticated LinkedIn identity name does not match the account being connected';
    }
    return null;
  }

  // ── Session Capture & Restore ───────────────────────────────────

  async captureSession(): Promise<SessionData> {
    if (!this.context) throw new Error('No context to capture session from');
    const assessment = await this.assessAuthentication();
    if (assessment.state !== 'authenticated') {
      throw new Error(`Cannot capture LinkedIn session while authentication state is ${assessment.state}`);
    }

    const cookies = await this.context.cookies();
    if (!cookies.some(cookie => cookie.name === 'li_at' && cookie.value.length > 0)) {
      throw new Error('Cannot capture LinkedIn session without an authenticated session cookie');
    }
    const storageState = await this.context.storageState();

    const localStorage: Record<string, unknown> = {};
    const sessionStorage: Record<string, unknown> = {};

    if (this.page) {
      const ls = await this.page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) items[key] = window.localStorage.getItem(key) || '';
        }
        return items;
      }).catch(() => ({}));
      Object.assign(localStorage, ls);

      const ss = await this.page.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) items[key] = window.sessionStorage.getItem(key) || '';
        }
        return items;
      }).catch(() => ({}));
      Object.assign(sessionStorage, ss);
    }

    const userAgent = await this.page!.evaluate(() => navigator.userAgent);
    const fingerprint = await this.page!.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      language: navigator.language || null,
      platform: navigator.platform || null,
      cookieEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency || 1,
    })).catch(() => null) as BrowserFingerprint | null;

    const browserVersion = this.browser?.version() || null;
    const playwrightVersion = null;

    return {
      cookies,
      storageState,
      localStorage,
      sessionStorage,
      userAgent,
      viewport: { width: 1440, height: 900 },
      timezone: fingerprint?.timezone || null,
      language: fingerprint?.language || null,
      browserVersion,
      playwrightVersion,
      fingerprint,
    };
  }

  // ── Validate Session: verify restored session is still authenticated ──

  async validateSession(intendedIdentity?: IntendedLinkedInIdentity): Promise<{ valid: boolean; reason: string | null; identity: LinkedInIdentity | null }> {
    if (!this.page || this.page.isClosed()) return { valid: false, reason: 'No active page available', identity: null };

    try {
      // 1. Navigate to LinkedIn feed
      await this.navigateWithRetry(this.page, LINKEDIN_FEED_URL, 30000);
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const assessment = await this.assessAuthentication();
      if (assessment.state !== 'authenticated') {
        logger.warn('Session validation failed', { state: assessment.state, confidence: assessment.confidence, signals: assessment.signals });
        const reason = assessment.state === 'checkpoint'
          ? 'LinkedIn requires account verification'
          : assessment.state === 'unauthenticated'
            ? 'LinkedIn session expired or was rejected'
            : `LinkedIn authentication could not be verified (${assessment.state})`;
        return { valid: false, reason, identity: null };
      }

      // 3. Verify profile is accessible
      const identity = await this.verifyIdentity();
      if (!identity) {
        return { valid: false, reason: 'Profile page not accessible — identity verification failed', identity: null };
      }
      const identityMismatch = this.getIdentityMismatch(identity, intendedIdentity);
      if (identityMismatch) return { valid: false, reason: identityMismatch, identity };

      logger.info('Session validation successful', { name: identity.profileName });
      return { valid: true, reason: null, identity };
    } catch (err) {
      const msg = this.sanitizeError(err);
      logger.error('Session validation error', { error: msg });
      return { valid: false, reason: msg, identity: null };
    }
  }

  // ── Refresh Session: re-capture cookies and storage during automation ──

  async refreshSession(): Promise<SessionData | null> {
    if (!this.context) {
      logger.warn('Cannot refresh session: no context');
      return null;
    }

    try {
      const session = await this.captureSession();
      logger.info('Session refreshed', { cookieCount: session.cookies.length });
      return session;
    } catch (err) {
      logger.error('Session refresh failed', { error: String(err) });
      return null;
    }
  }

  async restoreSession(session: SessionData): Promise<boolean> {
    if (!this.context || !this.page) throw new Error('No context to restore session into');

    try {
      if (session.storageState && (session.storageState as { cookies?: unknown }).cookies) {
        await this.context.addCookies((session.storageState as { cookies: never[] }).cookies);
      } else if (session.cookies && session.cookies.length > 0) {
        await this.context.addCookies(session.cookies as never[]);
      }

      await this.navigateWithRetry(this.page, 'https://www.linkedin.com', 30000);

      if (Object.keys(session.localStorage).length > 0) {
        await this.page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try { window.localStorage.setItem(key, String(value)); } catch { /* Ignore origin-restricted keys. */ }
          }
        }, session.localStorage).catch(() => {});
      }

      if (Object.keys(session.sessionStorage).length > 0) {
        await this.page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try { window.sessionStorage.setItem(key, String(value)); } catch { /* Ignore origin-restricted keys. */ }
          }
        }, session.sessionStorage).catch(() => {});
      }

      await this.navigateWithRetry(this.page, LINKEDIN_FEED_URL, 30000);
      const assessment = await this.assessAuthentication();
      const authenticated = assessment.state === 'authenticated';
      logger.info('Session restore assessed', {
        state: assessment.state,
        confidence: assessment.confidence,
        signals: assessment.signals,
        host: this.safeHostname(assessment.url),
      });
      return authenticated;
    } catch (err) {
      logger.error('Session restore error', { error: this.sanitizeError(err) });
      return false;
    }
  }

  getBrowserVersion(): string | null {
    return this.browser?.version() || null;
  }

  // ── Safety Checks ───────────────────────────────────────────────

  async detectRestriction(): Promise<boolean> {
    if (!this.page) return false;
    const url = this.page.url();
    if (url.includes('/restricted') || url.includes('/suspended') || url.includes('/account-restricted')) {
      return true;
    }
    const text = await this.page.textContent('body').catch(() => '');
    if (text && (text.includes('account has been restricted') || text.includes('temporarily restricted'))) {
      return true;
    }
    return false;
  }

  async takeScreenshot(): Promise<string | null> {
    if (!this.page) return null;
    try {
      const buf = await this.page.screenshot({ type: 'png', fullPage: false });
      return buf.toString('base64');
    } catch (err) {
      logger.error('Screenshot failed', { error: String(err) });
      return null;
    }
  }

  isUrlAllowed(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['linkedin.com', 'www.linkedin.com'].includes(parsed.hostname);
    } catch {
      return false;
    }
  }
}
