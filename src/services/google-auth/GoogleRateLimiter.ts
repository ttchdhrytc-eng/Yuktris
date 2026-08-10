// ============================================================
// GoogleRateLimiter — shared rate limiter for Google API calls
// ============================================================
//
// Respects Gmail API quotas by queueing requests and applying
// exponential backoff on 429 / quota-exceeded responses.
// Used by GoogleApiClient and edge functions via the service layer.

const DEFAULT_QUOTA_PER_SECOND = 250;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

export class GoogleRateLimiter {
  private windows = new Map<string, RateLimitEntry>();
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(
    private readonly maxConcurrent: number = DEFAULT_BATCH_SIZE,
    private readonly quotaPerSecond: number = DEFAULT_QUOTA_PER_SECOND,
  ) {}

  async acquire(key: string = 'default'): Promise<void> {
    return new Promise<void>((resolve) => {
      const run = () => {
        this.active++;
        resolve();
      };

      if (this.active < this.maxConcurrent && this.checkQuota(key)) {
        run();
        return;
      }

      this.queue.push(() => {
        if (this.active < this.maxConcurrent && this.checkQuota(key)) {
          run();
        } else {
          this.queue.unshift(run);
          setTimeout(() => this.drain(), 100);
        }
      });
    });
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    this.drain();
  }

  private checkQuota(key: string): boolean {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now - entry.windowStart >= 1000) {
      this.windows.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.quotaPerSecond) {
      return false;
    }

    entry.count++;
    return true;
  }

  private drain(): void {
    while (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  getRetryDelay(attempt: number): number {
    const delay = DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    return Math.min(delay + jitter, DEFAULT_RETRY_MAX_MS);
  }

  getMaxRetries(): number {
    return DEFAULT_MAX_RETRIES;
  }

  isRateLimitError(status: number, errorBody: { error?: { errors?: { reason?: string }[] } }): boolean {
    if (status === 429) return true;
    if (status === 403) {
      const reasons = errorBody?.error?.errors?.map((e) => e.reason) ?? [];
      if (reasons.includes('rateLimitExceeded') || reasons.includes('userRateLimitExceeded') || reasons.includes('quotaExceeded')) {
        return true;
      }
    }
    return false;
  }
}

export const googleRateLimiter = new GoogleRateLimiter();
