import { logger } from './logger.js';

const BROWSERBASE_API_URL = 'https://api.browserbase.com/v1';
const BROWSERBASE_REQUEST_TIMEOUT_MS = 20000;
const TRANSIENT_RETRY_DELAY_MS = 1500;
const DEFAULT_VIEWPORT = { width: 1440, height: 900 } as const;
const CONTEXT_SYNC_POLL_MS = 500;
const CONTEXT_SETTLE_MS = 3000;
const MIN_SESSION_TIMEOUT_SECONDS = 60;
const MAX_SESSION_TIMEOUT_SECONDS = 21600;

async function browserbaseFetch(url: string, init: RequestInit = {}, timeoutMs = BROWSERBASE_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BrowserbaseError('Browserbase request timed out', 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface BrowserbaseSession {
  id: string;
  wsUrl: string;
  debugUrl: string;
  liveUrl: string;
  createdAt: string;
}

export interface BrowserbaseContext { id: string; }
export interface CreateSessionOptions {
  keepAlive?: boolean;
  timeoutMs?: number;
  proxies?: boolean;
  viewport?: { width: number; height: number };
  contextId?: string;
  persistContext?: boolean;
  requirePersistentContext?: boolean;
  liveView?: boolean;
}

export class BrowserbaseError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BrowserbaseError';
    this.statusCode = statusCode;
  }
}

function getApiKey(): string {
  const key = process.env.BROWSERBASE_API_KEY;
  if (!key) throw new BrowserbaseError('BROWSERBASE_API_KEY is not set', 500);
  return key;
}

function getProjectId(): string {
  const id = process.env.BROWSERBASE_PROJECT_ID;
  if (!id) throw new BrowserbaseError('BROWSERBASE_PROJECT_ID is not set', 500);
  return id;
}

function isConfigured(): boolean {
  return !!(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID);
}

async function createSession(opts?: CreateSessionOptions): Promise<BrowserbaseSession> {
  const apiKey = getApiKey();
  const projectId = getProjectId();
  const viewport = opts?.viewport ?? DEFAULT_VIEWPORT;
  const timeout = sessionTimeoutSeconds(opts?.timeoutMs);
  if (opts?.requirePersistentContext && !opts.contextId) {
    throw new BrowserbaseError('Persistent browser Context is required for this account', 409);
  }
  if (opts?.persistContext && !opts.contextId) {
    throw new BrowserbaseError('Cannot persist a session without a browser Context', 400);
  }

  const body: Record<string, unknown> = {
    projectId,
    keepAlive: opts?.keepAlive ?? true,
    ...(timeout ? { timeout } : {}),
    browserSettings: {
      viewport,
      solveCaptchas: false,
      ...(opts?.contextId ? { context: { id: opts.contextId, persist: opts.persistContext ?? true } } : {}),
    },
  ...(opts?.proxies ? { proxies: { type: 'browserbase' } } : {}),
  };

  logger.info('Creating Browserbase session', { keepAlive: body.keepAlive, timeoutSeconds: timeout ?? null, viewport, persistentContext: !!opts?.contextId });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bb-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = error instanceof BrowserbaseError ? error : new BrowserbaseError('Browserbase network request failed', 503);
      if (attempt === 2) throw lastError;
      await new Promise(resolve => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * (attempt + 1)));
      continue;
    }

    if (res.ok) {
      const data = await res.json() as {
        id: string;
        wsEndpoint?: string;
        connectUrl?: string;
        debugUrl?: string;
        liveUrl?: string;
        createdAt?: string;
      };

      if (!data.id) {
        throw new BrowserbaseError('Browserbase response missing session id', 500);
      }

      const wsUrl = data.wsEndpoint || data.connectUrl || `wss://connect.browserbase.com/?session_id=${data.id}&apiKey=${encodeURIComponent(apiKey)}`;

      // Fetch the real Live View URL only for sessions that may be shown to a human.
      // The session creation response does NOT include the live debugger URL.
      // The constructed URL "https://www.browserbase.com/sessions/{id}" is just the
      // dashboard page — NOT the live browser view. We need debuggerFullscreenUrl.
      let liveUrl = data.liveUrl || '';
      let debugUrl = data.debugUrl || '';

      if (opts?.liveView !== false) try {
        const debugRes = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${data.id}/debug`, {
          headers: { 'x-bb-api-key': apiKey },
        });
        if (debugRes.ok) {
          const debugData = await debugRes.json() as {
            debuggerUrl?: string;
            debuggerFullscreenUrl?: string;
            pages?: Array<{ url?: string; debuggerUrl?: string; debuggerFullscreenUrl?: string }>;
          };
          // Use the fullscreen debugger URL — this is the actual live browser view
          liveUrl = debugData.debuggerFullscreenUrl || debugData.debuggerUrl || liveUrl;
          debugUrl = debugData.debuggerUrl || debugUrl;
          logger.info('Browserbase debug URLs fetched', {
            sessionId: data.id,
            debuggerFullscreenUrlAvailable: !!debugData.debuggerFullscreenUrl,
            debuggerUrlAvailable: !!debugData.debuggerUrl,
            pageCount: debugData.pages?.length || 0,
          });
        } else {
          logger.warn('Browserbase /debug endpoint returned non-OK', {
            sessionId: data.id,
            status: debugRes.status,
          });
        }
      } catch (debugErr) {
        logger.warn('Failed to fetch Browserbase debug URLs', { sessionId: data.id, error: String(debugErr) });
      }

      // Fallback if /debug didn't return a usable URL
      if (opts?.liveView !== false && !liveUrl) {
        liveUrl = `https://www.browserbase.com/sessions/${data.id}`;
        logger.warn('Using fallback Browserbase dashboard URL instead of debugger', { sessionId: data.id });
      }

      logger.info('Browserbase session created', {
        id: data.id,
        wsUrlSource: data.wsEndpoint ? 'api' : 'constructed',
        liveUrlSource: !liveUrl ? 'not-requested' : liveUrl.includes('debugger') ? 'debug-endpoint' : 'fallback',
      });

      return {
        id: data.id,
        wsUrl,
        debugUrl,
        liveUrl,
        createdAt: data.createdAt || new Date().toISOString(),
      };
    }

    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new BrowserbaseError('Invalid Browserbase API key', 401);
    if (res.status === 402) throw new BrowserbaseError('Browserbase quota exceeded', 402);
    if (res.status === 429) {
      const waitMs = 10000 * (attempt + 1);
      logger.warn('Browserbase rate limited, waiting before retry', { attempt: attempt + 1, waitMs });
      lastError = new BrowserbaseError('Browserbase rate limit exceeded', 429);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (res.status >= 500 && attempt < 2) {
      lastError = new BrowserbaseError('Browserbase service is temporarily unavailable', res.status);
      await new Promise(resolve => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * (attempt + 1)));
      continue;
    }
    throw new BrowserbaseError(`Browserbase session creation failed (${res.status})`, res.status);
  }

  throw lastError || new BrowserbaseError('Browserbase session creation failed after retries', 429);
}

