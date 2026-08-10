import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export type IntegrationDashboard = {
  providers: Array<Record<string, unknown>>;
  connections: Array<Record<string, unknown>>;
  syncJobs: Array<Record<string, unknown>>;
  webhooks: Array<Record<string, unknown>>;
  logs: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  health: Array<Record<string, unknown>>;
  apiKeys: Array<Record<string, unknown>>;
  installs: Array<Record<string, unknown>>;
  marketplace: Array<Record<string, unknown>>;
};

export const integrationKeys = {
  all: ['enterprise-integration'] as const,
  dashboard: (wsId: string) => ['enterprise-integration', 'dashboard', wsId] as const,
};

export function useIntegrationDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: integrationKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [providers, connections, syncJobs, webhooks, logs, errors, health, apiKeys, installs, marketplace] = await Promise.all([
        supabase.from('integration_providers').select('*').eq('is_active', true).order('provider_name'),
        supabase.from('integration_connections').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('integration_sync_jobs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('integration_webhooks').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('integration_events').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('integration_errors').select('*').eq('workspace_id', workspace.id).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('integration_health').select('*').eq('workspace_id', workspace.id).order('last_check_at', { ascending: false }).limit(20),
        supabase.from('integration_api_keys_v2').select('*').eq('workspace_id', workspace.id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('integration_installs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('integration_marketplace').select('*').eq('is_active', true).order('app_name'),
      ]);
      return {
        providers: (providers.data ?? []) as Array<Record<string, unknown>>,
        connections: (connections.data ?? []) as Array<Record<string, unknown>>,
        syncJobs: (syncJobs.data ?? []) as Array<Record<string, unknown>>,
        webhooks: (webhooks.data ?? []) as Array<Record<string, unknown>>,
        logs: (logs.data ?? []) as Array<Record<string, unknown>>,
        errors: (errors.data ?? []) as Array<Record<string, unknown>>,
        health: (health.data ?? []) as Array<Record<string, unknown>>,
        apiKeys: (apiKeys.data ?? []) as Array<Record<string, unknown>>,
        installs: (installs.data ?? []) as Array<Record<string, unknown>>,
        marketplace: (marketplace.data ?? []) as Array<Record<string, unknown>>,
      } as IntegrationDashboard;
    },
    refetchInterval: 15000,
  });
}

export function useDiscoverIntegrations() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-orchestrator`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Failed to discover integrations');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I discovered all available integrations.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConnectProvider() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { providerKey: string; authData: Record<string, unknown> }) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-marketplace`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, provider_key: params.providerKey, auth_data: params.authData }) });
      if (!res.ok) throw new Error('Failed to connect provider');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I connected the integration.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisconnectProvider() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('integration_connections').update({ is_active: false, connection_status: 'disconnected' }).eq('id', connectionId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I disconnected the integration.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSyncData() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { connectionId: string; syncType?: string; entityType?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, connection_id: params.connectionId, sync_type: params.syncType ?? 'full', entity_type: params.entityType ?? 'all' }) });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I synced the data.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetrySync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from('integration_sync_jobs').update({ status: 'running', retry_count: (await supabase.from('integration_sync_jobs').select('retry_count').eq('id', jobId).single()).data?.retry_count + 1 }).eq('id', jobId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I retried the sync job.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMonitorHealth() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-monitor`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id }) });
      if (!res.ok) throw new Error('Health check failed');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I checked all integration health.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateAPIKey() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, action: 'create', params: { name, scopes: ['read', 'write'] } }) });
      if (!res.ok) throw new Error('Failed to generate API key');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I generated a new API key.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRotateSecrets() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secret-manager`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, connection_id: connectionId, action: 'rotate' }) });
      if (!res.ok) throw new Error('Failed to rotate secrets');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I rotated the credentials.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResolveConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conflictId: string) => {
      const { error } = await supabase.from('integration_conflicts').update({ resolution_status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', conflictId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: integrationKeys.all }); toast.success('I resolved the conflict.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
