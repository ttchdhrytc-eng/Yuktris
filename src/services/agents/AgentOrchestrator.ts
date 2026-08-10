// ============================================================
// AgentOrchestrator — Central facade for all agent operations
// ============================================================
//
// This is the single entry point for all agent execution in the
// platform. No AI agent should execute directly — all requests
// flow through this orchestrator.
//
// The orchestrator handles:
//   - Agent discovery and routing
//   - Execution planning (single, sequential, parallel)
//   - Dependency resolution
//   - Shared context management
//   - Retry logic and timeout handling
//   - Execution logging and observability
//   - Health monitoring

import { agentRegistry } from './AgentRegistry';
import { agentPlanner } from './AgentPlanner';
import { agentExecutor } from './AgentExecutor';
import { agentHealthService } from './AgentHealthService';
import { agentLogger } from './AgentLogger';
import type {
  PlanRequest,
  ExecutionPlan,
  AgentExecutionResult,
  AgentHealth,
  AgentMetrics,
  OrchestratorSummary,
  AgentRegistryRecord,
  AgentDefinition,
  ExecutionEvent,
  EventHandler,
} from '@/types/agent-orchestrator';

class AgentOrchestrator {
  // ----------------------------------------------------------
  // Execution
  // ----------------------------------------------------------

  // Execute a single agent by name
  async executeAgent(params: {
    agentName: string;
    input: Record<string, unknown>;
    workspaceId?: string | null;
    initialContext?: Record<string, unknown>;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
  }): Promise<AgentExecutionResult> {
    return agentExecutor.executeAgent(params);
  }

  // Create an execution plan
  async plan(request: PlanRequest): Promise<ExecutionPlan> {
    return agentPlanner.plan(request);
  }

  // Execute a full workflow plan
  async executePlan(
    plan: ExecutionPlan,
    options: {
      workspaceId?: string | null;
      initialContext?: Record<string, unknown>;
      onEvent?: EventHandler;
      abortSignal?: AbortSignal;
    },
  ): Promise<Record<string, AgentExecutionResult>> {
    return agentExecutor.executePlan(plan, options);
  }

  // Convenience: plan + execute in one call
  async planAndExecute(
    request: PlanRequest,
    options?: {
      onEvent?: EventHandler;
      abortSignal?: AbortSignal;
    },
  ): Promise<Record<string, AgentExecutionResult>> {
    const plan = await this.plan(request);
    return this.executePlan(plan, {
      workspaceId: request.workspaceId ?? null,
      initialContext: request.sharedContext as Record<string, unknown> | undefined,
      onEvent: options?.onEvent,
      abortSignal: options?.abortSignal,
    });
  }

  // ----------------------------------------------------------
  // Discovery
  // ----------------------------------------------------------

  // Get all registered agent definitions (in-memory)
  getRegisteredAgents(): AgentDefinition[] {
    return agentRegistry.getAllDefinitions();
  }

  // Check if an agent is registered
  isAgentRegistered(agentName: string): boolean {
    return agentRegistry.has(agentName);
  }

  // Get all agents from the database
  async getAllAgents(): Promise<AgentRegistryRecord[]> {
    return agentRegistry.getAllFromDatabase();
  }

  // Get a single agent from the database
  async getAgent(agentName: string): Promise<AgentRegistryRecord | null> {
    return agentRegistry.getFromDatabase(agentName);
  }

  // ----------------------------------------------------------
  // Health & Metrics
  // ----------------------------------------------------------

  async getAgentHealth(agentName: string): Promise<AgentHealth> {
    return agentHealthService.getAgentHealth(agentName);
  }

  async getAllAgentHealth(): Promise<AgentHealth[]> {
    return agentHealthService.getAllHealth();
  }

  async getAgentMetrics(agentName: string): Promise<AgentMetrics> {
    return agentHealthService.getAgentMetrics(agentName);
  }

  async getSummary(): Promise<OrchestratorSummary> {
    return agentHealthService.getSummary();
  }

  // ----------------------------------------------------------
  // History
  // ----------------------------------------------------------

  async getExecutionHistory(params: {
    workspaceId?: string;
    agentId?: string;
    limit?: number;
  }) {
    return agentLogger.getHistory(params);
  }
}

export const agentOrchestrator = new AgentOrchestrator();
