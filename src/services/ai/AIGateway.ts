// ============================================================
// AIGateway — Central facade for all AI operations
// ============================================================
//
// This is the single entry point for all AI requests in the
// platform. No AI agent should call a provider directly — all
// requests flow through this gateway.
//
// The gateway handles:
//   - Provider routing (with overrides + fallback)
//   - Token tracking + cost calculation
//   - Request logging (observability)
//   - Retry logic + provider failover
//   - Prompt resolution (from the prompt library)
//   - Streaming + cancellation

import { supabase } from '@/lib/supabase';
import { aiProviderRegistry } from './AIProviderRegistry';
import { modelSelector } from './ModelSelector';
import { tokenManager } from './TokenManager';
import { costManager } from './CostManager';
import { promptManager } from './PromptManager';
import { streamingManager } from './StreamingManager';
import { aiHealthService } from './AIHealthService';
import type {
  GatewayRequest,
  GatewayResponse,
  AIProviderId,
  GenerateTextParams,
  GenerateStructuredParams,
  AIPromptRecord,
  AIProviderHealth,
  AIModelRecord,
  CostSummary,
  UsageSummary,
} from '@/types/ai-gateway';

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 60_000;

class AIGateway {
  // ----------------------------------------------------------
  // generate — Non-streaming text generation
  // ----------------------------------------------------------

  async generate(request: GatewayRequest): Promise<GatewayResponse> {
    const { provider: providerId, model } = this.resolveProvider(request);
    const provider = aiProviderRegistry.get(providerId);

    if (!provider) {
      throw new Error(`AI provider not registered: ${providerId}`);
    }

    const startTime = Date.now();
    let lastError: Error | null = null;
    let currentProvider = providerId;

    // Retry with fallback
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const activeProvider = aiProviderRegistry.get(currentProvider);
      if (!activeProvider) {
        const fallback = modelSelector.getFallbackProvider(currentProvider);
        if (fallback) {
          currentProvider = fallback;
          continue;
        }
        break;
      }

      try {
        const params: GenerateTextParams = {
          model: request.modelOverride ?? model,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          temperature: request.temperature ?? 0.7,
          maxTokens: request.maxTokens,
          tools: request.tools,
          images: request.images,
        };

        const result = await this.withTimeout(
          activeProvider.generateText(params),
          REQUEST_TIMEOUT_MS,
        );

        const latencyMs = Date.now() - startTime;
        const estimatedCost = await activeProvider.calculateCost(
          result.promptTokens,
          result.completionTokens,
          result.model,
        );

        // Log the request
        await tokenManager.logTokenUsage({
          workspaceId: request.workspaceId,
          agentName: request.agentName,
          provider: currentProvider,
          model: result.model,
          requestType: request.taskType ?? 'text',
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          estimatedCost,
          latencyMs,
          status: 'success',
        });

        return {
          content: result.content,
          toolCalls: result.toolCalls,
          provider: currentProvider,
          model: result.model,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          estimatedCost,
          latencyMs,
          finishReason: result.finishReason,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Try fallback provider
        const fallback = modelSelector.getFallbackProvider(currentProvider);
        if (fallback && attempt < MAX_RETRIES) {
          currentProvider = fallback;
          continue;
        }
        break;
      }
    }

    // All retries failed — log the error
    const latencyMs = Date.now() - startTime;
    await tokenManager.logTokenUsage({
      workspaceId: request.workspaceId,
      agentName: request.agentName,
      provider: currentProvider,
      model: request.modelOverride ?? model,
      requestType: request.taskType ?? 'text',
      promptTokens: 0,
      completionTokens: 0,
      estimatedCost: 0,
      latencyMs,
      status: 'error',
      errorMessage: lastError?.message ?? 'Unknown error',
    });

    throw lastError ?? new Error('AI request failed after all retries.');
  }

  // ----------------------------------------------------------
  // generateStructured — Structured output (JSON schema)
  // ----------------------------------------------------------

