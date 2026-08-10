// ============================================================
// StreamingManager — Streaming response management
// ============================================================
//
// Provides utilities for managing streaming AI responses including
// cancellation, partial result accumulation, and event handling.

import type { GenerateTextParams, AIProviderId } from '@/types/ai-gateway';

type StreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; totalTokens: number }
  | { type: 'error'; error: string }
  | { type: 'cancelled' };

class StreamingManager {
  // Create an AbortController for cancellation
  createController(): AbortController {
    return new AbortController();
  }

  // Accumulate chunks into a full response
  accumulateChunk(accumulated: string, chunk: string): string {
    return accumulated + chunk;
  }

  // Create a streaming event emitter
  createStreamEmitter(handler: (event: StreamEvent) => void) {
    return {
      emitChunk: (content: string) => handler({ type: 'chunk', content }),
      emitDone: (totalTokens: number) => handler({ type: 'done', totalTokens }),
      emitError: (error: string) => handler({ type: 'error', error }),
      emitCancelled: () => handler({ type: 'cancelled' }),
    };
  }

  // Stream a response from a provider with cancellation support
  async streamWithCancellation(
    provider: { generateStreaming: (params: GenerateTextParams) => AsyncGenerator<string, void, unknown> },
    params: GenerateTextParams,
    onChunk: (chunk: string) => void,
    controller: AbortController,
  ): Promise<{ content: string; cancelled: boolean }> {
    let accumulated = '';
    let cancelled = false;

    try {
      for await (const chunk of provider.generateStreaming(params)) {
        if (controller.signal.aborted) {
          cancelled = true;
          break;
        }
        accumulated += chunk;
        onChunk(chunk);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        cancelled = true;
      } else {
        throw err;
      }
    }

    return { content: accumulated, cancelled };
  }
}

export const streamingManager = new StreamingManager();
