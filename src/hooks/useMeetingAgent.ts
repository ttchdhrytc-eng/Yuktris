// ============================================================
// React Query Hooks — Meeting Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { meetingAgentService } from '@/services/meeting-agent';
import { agentOrchestrator } from '@/services/agents';
import { MEETING_STAGES } from '@/types/meeting-agent';
import type { FullMeeting, ExportFormat } from '@/types/meeting-agent';

// ============================================================
// Query Keys
// ============================================================

export const meetingKeys = {
  all: ['meeting-agent'] as const,
  latest: (wsId: string) => [...meetingKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...meetingKeys.all, 'detail', id] as const,
};

// ============================================================
// useMeetings — Load latest meeting for workspace
// ============================================================

export function useMeetings() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: meetingKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullMeeting | null> => {
      if (!workspace) return null;
      return meetingAgentService.loadLatestMeeting(workspace.id);
    },
  });
}

// ============================================================
// useScheduleMeeting — Schedule a new meeting
// The meeting scheduling pipeline uses mock data internally.
// Disabled until wired to real calendar/AI providers.
// ============================================================

export function useScheduleMeeting() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { prospectIndex: number }): Promise<FullMeeting | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'meeting_preparation_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Scheduling failed');
      return meetingAgentService.loadLatestMeeting(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Scheduling failed. Please try again.');
    },
  });
}

// ============================================================
// useGenerateMeetingBrief — Generate AI meeting brief
// Disabled until wired to real AI providers.
// ============================================================

export function useGenerateMeetingBrief() {
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (_params: { prospectIndex: number }): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'meeting_preparation_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Brief generation failed');
    },
    onSuccess: () => {
      toast.success('Meeting brief generated successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Brief generation failed. Please try again.');
    },
  });
}

// ============================================================
// useRescheduleMeeting — Reschedule an existing meeting
// ============================================================

export function useRescheduleMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { meetingId: string; slotId: string }): Promise<void> => {
      await meetingAgentService.rescheduleMeeting(params.meetingId, params.slotId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
      toast.success('Meeting rescheduled successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Reschedule failed. Please try again.');
    },
  });
}

// ============================================================
// useCancelMeeting — Cancel an existing meeting
// ============================================================

export function useCancelMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string): Promise<void> => {
      await meetingAgentService.cancelMeeting(meetingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
      toast.success('Meeting cancelled successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Cancellation failed. Please try again.');
    },
  });
}

// ============================================================
// useExportMeeting — Export meeting data
// ============================================================

export function useExportMeeting() {
  return useMutation({
    mutationFn: async (params: { meeting: FullMeeting; format: ExportFormat }): Promise<void> => {
      const config = meetingAgentService.exportMeeting(params.meeting, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Meeting exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteMeeting — Delete a meeting
// ============================================================

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string): Promise<void> => {
      await meetingAgentService.deleteMeeting(meetingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingKeys.all });
      toast.success('Meeting deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete meeting.');
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { MEETING_STAGES };

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_MEETINGS, MOCK_MEETING_RECOMMENDATIONS } from '@/services/meeting-agent/mockData';
import { useQuery } from '@tanstack/react-query';
import type { MeetingAIRecommendations } from '@/types/meeting-agent';

export function useMeetingAIRecommendations(prospectIndex: number) {
  return useQuery<MeetingAIRecommendations>({
    queryKey: ['meeting-agent', 'recommendations', prospectIndex],
    queryFn: async () => {
      const { MOCK_MEETING_RECOMMENDATIONS } = await import('@/services/meeting-agent/mockData');
      return MOCK_MEETING_RECOMMENDATIONS;
    },
  });
}
