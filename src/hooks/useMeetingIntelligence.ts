import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { meetingIntelligenceService } from '@/services/meeting-intelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const meetingIntelKeys = {
  all: ['meeting-intelligence'] as const,
  dashboard: (wsId: string) => ['meeting-intelligence', 'dashboard', wsId] as const,
  detail: (wsId: string, mId: string) => ['meeting-intelligence', 'detail', wsId, mId] as const,
};

export function useMeetingIntelligenceDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: meetingIntelKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return meetingIntelligenceService.loadDashboard(workspace.id);
    },
    refetchInterval: 10000,
  });
}

export function useDetectMeetingIntent() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.detectMeetingIntent(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting intent detected from conversations.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to detect meeting intent.'),
  });
}

export function useScheduleMeeting() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.scheduleMeeting(workspace.id, requestId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting scheduled automatically.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to schedule meeting.'),
  });
}

export function useConfirmMeeting() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { meetingId: string; confirmedBy?: 'prospect' | 'ai' | 'human' }) => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.confirmMeeting(workspace.id, params.meetingId, params.confirmedBy ?? 'ai');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting confirmed.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelMeeting() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { meetingId: string; reason?: string }) => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.cancelMeeting(workspace.id, params.meetingId, params.reason);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting cancelled.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateBrief() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.generateFullPreparation(workspace.id, meetingId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting brief generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecordOutcome() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { meetingId: string; outcome: Record<string, unknown> }) => {
      if (!workspace) throw new Error('No workspace');
      return meetingIntelligenceService.recordOutcome(workspace.id, params.meetingId, params.outcome as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingIntelKeys.all });
      toast.success('Meeting outcome recorded and follow-ups generated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
