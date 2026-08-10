// ============================================================
// useQueueWorker — Triggers queue processing from the frontend
// ============================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-worker`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export function useProcessQueue() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchSize?: number) => {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          workspace_id: workspace?.id,
          batch_size: batchSize ?? 10,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Queue processing failed' }));
        throw new Error((err as Record<string, string>).error ?? `Failed (${response.status})`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-queue'] });
      queryClient.invalidateQueries({ queryKey: ['execution-queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['integration-failures'] });
    },
  });
}
