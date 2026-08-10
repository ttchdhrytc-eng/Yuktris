// ============================================================
// ModelSelector — Intelligent model routing
// ============================================================
//
// Resolves which provider + model to use for a given request,
// applying overrides in priority order:
//   1. Request-level provider/model override
//   2. Prompt-level provider/model override
//   3. Agent-level default
//   4. Gateway default provider + model
//
// Also handles fallback: if the primary provider fails, the next
// provider in priority order is used.

import { supabase } from '@/lib/supabase';
import { aiProviderRegistry } from './AIProviderRegistry';
import type { AIProviderId, AIModelRecord } from '@/types/ai-gateway';

class ModelSelector {
  private defaultModel: string = 'gpt-4o';
  private fallbackChain: AIProviderId[] = ['openai'];

  // Set the default model for the gateway
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  // Set the fallback chain (ordered list of providers to try)
  setFallbackChain(providers: AIProviderId[]): void {
    this.fallbackChain = providers;
  }

  // Resolve the provider and model for a request
  resolve(params: {
    providerOverride?: AIProviderId;
    modelOverride?: string;
    promptName?: string;
    agentName?: string;
  }): { provider: AIProviderId; model: string } {
    // 1. Request-level overrides (highest priority)
    if (params.providerOverride) {
      const provider = params.providerOverride;
      const model = params.modelOverride ?? this.getDefaultModelForProvider(provider);
      return { provider, model };
    }

    if (params.modelOverride && !params.providerOverride) {
      const provider = this.inferProviderFromModel(params.modelOverride);
      return { provider, model: params.modelOverride };
    }

    // 2. Prompt-level overrides (loaded from DB by caller, passed via promptName)
    // Handled by the gateway before calling resolve — if prompt overrides exist,
    // they're passed as providerOverride/modelOverride.

    // 3. Gateway default
    const defaultProvider = aiProviderRegistry.getDefaultProvider();
    if (defaultProvider) {
      return { provider: defaultProvider, model: this.defaultModel };
    }

    // 4. Absolute fallback
    return { provider: 'openai', model: this.defaultModel };
  }

  // Get the fallback provider if the primary fails
  getFallbackProvider(currentProvider: AIProviderId): AIProviderId | null {
    const idx = this.fallbackChain.indexOf(currentProvider);
    if (idx === -1 || idx + 1 >= this.fallbackChain.length) return null;
    return this.fallbackChain[idx + 1];
  }

  // Get all available models from the database
  async getAvailableModels(): Promise<AIModelRecord[]> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('status', 'active')
      .order('provider', { ascending: true })
      .order('model_name', { ascending: true });
    if (error) throw new Error(`Failed to load models: ${error.message}`);
    return (data ?? []) as AIModelRecord[];
  }

  // Get models for a specific provider
  async getModelsForProvider(provider: AIProviderId): Promise<AIModelRecord[]> {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('provider', provider)
      .eq('status', 'active')
      .order('model_name', { ascending: true });
    if (error) throw new Error(`Failed to load models: ${error.message}`);
    return (data ?? []) as AIModelRecord[];
  }

  // Infer provider from model name prefix
  private inferProviderFromModel(model: string): AIProviderId {
    if (model.startsWith('gpt-') || model.startsWith('text-embedding-') || model.startsWith('dall-e')) {
      return 'openai';
    }
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('grok-')) return 'grok';
    if (model.startsWith('mistral-') || model.startsWith('mixtral-')) return 'mistral';
    if (model.startsWith('deepseek-')) return 'deepseek';
    return 'openrouter';
  }

  // Get the default model for a provider
  private getDefaultModelForProvider(provider: AIProviderId): string {
    const def = aiProviderRegistry.getDefinition(provider);
    return def?.models[0] ?? this.defaultModel;
  }
}

export const modelSelector = new ModelSelector();
