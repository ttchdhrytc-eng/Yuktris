// ============================================================
// AgentExecutor — Executes individual agents and workflows
// ============================================================
//
// Handles single agent execution, multi-agent workflows (sequential
// and parallel), retry logic, timeout detection, and cancellation.

import { agentRegistry } from './AgentRegistry';
import { agentLogger } from './AgentLogger';
import { ExecutionContextBuilder } from './ExecutionContext';
import { sharedMemoryService } from './SharedMemoryService';
import { supabase } from '@/lib/supabase';
import { contextEngine } from '@/services/context';
import { memoryEngine } from '@/services/memory';
import type {
  ExecutionPlan,
  PlanStep,
  AgentExecutionResult,
  ExecutionEvent,
  EventHandler,
  AgentRegistryRecord,
} from '@/types/agent-orchestrator';

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

class AgentExecutor {
  // Execute a single agent by name
  async executeAgent(params: {
    agentName: string;
    input: Record<string, unknown>;
    workflowId?: string | null;
    workspaceId?: string | null;
    initialContext?: Record<string, unknown>;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
  }): Promise<AgentExecutionResult> {
    const agent = agentRegistry.get(params.agentName);
    if (!agent) {
      throw new Error(`Agent not registered: ${params.agentName}`);
    }

    // Get agent DB id for logging
    const { data: dbAgent } = await supabase
      .from('agent_registry')
      .select('id')
      .eq('agent_name', params.agentName)
      .maybeSingle();

    const agentDbId = (dbAgent as { id: string } | null)?.id ?? '';
    const executionId = crypto.randomUUID();
    const workflowId = params.workflowId ?? null;

    // Create execution context
    const context = ExecutionContextBuilder.create({
      executionId,
      workflowId,
      workspaceId: params.workspaceId ?? null,
      agentName: params.agentName,
      input: params.input,
      initialContext: params.initialContext as Record<string, unknown> | undefined,
      abortSignal: params.abortSignal,
    });

    // Build assembled context from the Context Engine (read path)
    const entityType = (params.input['entityType'] as string | undefined) ?? (params.input['entity_type'] as string | undefined);
    const entityId = (params.input['entityId'] as string | undefined) ?? (params.input['entity_id'] as string | undefined);
    if (entityType && entityId) {
      try {
        const { context: assembled } = await contextEngine.build({
          workspaceId: params.workspaceId ?? null,
          entityType,
          entityId,
          contextType: 'custom',
          sources: ['knowledge_graph', 'memory_engine', 'revenue_intelligence', 'research_intelligence', 'company_profile'],
          tokenBudget: 8000,
        });
        context.sharedContext.assembledContext = assembled;
      } catch {
        // Context build failure is non-fatal — agent proceeds without assembled context
      }
    }

    // Log start
    await agentLogger.logExecution({
      workspaceId: params.workspaceId ?? null,
      agentId: agentDbId,
      workflowId,
      status: 'running',
      inputPayload: params.input,
      executionTimeMs: 0,
      tokensUsed: 0,
      estimatedCost: 0,
    });

    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await this.withTimeout(
        agent.execute(context),
        params.timeoutMs ?? agent.definition.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
        params.abortSignal,
      );

      const executionTimeMs = Date.now() - startTime;

      // Store result in shared memory
      if (workflowId) {
        ExecutionContextBuilder.storeResult(workflowId, params.agentName, result);
      }

      // Persist agent output to Memory Engine (write path)
      if (entityType && entityId && result.status === 'completed' && result.output && Object.keys(result.output).length > 0) {
        try {
          await memoryEngine.store({
            entityType: entityType as import('@/types/memory-engine').EntityType,
            entityId,
            memoryType: 'agent' as import('@/types/memory-engine').MemoryType,
            title: `${params.agentName} output for ${entityType}:${entityId}`,
            summary: `${params.agentName} completed successfully`,
            content: result.output,
            confidenceScore: 0.8,
            importanceScore: 0.7,
            workspaceId: params.workspaceId ?? null,
          });
        } catch {
          // Memory store failure is non-fatal
        }
      }

      // Log completion
      await agentLogger.logExecution({
        workspaceId: params.workspaceId ?? null,
        agentId: agentDbId,
        workflowId,
        status: result.status,
        inputPayload: params.input,
        outputPayload: result.output,
        executionTimeMs,
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        errorMessage: result.error ?? null,
      });

      return { ...result, executionTimeMs };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Execution failed.';

      await agentLogger.logExecution({
        workspaceId: params.workspaceId ?? null,
        agentId: agentDbId,
        workflowId,
        status: 'failed',
        inputPayload: params.input,
        executionTimeMs,
        tokensUsed: 0,
        estimatedCost: 0,
        errorMessage,
      });

      return {
        agentName: params.agentName,
        status: 'failed',
        output: {},
        tokensUsed: 0,
        estimatedCost: 0,
        executionTimeMs,
        error: errorMessage,
      };
    }
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
    const workflowId = plan.planId;
    const results = new Map<string, AgentExecutionResult>();

