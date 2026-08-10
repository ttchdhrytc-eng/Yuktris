// ============================================================
// AI Gateway — Service Index + Provider Registration
// ============================================================
//
// This module registers every AI provider with the AIProviderRegistry.
// Future providers become available by adding a registration line
// here — no business logic changes needed.

import { aiProviderRegistry } from './AIProviderRegistry';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { GrokProvider } from './providers/GrokProvider';
import { MistralProvider } from './providers/MistralProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';

// ----------------------------------------------------------
// Register all providers
// ----------------------------------------------------------

aiProviderRegistry.register(new OpenAIProvider());
aiProviderRegistry.register(new ClaudeProvider());
aiProviderRegistry.register(new GeminiProvider());
aiProviderRegistry.register(new GrokProvider());
aiProviderRegistry.register(new OpenRouterProvider());
aiProviderRegistry.register(new MistralProvider());
aiProviderRegistry.register(new DeepSeekProvider());

// Set default provider
aiProviderRegistry.setDefaultProvider('openai');

// ----------------------------------------------------------
// Re-exports
// ----------------------------------------------------------

export { aiGateway } from './AIGateway';
export { aiProviderRegistry } from './AIProviderRegistry';
export { promptManager } from './PromptManager';
export { tokenManager } from './TokenManager';
export { costManager } from './CostManager';
export { modelSelector } from './ModelSelector';
export { aiHealthService } from './AIHealthService';
export { streamingManager } from './StreamingManager';
export { BaseAIProvider } from './BaseAIProvider';
export type {
  AIProviderId,
  AIProviderDefinition,
  AIModelRecord,
  AIRequestRecord,
  AIPromptRecord,
  GatewayRequest,
  GatewayResponse,
  GenerateTextParams,
  GenerateTextResult,
  GenerateStructuredParams,
  GenerateStructuredResult,
  GenerateEmbeddingParams,
  GenerateEmbeddingResult,
  AIProviderHealth,
  HealthStatus,
  ModelStatus,
  RequestStatus,
  RequestType,
  CostSummary,
  UsageSummary,
  PromptTemplate,
  PromptTestResult,
} from '@/types/ai-gateway';