export function sessionTimeoutSeconds(timeoutMs?: number): number | undefined {
  if (timeoutMs === undefined) return undefined;
  const timeout = Math.ceil(timeoutMs / 1000);
  if (!Number.isFinite(timeout) || timeout < MIN_SESSION_TIMEOUT_SECONDS || timeout > MAX_SESSION_TIMEOUT_SECONDS) {
    throw new BrowserbaseError('Browserbase session timeout must be between 60 and 21600 seconds', 400);
  }
  return timeout;
}

async function createContext(): Promise<BrowserbaseContext> {
  const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/contexts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bb-api-key': getApiKey() },
    body: JSON.stringify({ projectId: getProjectId() }),
  });
  if (!res.ok) throw new BrowserbaseError(`Browserbase Context creation failed (${res.status})`, res.status);
  const data = await res.json() as { id?: string };
  if (!data.id) throw new BrowserbaseError('Browserbase response missing Context id', 502);
  return { id: data.id };
}

async function getContext(contextId: string): Promise<BrowserbaseContext> {
  const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/contexts/${encodeURIComponent(contextId)}`, {
    headers: { 'x-bb-api-key': getApiKey() },
  });
  if (!res.ok) throw new BrowserbaseError(`Browserbase Context lookup failed (${res.status})`, res.status);
  const data = await res.json() as { id?: string };
  if (!data.id) throw new BrowserbaseError('Browserbase response missing Context id', 502);
  return { id: data.id };
}

async function deleteContext(contextId: string): Promise<'deleted' | 'not_found'> {
  const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/contexts/${encodeURIComponent(contextId)}`, {
    method: 'DELETE', headers: { 'x-bb-api-key': getApiKey() },
  });
  if (res.ok || res.status === 204) return 'deleted';
  if (res.status === 404) return 'not_found';
  if (res.status === 429 || res.status >= 500) {
    throw new BrowserbaseError(`Browserbase Context deletion temporarily failed (${res.status})`, res.status);
  }
  throw new BrowserbaseError(`Browserbase Context deletion failed (${res.status})`, res.status);
}

