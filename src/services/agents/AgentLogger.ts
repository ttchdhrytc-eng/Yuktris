// ============================================================
// AgentLogger — Centralized execution logging
// ============================================================
//
// Every agent execution is logged to the agent_executions table
// for observability, metrics, and audit trail.

import { supabase } from '@/lib/supabase';
import type { ExecutionStatus } from '@/types/agent-orchestrator';

class AgentLogger {
  async logExecution(params: {
    workspaceId?: string | null;
    agentId: string;
    workflowId?: string | null;
    status: ExecutionStatus;
    inputPayload?: Record<string, unknown> | null;
    outputPayload?: Record<string, unknown> | null;
    executionTimeMs: number;
    tokensUsed: number;
    estimatedCost: number;
    errorMessage?: string | null;
  }): Promise<string | null> {
    const { data, error } = await supabase
      .from('agent_executions')
      .insert({
        workspace_id: params.workspaceId ?? null,
        agent_id: params.agentId,
        workflow_id: params.workflowId ?? null,
        status: params.status,
        input_payload: params.inputPayload ?? null,
        output_payload: params.outputPayload ?? null,
        execution_time_ms: params.executionTimeMs,
        tokens_used: params.tokensUsed,
        estimated_cost: params.estimatedCost,
        error_message: params.errorMessage ?? null,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[AgentLogger] Failed to log execution:', error.message);
      return null;
    }

    return data?.id ?? null;
  }

  async updateExecution(
    executionId: string,
    updates: {
      status?: ExecutionStatus;
      outputPayload?: Record<string, unknown> | null;
      executionTimeMs?: number;
      tokensUsed?: number;
      estimatedCost?: number;
      errorMessage?: string | null;
    },
  ): Promise<void> {
    const { error } = await supabase
      .from('agent_executions')
      .update(updates)
      .eq('id', executionId);

    if (error) {
      console.error('[AgentLogger] Failed to update execution:', error.message);
    }
  }

  async getHistory(params: {
    workspaceId?: string;
    agentId?: string;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    let query = supabase
      .from('agent_executions')
      .select('*, agent_registry(agent_name)')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50);

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
    if (params.agentId) query = query.eq('agent_id', params.agentId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load execution history: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }
}

export const agentLogger = new AgentLogger();
