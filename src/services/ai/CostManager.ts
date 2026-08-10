// ============================================================
// CostManager — Cost tracking and aggregation
// ============================================================

import { supabase } from '@/lib/supabase';
import type { AIProviderId, CostSummary, UsageSummary } from '@/types/ai-gateway';

class CostManager {
  // Calculate cost for a single request
  calculateCost(
    promptTokens: number,
    completionTokens: number,
    inputCostPer1k: number,
    outputCostPer1k: number,
  ): number {
    const inputCost = (promptTokens / 1000) * inputCostPer1k;
    const outputCost = (completionTokens / 1000) * outputCostPer1k;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  // Get cost summary for a workspace over a date range
  async getCostSummary(workspaceId: string, dateFrom?: Date, dateTo?: Date): Promise<CostSummary> {
    let query = supabase
      .from('ai_requests')
      .select('provider, model, agent_name, estimated_cost, total_tokens')
      .eq('workspace_id', workspaceId);

    if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
    if (dateTo) query = query.lte('created_at', dateTo.toISOString());

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load cost data: ${error.message}`);

    const summary: CostSummary = {
      total_requests: 0,
      total_cost: 0,
      total_tokens: 0,
      by_provider: {},
      by_model: {},
      by_agent: {},
    };

    for (const row of (data ?? []) as Array<{
      provider: string;
      model: string;
      agent_name: string;
      estimated_cost: number;
      total_tokens: number;
    }>) {
      summary.total_requests++;
      summary.total_cost += Number(row.estimated_cost);
      summary.total_tokens += row.total_tokens;

      if (!summary.by_provider[row.provider]) {
        summary.by_provider[row.provider] = { requests: 0, cost: 0, tokens: 0 };
      }
      summary.by_provider[row.provider].requests++;
      summary.by_provider[row.provider].cost += Number(row.estimated_cost);
      summary.by_provider[row.provider].tokens += row.total_tokens;

      if (!summary.by_model[row.model]) {
        summary.by_model[row.model] = { requests: 0, cost: 0, tokens: 0 };
      }
      summary.by_model[row.model].requests++;
      summary.by_model[row.model].cost += Number(row.estimated_cost);
      summary.by_model[row.model].tokens += row.total_tokens;

      if (!summary.by_agent[row.agent_name]) {
        summary.by_agent[row.agent_name] = { requests: 0, cost: 0, tokens: 0 };
      }
      summary.by_agent[row.agent_name].requests++;
      summary.by_agent[row.agent_name].cost += Number(row.estimated_cost);
      summary.by_agent[row.agent_name].tokens += row.total_tokens;
    }

    return summary;
  }

  // Get usage over time (daily and monthly aggregates)
  async getUsageSummary(workspaceId: string, days = 30): Promise<UsageSummary> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const { data, error } = await supabase
      .from('ai_requests')
      .select('estimated_cost, total_tokens, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', dateFrom.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to load usage data: ${error.message}`);

    const dailyMap = new Map<string, { requests: number; cost: number; tokens: number }>();
    const monthlyMap = new Map<string, { requests: number; cost: number; tokens: number }>();

    for (const row of (data ?? []) as Array<{
      estimated_cost: number;
      total_tokens: number;
      created_at: string;
    }>) {
      const date = new Date(row.created_at);
      const dayKey = date.toISOString().split('T')[0];
      const monthKey = dayKey.substring(0, 7);

      if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, { requests: 0, cost: 0, tokens: 0 });
      const day = dailyMap.get(dayKey)!;
      day.requests++;
      day.cost += Number(row.estimated_cost);
      day.tokens += row.total_tokens;

      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { requests: 0, cost: 0, tokens: 0 });
      const month = monthlyMap.get(monthKey)!;
      month.requests++;
      month.cost += Number(row.estimated_cost);
      month.tokens += row.total_tokens;
    }

    return {
      daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
      monthly: Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v })),
      total_requests: (data ?? []).length,
      total_cost: (data ?? []).reduce((sum, r) => sum + Number((r as { estimated_cost: number }).estimated_cost), 0),
    };
  }

  // Get today's cost
  async getDailyCost(workspaceId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_requests')
      .select('estimated_cost')
      .eq('workspace_id', workspaceId)
      .gte('created_at', today.toISOString());

    if (error) return 0;
    return (data ?? []).reduce((sum, r) => sum + Number((r as { estimated_cost: number }).estimated_cost), 0);
  }

  // Get this month's cost
  async getMonthlyCost(workspaceId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase
      .from('ai_requests')
      .select('estimated_cost')
      .eq('workspace_id', workspaceId)
      .gte('created_at', monthStart.toISOString());

    if (error) return 0;
    return (data ?? []).reduce((sum, r) => sum + Number((r as { estimated_cost: number }).estimated_cost), 0);
  }
}

export const costManager = new CostManager();
