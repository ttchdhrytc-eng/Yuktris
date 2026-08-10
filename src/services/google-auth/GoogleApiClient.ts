// ============================================================
// GoogleApiClient — shared client for all Google API calls
// ============================================================
//
// Single source of truth for making authenticated requests to
// Google APIs. Handles auth headers, retry, error parsing, and
// rate limiting. All Google services (Gmail, future Calendar,
// People, Drive) must use this client instead of raw fetch.

import { googleRateLimiter } from './GoogleRateLimiter';

export type GoogleApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: GoogleApiError | null;
};

export type GoogleApiError = {
  code: number;
  message: string;
  status: string;
  errors: { domain?: string; reason?: string; message?: string }[];
};

export class GoogleApiClient {
  async request<T = unknown>(params: {
    url: string;
    method?: string;
    accessToken: string;
    body?: BodyInit;
    headers?: Record<string, string>;
    quotaKey?: string;
  }): Promise<GoogleApiResponse<T>> {
    const { url, method = 'GET', accessToken, body, headers, quotaKey } = params;
    const maxRetries = googleRateLimiter.getMaxRetries();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await googleRateLimiter.acquire(quotaKey);
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...headers,
          },
          body,
        });

        googleRateLimiter.release();

        if (response.ok) {
          const data = response.status === 204 ? null : await response.json().catch(() => null);
          return { ok: true, status: response.status, data: data as T, error: null };
        }

        const errorBody = await response.json().catch(() => ({})) as { error?: { errors?: { reason?: string }[]; message?: string; status?: string } };

        if (googleRateLimiter.isRateLimitError(response.status, errorBody) && attempt < maxRetries) {
          const delay = googleRateLimiter.getRetryDelay(attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const apiError: GoogleApiError = {
          code: response.status,
          message: errorBody?.error?.message ?? `Google API error (${response.status})`,
          status: errorBody?.error?.status ?? 'UNKNOWN',
          errors: (errorBody?.error?.errors ?? []).map((e) => ({
            domain: e.domain,
            reason: e.reason,
            message: e.message,
          })),
        };

        return { ok: false, status: response.status, data: null, error: apiError };
      } catch (err) {
        googleRateLimiter.release();

        if (attempt < maxRetries) {
          const delay = googleRateLimiter.getRetryDelay(attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        return {
          ok: false,
          status: 0,
          data: null,
          error: {
            code: 0,
            message: err instanceof Error ? err.message : 'Network error',
            status: 'NETWORK_ERROR',
            errors: [],
          },
        };
      }
    }

    return {
      ok: false,
      status: 0,
      data: null,
      error: { code: 0, message: 'Max retries exceeded', status: 'RETRY_EXHAUSTED', errors: [] },
    };
  }

  async get<T = unknown>(url: string, accessToken: string, quotaKey?: string): Promise<GoogleApiResponse<T>> {
    return this.request<T>({ url, accessToken, quotaKey });
  }

  async post<T = unknown>(url: string, accessToken: string, body: Record<string, unknown>, quotaKey?: string): Promise<GoogleApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      accessToken,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      quotaKey,
    });
  }

  async put<T = unknown>(url: string, accessToken: string, body: Record<string, unknown>, quotaKey?: string): Promise<GoogleApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      accessToken,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      quotaKey,
    });
  }

  async patch<T = unknown>(url: string, accessToken: string, body: Record<string, unknown>, quotaKey?: string): Promise<GoogleApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      quotaKey,
    });
  }

  async delete<T = unknown>(url: string, accessToken: string, quotaKey?: string): Promise<GoogleApiResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', accessToken, quotaKey });
  }
}

export const googleApiClient = new GoogleApiClient();
