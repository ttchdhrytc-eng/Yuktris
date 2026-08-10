// ============================================================
// TokenManager — Token tracking and context window management
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AIProviderId } from '@/types/ai-gateway';

class TokenManager {
  // Rough estimate: ~4 characters per token for English text
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Estimate tokens for a conversation with system + user prompts
  estimateConversationTokens(systemPrompt: string, userPrompt: string): number {
    return this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt) + 3;
  }

  // Get the context window for a specific model
  async getContextWindow(provider: AIProviderId, model: string): Promise<number> {
    const { data } = await supabase
      .from('ai_models')
      .select('context_window')
      .eq('provider', provider)
      .eq('model_name', model)
      .maybeSingle();
    return data?.context_window ?? 4096;
  }

  // Calculate remaining context after accounting for prompt tokens
  calculateRemainingContext(contextWindow: number, promptTokens: number, maxTokens?: number): number {
    const reserved = maxTokens ?? 0;
    return Math.max(0, contextWindow - promptTokens - reserved);
  }

  // Check if a request would exceed the context window
  wouldExceedContext(contextWindow: number, promptTokens: number, maxTokens?: number): boolean {
    return promptTokens + (maxTokens ?? 0) > contextWindow;
  }

  // Get a warning level based on context usage
  getContextWarning(contextWindow: number, promptTokens: number): 'none' | 'low' | 'medium' | 'high' {
    const usage = promptTokens / contextWindow;
    if (usage >= 0.9) return 'high';
    if (usage >= 0.75) return 'medium';
    if (usage >= 0.5) return 'low';
    return 'none';
  }

  // Log token usage to the database
  async logTokenUsage(params: {
    workspaceId?: string;
    agentName: string;
    provider: AIProviderId;
    model: string;
    requestType: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    latencyMs: number;
    status: string;
    errorMessage?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from('ai_requests').insert({
      workspace_id: params.workspaceId ?? null,
      agent_name: params.agentName,
      provider: params.provider,
      model: params.model,
      request_type: params.requestType,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: params.promptTokens + params.completionTokens,
      estimated_cost: params.estimatedCost,
      latency_ms: params.latencyMs,
      status: params.status,
      error_message: params.errorMessage ?? null,
    });
    if (error) console.error('[TokenManager] Failed to log token usage:', error.message);
  }
}

export const tokenManager = new TokenManager();
