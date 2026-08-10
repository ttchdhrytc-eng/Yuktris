// ============================================================
// Agent Orchestrator — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { agentOrchestrator, agentRegistry } from '@/services/agents';
import { researchKeys } from './useResearchIntelligence';
import { memoryKeys } from './useMemoryEngine';
import { graphKeys } from './useKnowledgeGraph';
import type {
  PlanRequest,
  ExecutionPlan,
  AgentRegistryRecord,
  AgentHealth,
  AgentExecutionResult,
} from '@/types/agent-orchestrator';

// ============================================================
// Query Keys
// ============================================================

export const agentKeys = {
  all: ['agents'] as const,
  registry: ['agents', 'registry'] as const,
  agent: (name: string) => [...agentKeys.all, 'agent', name] as const,
  health: ['agents', 'health'] as const,
  history: (wsId: string) => [...agentKeys.all, 'history', wsId] as const,
  summary: ['agents', 'summary'] as const,
  metrics: (name: string) => [...agentKeys.all, 'metrics', name] as const,
};

// ============================================================
// useAgents — All registered agents from the database
// ============================================================

export function useAgents() {
  return useQuery({
    queryKey: agentKeys.registry,
    queryFn: () => agentOrchestrator.getAllAgents(),
    staleTime: 60_000,
  });
}

// ============================================================
// useAgent — Single agent by name
// ============================================================

export function useAgent(agentName: string) {
  return useQuery({
    queryKey: agentKeys.agent(agentName),
    enabled: !!agentName,
    queryFn: () => agentOrchestrator.getAgent(agentName),
    staleTime: 60_000,
  });
}

// ============================================================
// useAgentHealth — Health status of all agents
// ============================================================

export function useAgentHealth() {
  return useQuery({
    queryKey: agentKeys.health,
    queryFn: () => agentOrchestrator.getAllAgentHealth(),
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAgentHistory — Execution history for the workspace
// ============================================================

export function useAgentHistory(limit = 50) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...agentKeys.history(workspace?.id ?? ''), limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('agent_executions')
        .select('*, agent_registry(agent_name, category)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}

// ============================================================
// useAgentSummary — Orchestrator-wide summary metrics
// ============================================================

export function useAgentSummary() {
  return useQuery({
    queryKey: agentKeys.summary,
    queryFn: () => agentOrchestrator.getSummary(),
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAgentMetrics — Detailed metrics for a single agent
// ============================================================

export function useAgentMetrics(agentName: string) {
  return useQuery({
    queryKey: agentKeys.metrics(agentName),
    enabled: !!agentName,
    queryFn: () => agentOrchestrator.getAgentMetrics(agentName),
    refetchInterval: 60_000,
  });
}

// ============================================================
// useExecutionPlanner — Create an execution plan
// ============================================================

export function useExecutionPlanner() {
  return useMutation({
    mutationFn: async (request: PlanRequest) => {
      return agentOrchestrator.plan(request);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create execution plan.');
    },
  });
}

// ============================================================
// useAgentExecution — Execute a single agent
// ============================================================

export function useAgentExecution() {
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      agentName: string;
      input: Record<string, unknown>;
      initialContext?: Record<string, unknown>;
    }) => {
      return agentOrchestrator.executeAgent({
        ...params,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: (result: AgentExecutionResult) => {
      if (result.status === 'completed') {
        toast.success(`Agent "${result.agentName}" completed successfully.`);
      } else {
        toast.error(`Agent "${result.agentName}" failed: ${result.error ?? 'Unknown error'}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Agent execution failed.');
    },
  });
}

// ============================================================
// useAgentDependencies — Get dependencies for an agent
// ============================================================

export function useAgentDependencies(agentName: string) {
  return useQuery({
    queryKey: [...agentKeys.all, 'dependencies', agentName],
    enabled: !!agentName,
    queryFn: async () => {
      const { data: agent } = await supabase
        .from('agent_registry')
        .select('id')
        .eq('agent_name', agentName)
        .maybeSingle();

      if (!agent) return [];

      const { data: deps } = await supabase
        .from('agent_dependencies')
        .select('depends_on_agent_id, dependency_type')
        .eq('agent_id', (agent as { id: string }).id);

      if (!deps || deps.length === 0) return [];

      const depIds = deps as Array<{ depends_on_agent_id: string; dependency_type: string }>;
      const results: Array<{ agent_name: string; dependency_type: string }> = [];

      for (const dep of depIds) {
        const { data: depAgent } = await supabase
          .from('agent_registry')
          .select('agent_name')
          .eq('id', dep.depends_on_agent_id)
          .maybeSingle();
        if (depAgent) {
          results.push({
            agent_name: (depAgent as { agent_name: string }).agent_name,
            dependency_type: dep.dependency_type,
          });
        }
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// useResearchWorkflow — Run the 4-agent research workflow
// (website_research → company_intelligence → technology_detection → executive_summary)
// ============================================================

export function useResearchWorkflow() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyName: string;
      website?: string | null;
    }) => {
      const RESEARCH_AGENTS = [
        'website_research_agent',
        'company_intelligence_agent',
        'technology_detection_agent',
        'executive_summary_agent',
      ];

      return agentOrchestrator.planAndExecute(
        {
          taskDescription: 'website company intelligence technology executive summary',
          targetAgents: RESEARCH_AGENTS,
          input: {
            company_name: params.companyName,
            companyName: params.companyName,
            website: params.website ?? null,
            domain: params.website ?? null,
            url: params.website ?? null,
            entityType: 'company',
            entityId: params.companyName.toLowerCase().replace(/\s+/g, '-'),
          },
          mode: 'sequential',
          workspaceId: workspace?.id,
        },
      );
    },
    onSuccess: (results) => {
      const allCompleted = Object.values(results).every((r) => r.status === 'completed');
      if (allCompleted) {
        toast.success('Research workflow completed successfully.');
      } else {
        const failed = Object.entries(results)
          .filter(([, r]) => r.status !== 'completed')
          .map(([name]) => name);
        toast.warning(`Workflow completed with some failures: ${failed.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: researchKeys.all });
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Research workflow failed.');
    },
  });
}

// ============================================================
// useRegisteredAgents — All in-memory registered agent definitions
// ============================================================

export function useRegisteredAgents() {
  return useQuery({
    queryKey: [...agentKeys.all, 'registered'],
    queryFn: () => agentRegistry.getAllDefinitions(),
    staleTime: Infinity,
  });
}
