// ============================================================
// AI Gateway — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { aiGateway, promptManager } from '@/services/ai';
import type { AIPromptRecord, AIProviderId } from '@/types/ai-gateway';

// ============================================================
// Query Keys
// ============================================================

export const aiKeys = {
  all: ['ai'] as const,
  models: ['ai', 'models'] as const,
  health: ['ai', 'health'] as const,
  prompts: ['ai', 'prompts'] as const,
  prompt: (name: string) => [...aiKeys.all, 'prompt', name] as const,
  usage: (wsId: string) => [...aiKeys.all, 'usage', wsId] as const,
  costs: (wsId: string) => [...aiKeys.all, 'costs', wsId] as const,
  requests: (wsId: string) => [...aiKeys.all, 'requests', wsId] as const,
  dailyCost: (wsId: string) => [...aiKeys.all, 'daily-cost', wsId] as const,
  monthlyCost: (wsId: string) => [...aiKeys.all, 'monthly-cost', wsId] as const,
};

// ============================================================
// useAIModels — All available AI models
// ============================================================

export function useAIModels() {
  return useQuery({
    queryKey: aiKeys.models,
    queryFn: () => aiGateway.getModels(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// useAIHealth — Health status of all AI providers
// ============================================================

export function useAIHealth() {
  return useQuery({
    queryKey: aiKeys.health,
    queryFn: () => aiGateway.checkHealth(),
    refetchInterval: 60_000,
  });
}

// ============================================================
// usePromptLibrary — All active prompts
// ============================================================

export function usePromptLibrary() {
  return useQuery({
    queryKey: aiKeys.prompts,
    queryFn: () => aiGateway.getPrompts(),
    staleTime: 60_000,
  });
}

// ============================================================
// useAIUsage — Usage summary (daily + monthly)
// ============================================================

export function useAIUsage(days = 30) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...aiKeys.usage(workspace?.id ?? ''), days],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return aiGateway.getUsageSummary(workspace.id, days);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAICosts — Cost summary by provider, model, agent
// ============================================================

export function useAICosts() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: aiKeys.costs(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return aiGateway.getCostSummary(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAIRequests — Recent AI requests
// ============================================================

export function useAIRequests(limit = 50) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...aiKeys.requests(workspace?.id ?? ''), limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('ai_requests')
        .select('*')
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
// useAIDailyCost — Today's total cost
// ============================================================

export function useAIDailyCost() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: aiKeys.dailyCost(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return aiGateway.getDailyCost(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useAIMonthlyCost — This month's total cost
// ============================================================

export function useAIMonthlyCost() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: aiKeys.monthlyCost(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return aiGateway.getMonthlyCost(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useCreatePrompt — Create or update a prompt
// ============================================================

export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      promptName: string;
      description?: string;
      systemPrompt: string;
      userPromptTemplate?: string;
      temperature?: number;
      maxTokens?: number | null;
      providerOverride?: AIProviderId | null;
      modelOverride?: string | null;
    }) => {
      return promptManager.createPrompt(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.prompts });
      toast.success('Prompt saved.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save prompt.');
    },
  });
}

// ============================================================
// useTestPrompt — Test render a prompt with variables
// ============================================================

export function useTestPrompt() {
  return useMutation({
    mutationFn: async (params: {
      systemPrompt: string;
      userPromptTemplate?: string;
      variables: Record<string, string>;
    }) => {
      return promptManager.testPrompt(params);
    },
  });
}
