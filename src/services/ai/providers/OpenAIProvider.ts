// ============================================================
// OpenAIProvider — Fully implemented OpenAI AI provider
// ============================================================
//
// All requests are proxied through the `ai-generate` edge function
// to keep API keys server-side. This client-side provider constructs
// the request and calls the edge function.

import { BaseAIProvider } from '../BaseAIProvider';
import { supabase } from '@/lib/supabase';
import type {
  AIProviderDefinition,
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  GenerateEmbeddingParams,
  GenerateEmbeddingResult,
  CountTokensParams,
  CountTokensResult,
  AIProviderHealth,
  AIToolCall,
} from '@/types/ai-gateway';

const OPENAI_DEFINITION: AIProviderDefinition = {
  id: 'openai',
  name: 'OpenAI',
  description: 'GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5, and embedding models',
  icon: 'sparkles',
  color: '#10A37F',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'text-embedding-3-small', 'text-embedding-3-large'],
  capabilities: [
    'generate_text', 'generate_structured', 'generate_json', 'generate_streaming',
    'generate_embeddings', 'tool_calling', 'image_understanding', 'token_counting',
    'health_check', 'cost_calculation',
  ],
  priority: 1,
};

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`;

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
}

export class OpenAIProvider extends BaseAIProvider {
  definition = OPENAI_DEFINITION;

  async initialize(): Promise<void> {
    // Verify that the OpenAI API key is configured
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('provider', 'openai')
      .maybeSingle();

    if (!apiKey) {
      console.warn('[OpenAIProvider] No OpenAI API key configured.');
    }
  }

  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
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
      throw new Error(error.error ?? `OpenAI request failed (${response.status})`);
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
      provider: 'openai',
    };
  }

  async generateStructured(params: GenerateStructuredParams): Promise<GenerateStructuredResult> {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'generate_structured',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_prompt: params.userPrompt,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens,
        schema: params.schema,
        tools: params.tools,
        images: params.images,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error ?? `OpenAI request failed (${response.status})`);
    }

    const data = await response.json();
    return {
      data: data.structured_data,
      raw: data.raw ?? data.content ?? '',
      promptTokens: data.prompt_tokens ?? 0,
      completionTokens: data.completion_tokens ?? 0,
      model: data.model ?? params.model,
      provider: 'openai',
    };
  }

  async *generateStreaming(params: GenerateTextParams): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${FUNCTION_URL}?stream=true`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'generate_stream',
        model: params.model,
        system_prompt: params.systemPrompt,
        user_prompt: params.userPrompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        tools: params.tools,
        images: params.images,
      }),
    });

    if (!response.ok || !response.body) {
      const error = await response.json().catch(() => ({ error: 'Stream failed' }));
      throw new Error(error.error ?? `OpenAI stream failed (${response.status})`);
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

  async generateEmbeddings(params: GenerateEmbeddingParams): Promise<GenerateEmbeddingResult> {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'generate_embeddings',
        model: params.model,
        input: params.input,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error ?? `OpenAI embeddings failed (${response.status})`);
    }

    const data = await response.json();
    return {
      embeddings: data.embeddings,
      promptTokens: data.prompt_tokens ?? 0,
      model: params.model,
      provider: 'openai',
    };
  }

  async countTokens(params: CountTokensParams): Promise<CountTokensResult> {
    // Rough estimate: ~4 chars per token
    return { tokenCount: Math.ceil(params.input.length / 4), model: params.model };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const now = new Date().toISOString();
    try {
      const { data: apiKey } = await supabase
        .from('api_keys')
        .select('id')
        .eq('provider', 'openai')
        .maybeSingle();

      if (!apiKey) {
        return {
          provider: 'openai',
          healthy: false,
          status: 'degraded',
          latency_ms: null,
          last_checked_at: now,
          error: 'No OpenAI API key configured.',
        };
      }

      return {
        provider: 'openai',
        healthy: true,
        status: 'healthy',
        latency_ms: null,
        last_checked_at: now,
        error: null,
      };
    } catch (err) {
      return {
        provider: 'openai',
        healthy: false,
        status: 'down',
        latency_ms: null,
        last_checked_at: now,
        error: err instanceof Error ? err.message : 'Health check failed.',
      };
    }
  }
}
