// ============================================================
// React Query Hooks — Conversation AI
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { conversationAIService, CONVERSATION_STAGES } from '@/services/conversation-ai';
import { agentOrchestrator } from '@/services/agents';
import type { FullConversation, ExportFormat } from '@/types/conversation-ai';

// ============================================================
// Query Keys
// ============================================================

export const conversationKeys = {
  all: ['conversation-ai'] as const,
  latest: (wsId: string) => [...conversationKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
};

// ============================================================
// useConversation — Load latest conversation for workspace
// ============================================================

export function useConversation() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: conversationKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullConversation | null> => {
      if (!workspace) return null;
      return conversationAIService.loadLatestConversation(workspace.id);
    },
  });
}

// ============================================================
// useAnalyzeConversation — Run full conversation analysis
// The conversation analysis pipeline uses mock data internally.
// Disabled until wired to real AI providers.
// ============================================================

export function useAnalyzeConversation() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { prospectIndex?: number }): Promise<FullConversation | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'email_writer_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Analysis failed');
      return conversationAIService.loadLatestConversation(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Analysis failed. Please try again.');
    },
  });
}

// ============================================================
// useGenerateResponse — Generate AI response
// Disabled until wired to real AI providers.
// ============================================================

export function useGenerateResponse() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { conversationId: string }): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'email_writer_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Response generation failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Response generation failed.');
    },
  });
}

// ============================================================
// useRefreshConversation — Refresh conversation analysis
// ============================================================

export function useRefreshConversation() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_conversationId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'email_writer_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useExportConversation — Export conversation data
// ============================================================

export function useExportConversation() {
  return useMutation({
    mutationFn: async (params: { conversation: FullConversation; format: ExportFormat }): Promise<void> => {
      const config = conversationAIService.exportConversation(params.conversation, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Conversation exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteConversation — Delete a conversation
// ============================================================

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      await conversationAIService.deleteConversation(conversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Conversation deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete conversation.');
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { CONVERSATION_STAGES };

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_CONVERSATIONS, MOCK_AI_RECOMMENDATIONS } from '@/services/conversation-ai/mockData';
import { useQuery } from '@tanstack/react-query';
import type { ConversationAIRecommendations, BANTQualification, ConversationHealth } from '@/types/conversation-ai';

export function useConversationAIRecommendations(prospectIndex: number) {
  return useQuery<ConversationAIRecommendations>({
    queryKey: ['conversation-ai', 'recommendations', prospectIndex],
    queryFn: async () => {
      const { MOCK_AI_RECOMMENDATIONS } = await import('@/services/conversation-ai/mockData');
      return MOCK_AI_RECOMMENDATIONS;
    },
  });
}

export function useBANTQualification(prospectIndex: number) {
  return useQuery<BANTQualification | null>({
    queryKey: ['conversation-ai', 'bant', prospectIndex],
    queryFn: async () => {
      const { MOCK_CONVERSATIONS } = await import('@/services/conversation-ai/mockData');
      return MOCK_CONVERSATIONS[prospectIndex]?.bant ?? null;
    },
  });
}

export function useConversationHealth(prospectIndex: number) {
  return useQuery<ConversationHealth | null>({
    queryKey: ['conversation-ai', 'health', prospectIndex],
    queryFn: async () => {
      const { MOCK_CONVERSATIONS } = await import('@/services/conversation-ai/mockData');
      return MOCK_CONVERSATIONS[prospectIndex]?.health ?? null;
    },
  });
}
