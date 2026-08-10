// ============================================================
// AgentHealthService — Health monitoring for all agents
// ============================================================

import { supabase } from '@/lib/supabase';
import { agentRegistry } from './AgentRegistry';
import type { AgentHealth, AgentMetrics, OrchestratorSummary } from '@/types/agent-orchestrator';

class AgentHealthService {
  // Get health for a single agent
  async getAgentHealth(agentName: string): Promise<AgentHealth> {
    const { data: agent } = await supabase
      .from('agent_registry')
      .select('id, status')
      .eq('agent_name', agentName)
      .maybeSingle();

    if (!agent) {
      return {
        agent_name: agentName,
        healthy: false,
        status: 'unknown',
        last_execution_at: null,
        success_rate: 0,
        average_execution_time_ms: 0,
        total_executions: 0,
        error_count: 0,
      };
    }

    const agentRecord = agent as { id: string; status: string };

    const { data: executions } = await supabase
      .from('agent_executions')
      .select('status, execution_time_ms, created_at')
      .eq('agent_id', agentRecord.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const execs = (executions ?? []) as Array<{ status: string; execution_time_ms: number; created_at: string }>;
    const total = execs.length;
    const successful = execs.filter((e) => e.status === 'completed').length;
    const failed = execs.filter((e) => e.status === 'failed').length;
    const avgTime = total > 0 ? Math.round(execs.reduce((s, e) => s + e.execution_time_ms, 0) / total) : 0;
    const lastExec = execs[0]?.created_at ?? null;

    let healthStatus: AgentHealth['status'] = 'unknown';
    if (agentRecord.status === 'error') {
      healthStatus = 'down';
    } else if (total === 0) {
      healthStatus = 'unknown';
    } else if (successful / total >= 0.9) {
      healthStatus = 'healthy';
    } else if (successful / total >= 0.5) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'down';
    }

    return {
      agent_name: agentName,
      healthy: healthStatus === 'healthy',
      status: healthStatus,
      last_execution_at: lastExec,
      success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
      average_execution_time_ms: avgTime,
      total_executions: total,
      error_count: failed,
    };
  }

  // Get health for all registered agents
  async getAllHealth(): Promise<AgentHealth[]> {
    const names = agentRegistry.getNames();
    const results: AgentHealth[] = [];

    for (const name of names) {
      results.push(await this.getAgentHealth(name));
    }

    return results;
  }

  // Get detailed metrics for an agent
  async getAgentMetrics(agentName: string): Promise<AgentMetrics> {
    const { data: agent } = await supabase
      .from('agent_registry')
      .select('id')
      .eq('agent_name', agentName)
      .maybeSingle();

    if (!agent) {
      return {
        agent_name: agentName,
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        success_rate: 0,
        failure_rate: 0,
        average_execution_time_ms: 0,
        average_tokens: 0,
        average_cost: 0,
        total_tokens: 0,
        total_cost: 0,
        last_execution_at: null,
      };
    }

    const agentId = (agent as { id: string }).id;

    const { data: execs } = await supabase
      .from('agent_executions')
      .select('status, execution_time_ms, tokens_used, estimated_cost, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(500);

    const executions = (execs ?? []) as Array<{
      status: string;
      execution_time_ms: number;
      tokens_used: number;
      estimated_cost: number;
      created_at: string;
    }>;

    const total = executions.length;
    const successful = executions.filter((e) => e.status === 'completed').length;
    const failed = executions.filter((e) => e.status === 'failed').length;
    const totalTokens = executions.reduce((s, e) => s + e.tokens_used, 0);
    const totalCost = executions.reduce((s, e) => s + Number(e.estimated_cost), 0);
    const avgTime = total > 0 ? Math.round(executions.reduce((s, e) => s + e.execution_time_ms, 0) / total) : 0;

    return {
      agent_name: agentName,
      total_executions: total,
      successful_executions: successful,
      failed_executions: failed,
      success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
      failure_rate: total > 0 ? Math.round((failed / total) * 100) : 0,
      average_execution_time_ms: avgTime,
      average_tokens: total > 0 ? Math.round(totalTokens / total) : 0,
      average_cost: total > 0 ? Math.round((totalCost / total) * 1_000_000) / 1_000_000 : 0,
      total_tokens: totalTokens,
      total_cost: Math.round(totalCost * 1_000_000) / 1_000_000,
      last_execution_at: executions[0]?.created_at ?? null,
    };
  }

  // Get orchestrator-wide summary
  async getSummary(): Promise<OrchestratorSummary> {
    const allHealth = await this.getAllHealth();

    const { count: totalAgents } = await supabase
      .from('agent_registry')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { data: allExecs } = await supabase
      .from('agent_executions')
      .select('tokens_used, estimated_cost, execution_time_ms, status')
      .order('created_at', { ascending: false })
      .limit(1000);

    const execs = (allExecs ?? []) as Array<{
      tokens_used: number;
      estimated_cost: number;
      execution_time_ms: number;
      status: string;
    }>;

    const totalExecutions = execs.length;
    const totalCost = execs.reduce((s, e) => s + Number(e.estimated_cost), 0);
    const totalTokens = execs.reduce((s, e) => s + e.tokens_used, 0);
    const avgTime = totalExecutions > 0 ? Math.round(execs.reduce((s, e) => s + e.execution_time_ms, 0) / totalExecutions) : 0;
    const successful = execs.filter((e) => e.status === 'completed').length;
    const avgSuccessRate = totalExecutions > 0 ? Math.round((successful / totalExecutions) * 100) : 0;

    return {
      total_agents: totalAgents ?? 0,
      active_agents: totalAgents ?? 0,
      total_executions: totalExecutions,
      total_cost: Math.round(totalCost * 1_000_000) / 1_000_000,
      total_tokens: totalTokens,
      average_success_rate: avgSuccessRate,
      average_execution_time_ms: avgTime,
    };
  }
}

export const agentHealthService = new AgentHealthService();