    if (plan.steps.length === 0) {
      options.onEvent?.({ type: 'workflow_completed', results: {} });
      return {};
    }

    // Initialize shared memory
    sharedMemoryService.initialize(workflowId, options.initialContext as Record<string, unknown> | undefined);

    options.onEvent?.({ type: 'plan_created', plan });

    if (plan.mode === 'parallel') {
      // Execute all steps in parallel
      const promises = plan.steps.map((step) => this.executeStep(step, workflowId, options, results));
      await Promise.all(promises);
    } else {
      // Execute sequentially, respecting dependencies
      const completed = new Set<string>();

      while (completed.size < plan.steps.length) {
        // Find steps whose dependencies are all completed
        const ready = plan.steps.filter((step) => {
          if (completed.has(step.stepId)) return false;
          return step.dependsOn.every((dep) => completed.has(dep));
        });

        if (ready.length === 0) {
          // No steps ready — possible circular dependency or failed deps
          const remaining = plan.steps.filter((s) => !completed.has(s.stepId));
          for (const step of remaining) {
            options.onEvent?.({
              type: 'step_skipped',
              stepId: step.stepId,
              reason: 'Dependencies not satisfied.',
            });
            completed.add(step.stepId);
          }
          break;
        }

        // Execute ready steps (can be parallelized if multiple are ready)
        if (ready.length > 1) {
          const promises = ready.map((step) => this.executeStep(step, workflowId, options, results));
          await Promise.all(promises);
        } else {
          await this.executeStep(ready[0], workflowId, options, results);
        }

        for (const step of ready) {
          completed.add(step.stepId);
        }
      }
    }

    // Check for failures
    const failed = Array.from(results.entries()).filter(([, r]) => r.status !== 'completed');
    const resultObj: Record<string, AgentExecutionResult> = {};
    for (const [name, result] of results) {
      resultObj[name] = result;
    }

    if (failed.length > 0 && failed.length === results.size) {
      options.onEvent?.({ type: 'workflow_failed', error: 'All agents failed.', partialResults: resultObj });
    } else {
      options.onEvent?.({ type: 'workflow_completed', results: resultObj });
    }

    sharedMemoryService.clear(workflowId);
    return resultObj;
  }

  // Execute a single step within a workflow
  private async executeStep(
    step: PlanStep,
    workflowId: string,
    options: {
      workspaceId?: string | null;
      onEvent?: EventHandler;
      abortSignal?: AbortSignal;
    },
    results: Map<string, AgentExecutionResult>,
  ): Promise<void> {
    if (options.abortSignal?.aborted) {
      options.onEvent?.({ type: 'workflow_cancelled' });
      return;
    }

    options.onEvent?.({ type: 'step_started', stepId: step.stepId, agentName: step.agentName });

    // Retry logic
    let lastError: string | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeAgent({
          agentName: step.agentName,
          input: step.input,
          workflowId,
          workspaceId: options.workspaceId,
          abortSignal: options.abortSignal,
        });

        results.set(step.agentName, result);

        if (result.status === 'completed') {
          options.onEvent?.({ type: 'step_completed', stepId: step.stepId, agentName: step.agentName, result });
          return;
        }

        // If failed but not retriable, break
        if (result.status === 'failed' && attempt === MAX_RETRIES) {
          lastError = result.error ?? 'Unknown error';
          break;
        }

        // Retry
        lastError = result.error ?? 'Unknown error';
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Execution failed.';
        if (attempt === MAX_RETRIES) break;
      }
    }

    // All retries exhausted
    const failedResult: AgentExecutionResult = {
      agentName: step.agentName,
      status: 'failed',
      output: {},
      tokensUsed: 0,
      estimatedCost: 0,
      executionTimeMs: 0,
      error: lastError ?? 'Execution failed.',
    };
    results.set(step.agentName, failedResult);
    options.onEvent?.({ type: 'step_failed', stepId: step.stepId, agentName: step.agentName, error: lastError ?? 'Unknown error' });
  }

  // Execute with timeout and cancellation support
  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    abortSignal?: AbortSignal,
  ): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('Execution cancelled.');
    }

    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms);
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Execution cancelled.'));
        });
      }
    });

    return Promise.race([promise, timeout]);
  }
}

export const agentExecutor = new AgentExecutor();
