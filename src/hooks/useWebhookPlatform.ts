import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { WebhookPlatformDashboard } from '@/types/webhook-platform';

export const webhookPlatformKeys = {
  all: ['webhook-platform'] as const,
  dashboard: (wsId: string) => ['webhook-platform', 'dashboard', wsId] as const,
};

export function useWebhookPlatformDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: webhookPlatformKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [subs, events, deliveries, dlq, templates, secrets, replays] = await Promise.all([
        supabase.from('webhook_subscriptions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('webhook_events').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('webhook_deliveries').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('webhook_dead_letter_queue').select('*').eq('workspace_id', workspace.id).eq('is_replayed', false).order('created_at', { ascending: false }),
        supabase.from('webhook_templates').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('webhook_secrets').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('webhook_replay_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
      ]);
      const allDeliveries = (deliveries.data ?? []) as Array<Record<string, unknown>>;
      const successful = allDeliveries.filter((d) => (d as Record<string, unknown>).status === 'delivered').length;
      const failed = allDeliveries.filter((d) => (d as Record<string, unknown>).status === 'failed').length;
      const pending = allDeliveries.filter((d) => (d as Record<string, unknown>).status === 'pending').length;
      const avgLatency = allDeliveries.length > 0 ? allDeliveries.reduce((s, d) => s + ((d as Record<string, unknown>).latency_ms as number ?? 0), 0) / allDeliveries.length : 0;
      const today = new Date().toISOString().split('T')[0];
      const deliveriesToday = allDeliveries.filter((d) => (d as Record<string, unknown>).created_at as string >= today).length;
      return {
        subscriptions: (subs.data ?? []) as never[], events: (events.data ?? []) as never[],
        deliveries: allDeliveries as never[], deadLetters: (dlq.data ?? []) as never[],
        templates: (templates.data ?? []) as never[], secrets: (secrets.data ?? []) as never[],
        replayLogs: (replays.data ?? []) as never[],
        totalDeliveries: allDeliveries.length, successfulDeliveries: successful,
        failedDeliveries: failed, pendingDeliveries: pending,
        deadLetterCount: (dlq.data ?? []).length,
        successRate: allDeliveries.length > 0 ? (successful / allDeliveries.length) * 100 : 100,
        avgLatency, deliveriesToday,
      } as WebhookPlatformDashboard;
    },
    refetchInterval: 15000,
  });
}

export function useCreateWebhookSubscription() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; endpointUrl: string; events: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('webhook_subscriptions').insert({ workspace_id: workspace.id, subscription_name: params.name, endpoint_url: params.endpointUrl, events: params.events, is_active: true, retry_count: 3, retry_delay_seconds: 60, timeout_seconds: 30 }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: webhookPlatformKeys.all }); toast.success('I created a webhook subscription.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWebhookSubscription() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('webhook_subscriptions').delete().eq('id', subId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: webhookPlatformKeys.all }); toast.success('Webhook subscription deleted.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReplayWebhook() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-dispatcher`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, action: 'replay', delivery_id: deliveryId }) });
      if (!res.ok) throw new Error('Replay failed');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: webhookPlatformKeys.all }); toast.success('I replayed the webhook delivery.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePurgeDeadLetter() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dlqId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('webhook_dead_letter_queue').delete().eq('id', dlqId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: webhookPlatformKeys.all }); toast.success('Dead letter purged.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