export async function pollForSessionTerminal(
  getStatus: () => Promise<'running' | 'completed' | 'error' | 'unknown'>,
  timeoutMs = 15000,
  pollMs = CONTEXT_SYNC_POLL_MS,
  now: () => number = Date.now,
  wait: (ms: number) => Promise<void> = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<'completed' | 'error'> {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const state = await getStatus();
    if (state === 'completed' || state === 'error') return state;
    await wait(pollMs);
  }
  throw new BrowserbaseError('Browserbase session did not reach a terminal state before synchronization timeout', 504);
}

async function waitForSessionTerminal(sessionId: string, timeoutMs = 15000): Promise<'completed' | 'error'> {
  return pollForSessionTerminal(() => getSessionStatus(sessionId), timeoutMs);
}

async function waitForContextSynchronization(sessionId: string, contextId: string, timeoutMs = 15000): Promise<{ terminalObservedAt: number; synchronizedAt: number }> {
  const terminal = await waitForSessionTerminal(sessionId, timeoutMs);
  if (terminal !== 'completed') throw new BrowserbaseError('Browserbase session ended with an error before Context synchronization', 502);
  const terminalObservedAt = Date.now();
  // Browserbase documents an asynchronous settle period after a persisted session closes.
  await new Promise(resolve => setTimeout(resolve, CONTEXT_SETTLE_MS));
  await getContext(contextId);
  return { terminalObservedAt, synchronizedAt: Date.now() };
}

async function settleClosedContext(sessionId: string, contextId: string, timeoutMs = 15000): Promise<void> {
  await waitForSessionTerminal(sessionId, timeoutMs);
  await new Promise(resolve => setTimeout(resolve, CONTEXT_SETTLE_MS));
  await getContext(contextId);
}

async function endSession(sessionId: string): Promise<void> {
  const apiKey = getApiKey();
  try {
    const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bb-api-key': apiKey },
      body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
    });
    if (!res.ok) {
      logger.warn('Browserbase session end returned non-OK', { sessionId, status: res.status });
    }
  } catch (err) {
    logger.warn('Failed to end Browserbase session', { sessionId, error: String(err) });
  }
}

async function getSessionStatus(sessionId: string): Promise<'running' | 'completed' | 'error' | 'unknown'> {
  const apiKey = getApiKey();
  try {
    const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${sessionId}`, {
      headers: { 'x-bb-api-key': apiKey },
    });
    if (!res.ok) return 'unknown';
    const data = await res.json() as { status?: string };
    const status = data.status?.toLowerCase();
    if (status === 'running' || status === 'pending') return 'running';
    if (status === 'completed') return 'completed';
    if (status === 'error' || status === 'timed_out') return 'error';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getDebugUrl(sessionId: string): Promise<string> {
  const apiKey = getApiKey();
  try {
    const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${sessionId}/debug`, {
      headers: { 'x-bb-api-key': apiKey },
    });
    if (res.ok) {
      const data = await res.json() as { debuggerUrl?: string; debuggerFullscreenUrl?: string };
      return data.debuggerFullscreenUrl || data.debuggerUrl || `https://www.browserbase.com/sessions/${sessionId}`;
    }
  } catch {
    // Fall back to the Browserbase session dashboard URL.
  }
  return `https://www.browserbase.com/sessions/${sessionId}`;
}

async function getLiveUrls(sessionId: string, timeoutMs = 8_000): Promise<{
  debuggerUrl: string;
  debuggerFullscreenUrl: string;
  pages: Array<{ id: string; url: string; debuggerUrl: string; debuggerFullscreenUrl: string }>;
}> {
  const apiKey = getApiKey();
  const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${sessionId}/debug`, {
    headers: { 'x-bb-api-key': apiKey },
  }, timeoutMs);
  if (!res.ok) throw new BrowserbaseError(`Failed to fetch live URLs: ${res.status}`, res.status);
  const data = await res.json() as {
    debuggerUrl?: string;
    debuggerFullscreenUrl?: string;
    pages?: Array<{ id?: string; url?: string; debuggerUrl?: string; debuggerFullscreenUrl?: string }>;
  };
  return {
    debuggerUrl: data.debuggerUrl || '',
    debuggerFullscreenUrl: data.debuggerFullscreenUrl || '',
    pages: (data.pages || []).map(p => ({
      id: p.id || '',
      url: p.url || '',
      debuggerUrl: p.debuggerUrl || '',
      debuggerFullscreenUrl: p.debuggerFullscreenUrl || '',
    })),
  };
}

export const browserbase = {
  isConfigured,
  createSession,
  createContext,
  getContext,
  deleteContext,
  waitForSessionTerminal,
  waitForContextSynchronization,
  settleClosedContext,
  endSession,
  getSessionStatus,
  getDebugUrl,
  getLiveUrls,
  getApiKey,
  getProjectId,
};
