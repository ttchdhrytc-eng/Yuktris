// ============================================================
// Enterprise AI Gateway — Type Definitions
// ============================================================

// ============================================================
// Provider Identity
// ============================================================

export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'openrouter'
  | 'mistral'
  | 'deepseek'
  | 'local';

export type ModelType = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'vision';

export type ModelStatus = 'active' | 'deprecated' | 'preview' | 'disabled';

export type RequestType =
  | 'text'
  | 'structured'
  | 'json'
  | 'streaming'
  | 'embedding'
  | 'tool_call'
  | 'image_understanding'
  | 'token_count';

export type RequestStatus = 'success' | 'error' | 'timeout' | 'rate_limited' | 'cancelled';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// ============================================================
// Database Records
// ============================================================

export type AIModelRecord = {
  id: string;
  provider: AIProviderId;
  model_name: string;
  model_type: ModelType;
  context_window: number;
  supports_streaming: boolean;
  supports_tools: boolean;
  supports_images: boolean;
  supports_embeddings: boolean;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  status: ModelStatus;
  created_at: string;
  updated_at: string;
};

export type AIRequestRecord = {
  id: string;
  workspace_id: string | null;
  agent_name: string;
  provider: AIProviderId;
  model: string;
  request_type: RequestType;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  latency_ms: number;
  status: RequestStatus;
  error_message: string | null;
  created_at: string;
};

export type AIPromptRecord = {
  id: string;
  prompt_name: string;
  version: number;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string | null;
  temperature: number;
  max_tokens: number | null;
  provider_override: AIProviderId | null;
  model_override: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Provider Interface
// ============================================================

export type GenerateTextParams = {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
  images?: AIImage[];
};

export type GenerateTextResult = {
  content: string;
  toolCalls?: AIToolCall[];
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: AIProviderId;
};

export type GenerateStructuredParams = GenerateTextParams & {
  schema: Record<string, unknown>;
};

export type GenerateStructuredResult = {
  data: Record<string, unknown>;
  raw: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: AIProviderId;
};

export type GenerateEmbeddingParams = {
  model: string;
  input: string | string[];
};

export type GenerateEmbeddingResult = {
  embeddings: number[][];
  promptTokens: number;
  model: string;
  provider: AIProviderId;
};

export type CountTokensParams = {
  model: string;
  input: string;
};

export type CountTokensResult = {
  tokenCount: number;
  model: string;
};

export type AITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type AIImage = {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
};

export type AIProviderHealth = {
  provider: AIProviderId;
  healthy: boolean;
  status: HealthStatus;
  latency_ms: number | null;
  last_checked_at: string;
  error: string | null;
};

export type AIProviderDefinition = {
  id: AIProviderId;
  name: string;
  description: string;
  icon: string;
  color: string;
  models: string[];
  capabilities: AICapability[];
  priority: number;
};

export type AICapability =
  | 'generate_text'
  | 'generate_structured'
  | 'generate_json'
  | 'generate_streaming'
  | 'generate_embeddings'
  | 'tool_calling'
  | 'image_understanding'
  | 'token_counting'
  | 'health_check'
  | 'cost_calculation';

export type IAIProvider = {
  definition: AIProviderDefinition;
  initialize(): Promise<void>;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateStructured(params: GenerateStructuredParams): Promise<GenerateStructuredResult>;
  generateStreaming(params: GenerateTextParams): AsyncGenerator<string, void, unknown>;
  generateEmbeddings(params: GenerateEmbeddingParams): Promise<GenerateEmbeddingResult>;
  countTokens(params: CountTokensParams): Promise<CountTokensResult>;
  healthCheck(): Promise<AIProviderHealth>;
  calculateCost(promptTokens: number, completionTokens: number, model: string): number;
};

// ============================================================
// Gateway Request/Response
// ============================================================

export type GatewayRequest = {
  agentName: string;
  taskType?: RequestType;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  providerOverride?: AIProviderId;
  modelOverride?: string;
  tools?: AITool[];
  images?: AIImage[];
  schema?: Record<string, unknown>;
  stream?: boolean;
  workspaceId?: string;
};

export type GatewayResponse = {
  content: string;
  structuredData?: Record<string, unknown>;
  toolCalls?: AIToolCall[];
  provider: AIProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  finishReason: string;
};

// ============================================================
// Cost & Usage Aggregates
// ============================================================

export type CostSummary = {
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  by_provider: Record<string, { requests: number; cost: number; tokens: number }>;
  by_model: Record<string, { requests: number; cost: number; tokens: number }>;
  by_agent: Record<string, { requests: number; cost: number; tokens: number }>;
};

export type UsageSummary = {
  daily: Array<{ date: string; requests: number; cost: number; tokens: number }>;
  monthly: Array<{ month: string; requests: number; cost: number; tokens: number }>;
  total_requests: number;
  total_cost: number;
};

// ============================================================
// Prompt Management
// ============================================================

export type PromptTemplate = {
  prompt_name: string;
  version: number;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string | null;
  temperature: number;
  max_tokens: number | null;
  provider_override: AIProviderId | null;
  model_override: string | null;
};

export type PromptVariable = {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
};

export type PromptTestResult = {
  rendered_system: string;
  rendered_user: string;
  variables_resolved: number;
  variables_missing: string[];
};
