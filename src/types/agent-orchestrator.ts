// ============================================================
// Enterprise Agent Orchestrator — Type Definitions
// ============================================================

import type { AssembledContext } from '@/types/context-engine';

// ============================================================
// Agent Identity
// ============================================================

export type AgentCategory =
  | 'research'
  | 'intelligence'
  | 'scoring'
  | 'generation'
  | 'communication'
  | 'crm'
  | 'scheduling'
  | 'analysis'
  | 'workflow';

export type AgentStatus = 'active' | 'inactive' | 'deprecated' | 'error';

export type AgentHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export type ExecutionStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type DependencyType = 'requires' | 'optional' | 'enhances';

export type ExecutionMode = 'single' | 'sequential' | 'parallel' | 'conditional';

// ============================================================
// Database Records
// ============================================================

export type AgentRegistryRecord = {
  id: string;
  agent_name: string;
  description: string | null;
  version: string;
  status: AgentStatus;
  category: AgentCategory;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  capabilities: string[];
  created_at: string;
  updated_at: string;
};

export type AgentExecutionRecord = {
  id: string;
  workspace_id: string | null;
  agent_id: string;
  workflow_id: string | null;
  status: ExecutionStatus;
  input_payload: Record<string, unknown> | null;
  output_payload: Record<string, unknown> | null;
  execution_time_ms: number;
  tokens_used: number;
  estimated_cost: number;
  error_message: string | null;
  created_at: string;
};

export type AgentDependencyRecord = {
  id: string;
  agent_id: string;
  depends_on_agent_id: string;
  dependency_type: DependencyType;
  created_at: string;
};

// ============================================================
// Agent Definition (in-memory registry)
// ============================================================

export type AgentDefinition = {
  agent_name: string;
  description: string;
  version: string;
  category: AgentCategory;
  capabilities: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  defaultTimeoutMs: number;
  maxRetries: number;
};

export type IAgent = {
  definition: AgentDefinition;
  execute(context: ExecutionContext): Promise<AgentExecutionResult>;
  validateInput(input: Record<string, unknown>): ValidationResult;
  validateOutput(output: Record<string, unknown>): ValidationResult;
};

// ============================================================
// Execution Context
// ============================================================

export type SharedContextData = {
  prospect?: Record<string, unknown>;
  company?: Record<string, unknown>;
  contacts?: Record<string, unknown>[];
  researchResults?: Record<string, unknown>;
  crmData?: Record<string, unknown>;
  calendarData?: Record<string, unknown>;
  emailHistory?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  previousAgentOutputs?: Record<string, AgentExecutionResult>;
  workflowMetadata?: Record<string, unknown>;
  assembledContext?: AssembledContext;
};

export type ExecutionContext = {
  executionId: string;
  workflowId: string | null;
  workspaceId: string | null;
  agentName: string;
  input: Record<string, unknown>;
  sharedContext: SharedContextData;
  abortSignal?: AbortSignal;
};

// ============================================================
// Execution Results
// ============================================================

export type AgentExecutionResult = {
  agentName: string;
  status: ExecutionStatus;
  output: Record<string, unknown>;
  tokensUsed: number;
  estimatedCost: number;
  executionTimeMs: number;
  error?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

// ============================================================
// Planning
// ============================================================

export type PlanRequest = {
  taskDescription: string;
  targetAgents?: string[];
  input: Record<string, unknown>;
  sharedContext?: SharedContextData;
  mode?: ExecutionMode;
  workspaceId?: string;
};

export type PlanStep = {
  stepId: string;
  agentName: string;
  dependsOn: string[];
  mode: ExecutionMode;
  input: Record<string, unknown>;
  optional: boolean;
};

export type ExecutionPlan = {
  planId: string;
  steps: PlanStep[];
  mode: ExecutionMode;
  estimatedSteps: number;
  estimatedTokens: number;
  estimatedCost: number;
};

// ============================================================
// Communication Events
// ============================================================

export type ExecutionEvent =
  | { type: 'plan_created'; plan: ExecutionPlan }
  | { type: 'step_started'; stepId: string; agentName: string }
  | { type: 'step_completed'; stepId: string; agentName: string; result: AgentExecutionResult }
  | { type: 'step_failed'; stepId: string; agentName: string; error: string }
  | { type: 'step_skipped'; stepId: string; reason: string }
  | { type: 'progress'; completedSteps: number; totalSteps: number }
  | { type: 'workflow_completed'; results: Record<string, AgentExecutionResult> }
  | { type: 'workflow_failed'; error: string; partialResults: Record<string, AgentExecutionResult> }
  | { type: 'workflow_cancelled' };

export type EventHandler = (event: ExecutionEvent) => void;

// ============================================================
// Health & Metrics
// ============================================================

export type AgentHealth = {
  agent_name: string;
  healthy: boolean;
  status: AgentHealthStatus;
  last_execution_at: string | null;
  success_rate: number;
  average_execution_time_ms: number;
  total_executions: number;
  error_count: number;
};

export type AgentMetrics = {
  agent_name: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  failure_rate: number;
  average_execution_time_ms: number;
  average_tokens: number;
  average_cost: number;
  total_tokens: number;
  total_cost: number;
  last_execution_at: string | null;
};

export type OrchestratorSummary = {
  total_agents: number;
  active_agents: number;
  total_executions: number;
  total_cost: number;
  total_tokens: number;
  average_success_rate: number;
  average_execution_time_ms: number;
};
