// ============================================================
// RetryManager — Retry logic with exponential backoff
// ============================================================

class RetryManager {
  calculateBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 30_000): number {
    const backoff = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    // Add jitter (±25%)
    const jitter = backoff * 0.25 * (Math.random() * 2 - 1);
    return Math.round(backoff + jitter);
  }

  shouldRetry(attempt: number, maxAttempts: number): boolean {
    return attempt < maxAttempts;
  }

  getRetryDelay(attempt: number): number {
    return this.calculateBackoff(attempt);
  }

  isRetryableError(error: string): boolean {
    const nonRetryable = [
      'Invalid input',
      'Unauthorized',
      'Forbidden',
      'Not found',
      'Validation failed',
    ];
    return !nonRetryable.some((nr) => error.includes(nr));
  }
}

export const retryManager = new RetryManager();
