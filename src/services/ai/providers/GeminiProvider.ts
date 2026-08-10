// ============================================================
// GeminiProvider — Google Gemini AI provider
// ============================================================
//
// All requests are proxied through the `ai-generate` edge function
// with `provider: 'gemini'`. The edge function reads GEMINI_API_KEY
// from the server-side environment — the key never reaches the browser.

import { BaseAIProvider } from '../BaseAIProvider';
import { supabase } from '@/lib/supabase';
import type {
  AIProviderDefinition,
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  CountTokensParams,
  CountTokensResult,
  AIProviderHealth,
  AIToolCall,
} from '@/types/ai-gateway';

const GEMINI_DEFINITION: AIProviderDefinition = {
  id: 'gemini',
  name: 'Google Gemini',
  description: 'Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro Vision',
  icon: 'gem',
  color: '#4285F4',
  models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro-vision', 'gemini-2.0-flash'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'tool_calling', 'image_understanding', 'token_counting', 'health_check', 'cost_calculation',
  ],
  priority: 3,
};

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`;

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
}

export class GeminiProvider extends BaseAIProvider {
  definition = GEMINI_DEFINITION;

  async initialize(): Promise<void> {
    // The GEMINI_API_KEY is verified server-side in the edge function.
    // Here we just confirm the provider is registered.
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        provider: 'gemini',
        action: 'generate_text',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_prompt: params.userPrompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        tools: params.tools,
        images: params.images,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error ?? `Gemini request failed (${response.status})`);
    }

    const data = await response.json();
    return {
      content: data.content,
      toolCalls: data.tool_calls as AIToolCall[] | undefined,
      finishReason: data.finish_reason ?? 'stop',
      promptTokens: data.prompt_tokens ?? 0,
      completionTokens: data.completion_tokens ?? 0,
      totalTokens: data.total_tokens ?? 0,
      model: data.model ?? params.model,
      provider: 'gemini',
    };
  }

  async generateStructured(params: GenerateStructuredParams): Promise<GenerateStructuredResult> {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        provider: 'gemini',
        action: 'generate_structured',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_prompt: params.userPrompt,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens,
        schema: params.schema,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error ?? `Gemini request failed (${response.status})`);
    }

    const data = await response.json();
    return {
      data: data.structured_data,
      raw: data.raw ?? data.content ?? '',
      promptTokens: data.prompt_tokens ?? 0,
      completionTokens: data.completion_tokens ?? 0,
      totalTokens: (data.prompt_tokens ?? 0) + (data.completion_tokens ?? 0),
      model: data.model ?? params.model,
      provider: 'gemini',
    };
  }

  async *generateStreaming(params: GenerateTextParams): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${FUNCTION_URL}?stream=true`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        provider: 'gemini',
        action: 'generate_stream',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_prompt: params.userPrompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
      }),
    });

    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({ error: 'Stream failed' }));
      throw new Error(error.error ?? `Gemini stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') return;
            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(params: CountTokensParams): Promise<CountTokensResult> {
    return { tokenCount: Math.ceil(params.input.length / 4), model: params.model };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const now = new Date().toISOString();
    try {
      // The GEMINI_API_KEY lives server-side; we can only confirm
      // the provider is registered. A real probe would call the
      // edge function, which we do via a lightweight generate call.
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          provider: 'gemini',
          action: 'generate_text',
          model: 'gemini-1.5-flash',
          user_prompt: 'ping',
          max_tokens: 1,
        }),
      });

      if (response.ok) {
        return {
          provider: 'gemini',
          healthy: true,
          status: 'healthy',
          latency_ms: null,
          last_checked_at: now,
          error: null,
        };
      }

      const errorData = await response.json().catch(() => ({ error: 'Health check failed' }));
      return {
        provider: 'gemini',
        healthy: false,
        status: 'degraded',
        latency_ms: null,
        last_checked_at: now,
        error: errorData.error ?? `Gemini health check failed (${response.status})`,
      };
    } catch (err) {
      return {
        provider: 'gemini',
        healthy: false,
        status: 'down',
        latency_ms: null,
        last_checked_at: now,
        error: err instanceof Error ? err.message : 'Health check failed.',
      };
    }
  }
}
