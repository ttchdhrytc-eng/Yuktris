import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationIntelligenceService } from '@/services/conversation-intelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const conversationIntelKeys = {
  all: ['conversation-intelligence'] as const,
  dashboard: (wsId: string) => ['conversation-intelligence', 'dashboard', wsId] as const,
  detail: (wsId: string, convId: string) => ['conversation-intelligence', 'detail', wsId, convId] as const,
};

export function useConversationIntelligenceDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: conversationIntelKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return conversationIntelligenceService.loadDashboard(workspace.id);
    },
    refetchInterval: 10000,
  });
}

export function useAnalyzeConversations() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return conversationIntelligenceService.createConversationFromHistory(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationIntelKeys.all });
      toast.success('Conversations analyzed from LinkedIn history.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to analyze conversations.'),
  });
}

export function useIngestMessage() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      conversation_id: string;
      sender: 'prospect' | 'user' | 'ai';
      channel: string;
      content: string;
      message_type?: string;
    }) => {
      if (!workspace) throw new Error('No workspace');
      return conversationIntelligenceService.ingestMessage(workspace.id, params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationIntelKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
