import { logger } from './logger.js';

const BROWSERBASE_API_URL = 'https://api.browserbase.com/v1';
const BROWSERBASE_REQUEST_TIMEOUT_MS = 20000;
const TRANSIENT_RETRY_DELAY_MS = 1500;
const DEFAULT_VIEWPORT = { width: 1440, height: 900 } as const;

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

async function createSession(opts?: {
  keepAlive?: boolean;
  timeoutMs?: number;
  proxies?: boolean;
  viewport?: { width: number; height: number };
}): Promise<BrowserbaseSession> {
  const apiKey = getApiKey();
  const projectId = getProjectId();
  const viewport = opts?.viewport ?? DEFAULT_VIEWPORT;

  const body: Record<string, unknown> = {
    projectId,
    keepAlive: opts?.keepAlive ?? true,
    browserSettings: { viewport },
  ...(opts?.proxies ? { proxies: { type: 'browserbase' } } : {}),
  };

  logger.info('Creating Browserbase session', { projectId, keepAlive: body.keepAlive, viewport });

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

      // Fetch the REAL Live View URL from the /debug endpoint
      // The session creation response does NOT include the live debugger URL.
      // The constructed URL "https://www.browserbase.com/sessions/{id}" is just the
      // dashboard page — NOT the live browser view. We need debuggerFullscreenUrl.
      let liveUrl = data.liveUrl || '';
      let debugUrl = data.debugUrl || '';

      try {
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
      if (!liveUrl) {
        liveUrl = `https://www.browserbase.com/sessions/${data.id}`;
        logger.warn('Using fallback Browserbase dashboard URL instead of debugger', { sessionId: data.id });
      }

      logger.info('Browserbase session created', {
        id: data.id,
        wsUrlSource: data.wsEndpoint ? 'api' : 'constructed',
        liveUrlSource: liveUrl.includes('debugger') ? 'debug-endpoint' : 'fallback',
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
      logger.warn('Browserbase rate limited, waiting before retry', { attempt: attempt + 1, waitMs, body: text.slice(0, 200) });
      lastError = new BrowserbaseError('Browserbase rate limit exceeded', 429);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (res.status >= 500 && attempt < 2) {
      lastError = new BrowserbaseError('Browserbase service is temporarily unavailable', res.status);
      await new Promise(resolve => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS * (attempt + 1)));
      continue;
    }
    throw new BrowserbaseError(`Browserbase session creation failed: ${res.status} ${text}`, res.status);
  }

  throw lastError || new BrowserbaseError('Browserbase session creation failed after retries', 429);
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
    if (data.status === 'running') return 'running';
    if (data.status === 'completed') return 'completed';
    if (data.status === 'error') return 'error';
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

async function getLiveUrls(sessionId: string): Promise<{
  debuggerUrl: string;
  debuggerFullscreenUrl: string;
  pages: Array<{ id: string; url: string; debuggerUrl: string; debuggerFullscreenUrl: string }>;
}> {
  const apiKey = getApiKey();
  const res = await browserbaseFetch(`${BROWSERBASE_API_URL}/sessions/${sessionId}/debug`, {
    headers: { 'x-bb-api-key': apiKey },
  });
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
  endSession,
  getSessionStatus,
  getDebugUrl,
  getLiveUrls,
  getApiKey,
  getProjectId,
};
