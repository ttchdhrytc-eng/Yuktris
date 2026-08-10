// ============================================================
// ProviderRetryService — Retry logic with exponential backoff
// ============================================================

import { supabase } from '@/lib/supabase';
import type { OperationType, OperationStatus } from '@/types/communication-providers';

type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: OperationStatus[];
};

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: ['failure', 'timeout', 'rate_limited'],
};

class ProviderRetryService {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: {
      config?: Partial<RetryConfig>;
      onRetry?: (attempt: number, error: Error) => void;
      connectionId?: string;
      operationType?: OperationType;
      workspaceId?: string;
    }
  ): Promise<T> {
    const config = { ...DEFAULT_CONFIG, ...options?.config };
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0 && options?.connectionId) {
          await this.logRetryEvent(options.connectionId, options.workspaceId, options.operationType, attempt, 'success', null);
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === config.maxRetries) {
          if (options?.connectionId) {
            await this.logRetryEvent(options.connectionId, options.workspaceId, options.operationType, attempt, 'failure', lastError.message);
          }
          throw lastError;
        }

        if (options?.onRetry) options.onRetry(attempt + 1, lastError);

        if (options?.connectionId) {
          await this.logRetryEvent(options.connectionId, options.workspaceId, options.operationType, attempt + 1, 'retrying', lastError.message);
        }

        const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  isRetryable(status: OperationStatus, config: RetryConfig = DEFAULT_CONFIG): boolean {
    return config.retryableStatuses.includes(status);
  }

  calculateDelay(attempt: number, config: RetryConfig = DEFAULT_CONFIG): number {
    return Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
  }

  private async logRetryEvent(
    connectionId: string,
    workspaceId: string | undefined,
    operationType: OperationType | undefined,
    attempt: number,
    status: string,
    errorMessage: string | null
  ): Promise<void> {
    const { error } = await supabase.from('provider_events').insert({
      connection_id: connectionId,
      workspace_id: workspaceId ?? null,
      event_type: 'retried',
      event_status: status === 'success' ? 'success' : status === 'failure' ? 'failure' : 'info',
      message: `Retry attempt ${attempt} ${status}${errorMessage ? ': ' + errorMessage : ''}`,
      metadata: { attempt, operation: operationType, status, error: errorMessage },
    });
    if (error) console.error('[ProviderRetryService] Failed to log retry event:', error.message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const providerRetryService = new ProviderRetryService();