  async generateStructured(request: GatewayRequest & { schema: Record<string, unknown> }): Promise<GatewayResponse> {
    const { provider: providerId, model } = this.resolveProvider(request);
    const provider = aiProviderRegistry.get(providerId);

    if (!provider) throw new Error(`AI provider not registered: ${providerId}`);

    const startTime = Date.now();

    try {
      const params: GenerateStructuredParams = {
        model: request.modelOverride ?? model,
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        temperature: request.temperature ?? 0.3,
        maxTokens: request.maxTokens,
        schema: request.schema,
        tools: request.tools,
        images: request.images,
      };

      const result = await this.withTimeout(
        provider.generateStructured(params),
        REQUEST_TIMEOUT_MS,
      );

      const latencyMs = Date.now() - startTime;
      const estimatedCost = await provider.calculateCost(
        result.promptTokens,
        result.completionTokens,
        result.model,
      );

      await tokenManager.logTokenUsage({
        workspaceId: request.workspaceId,
        agentName: request.agentName,
        provider: providerId,
        model: result.model,
        requestType: 'structured',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCost,
        latencyMs,
        status: 'success',
      });

      return {
        content: result.raw,
        structuredData: result.data,
        provider: providerId,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.promptTokens + result.completionTokens,
        estimatedCost,
        latencyMs,
        finishReason: 'stop',
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await tokenManager.logTokenUsage({
        workspaceId: request.workspaceId,
        agentName: request.agentName,
        provider: providerId,
        model: request.modelOverride ?? model,
        requestType: 'structured',
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        latencyMs,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }

  // ----------------------------------------------------------
  // generateStreaming — Streaming text generation
  // ----------------------------------------------------------

  async *generateStreaming(
    request: GatewayRequest,
    controller?: AbortController,
  ): AsyncGenerator<string, GatewayResponse, unknown> {
    const { provider: providerId, model } = this.resolveProvider(request);
    const provider = aiProviderRegistry.get(providerId);

    if (!provider) throw new Error(`AI provider not registered: ${providerId}`);

    const startTime = Date.now();
    let accumulated = '';
    let lastChunk = '';

    try {
      const iterable = provider.generateStreaming({
        model: request.modelOverride ?? model,
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens,
        tools: request.tools,
        images: request.images,
      });

      for await (const chunk of iterable) {
        if (controller?.signal.aborted) break;
        accumulated += chunk;
        lastChunk = chunk;
        yield chunk;
      }

      const latencyMs = Date.now() - startTime;
      const promptTokens = tokenManager.estimateTokens((request.systemPrompt ?? '') + request.userPrompt);
      const completionTokens = tokenManager.estimateTokens(accumulated);
      const estimatedCost = await provider.calculateCost(promptTokens, completionTokens, request.modelOverride ?? model);

      await tokenManager.logTokenUsage({
        workspaceId: request.workspaceId,
        agentName: request.agentName,
        provider: providerId,
        model: request.modelOverride ?? model,
        requestType: 'streaming',
        promptTokens,
        completionTokens,
        estimatedCost,
        latencyMs,
        status: controller?.signal.aborted ? 'cancelled' : 'success',
      });

      return {
        content: accumulated,
        provider: providerId,
        model: request.modelOverride ?? model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost,
        latencyMs,
        finishReason: controller?.signal.aborted ? 'cancelled' : 'stop',
      } as GatewayResponse;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await tokenManager.logTokenUsage({
        workspaceId: request.workspaceId,
        agentName: request.agentName,
        provider: providerId,
        model: request.modelOverride ?? model,
        requestType: 'streaming',
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        latencyMs,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }

  // ----------------------------------------------------------
  // generateEmbeddings — Vector embeddings
  // ----------------------------------------------------------

  async generateEmbeddings(model: string, input: string | string[], workspaceId?: string) {
    const provider = aiProviderRegistry.get('openai');
    if (!provider) throw new Error('OpenAI provider not registered');

    const result = await provider.generateEmbeddings({ model, input });

    await tokenManager.logTokenUsage({
      workspaceId,
      agentName: 'embedding',
      provider: 'openai',
      model,
      requestType: 'embedding',
      promptTokens: result.promptTokens,
      completionTokens: 0,
      estimatedCost: await provider.calculateCost(result.promptTokens, 0, model),
      latencyMs: 0,
      status: 'success',
    });

    return result;
  }

  // ----------------------------------------------------------
  // countTokens — Estimate token count
  // ----------------------------------------------------------

  async countTokens(model: string, input: string): Promise<number> {
    const provider = aiProviderRegistry.getDefault();
    if (!provider) return tokenManager.estimateTokens(input);
    const result = await provider.countTokens({ model, input });
    return result.tokenCount;
  }

  // ----------------------------------------------------------
  // generateWithPrompt — Generate using a named prompt from the library
  // ----------------------------------------------------------

  async generateWithPrompt(
    promptName: string,
    variables: Record<string, string>,
    request: Omit<GatewayRequest, 'systemPrompt' | 'userPrompt'>,
  ): Promise<GatewayResponse> {
    const prompt = await promptManager.getPrompt(promptName);
    if (!prompt) throw new Error(`Prompt not found: ${promptName}`);

    const systemPrompt = promptManager.renderTemplate(prompt.system_prompt, variables);
    const userPrompt = prompt.user_prompt_template
      ? promptManager.renderTemplate(prompt.user_prompt_template, variables)
      : request.userPrompt ?? '';

    return this.generate({
      ...request,
      systemPrompt,
      userPrompt,
      temperature: request.temperature ?? Number(prompt.temperature),
      maxTokens: request.maxTokens ?? prompt.max_tokens ?? undefined,
      providerOverride: request.providerOverride ?? (prompt.provider_override as AIProviderId | undefined),
      modelOverride: request.modelOverride ?? prompt.model_override ?? undefined,
    });
  }

  // ----------------------------------------------------------
  // Health + observability
  // ----------------------------------------------------------

  async checkHealth(): Promise<AIProviderHealth[]> {
    return aiHealthService.checkAll();
  }

  async getHealthSummary() {
    return aiHealthService.getSummary();
  }

  async getModels(): Promise<AIModelRecord[]> {
    return modelSelector.getAvailableModels();
  }

  async getCostSummary(workspaceId: string, dateFrom?: Date, dateTo?: Date): Promise<CostSummary> {
    return costManager.getCostSummary(workspaceId, dateFrom, dateTo);
  }

  async getUsageSummary(workspaceId: string, days?: number): Promise<UsageSummary> {
    return costManager.getUsageSummary(workspaceId, days);
  }

  async getDailyCost(workspaceId: string): Promise<number> {
    return costManager.getDailyCost(workspaceId);
  }

  async getMonthlyCost(workspaceId: string): Promise<number> {
    return costManager.getMonthlyCost(workspaceId);
  }

  // ----------------------------------------------------------
  // Prompt library access
  // ----------------------------------------------------------

  async getPrompts(): Promise<AIPromptRecord[]> {
    return promptManager.getAllPrompts();
  }

  async getPrompt(name: string): Promise<AIPromptRecord | null> {
    return promptManager.getPrompt(name);
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private resolveProvider(request: GatewayRequest): { provider: AIProviderId; model: string } {
    return modelSelector.resolve({
      providerOverride: request.providerOverride,
      modelOverride: request.modelOverride,
      agentName: request.agentName,
    });
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms),
      ),
    ]);
  }
}

export const aiGateway = new AIGateway();
