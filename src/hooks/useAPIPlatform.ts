import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { APIPlatformDashboard } from '@/types/api-platform';

export const apiPlatformKeys = {
  all: ['api-platform'] as const,
  dashboard: (wsId: string) => ['api-platform', 'dashboard', wsId] as const,
};

export function useAPIPlatformDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: apiPlatformKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [apiKeys, oauthClients, logs, usage, rateLimits, versions, devApps, devUsers, devOrgs, auditLogs, docs, sdks] = await Promise.all([
        supabase.from('api_keys_v2').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('api_oauth_clients').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('api_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('api_usage').select('*').eq('workspace_id', workspace.id).order('usage_date', { ascending: false }).limit(30),
        supabase.from('api_rate_limits').select('*').eq('workspace_id', workspace.id),
        supabase.from('api_versions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('developer_apps').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('developer_users').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('developer_organizations').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('developer_audit_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('api_documentation').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('sdk_versions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      ]);
      const allLogs = (logs.data ?? []) as Array<Record<string, unknown>>;
      const allUsage = (usage.data ?? []) as Array<Record<string, unknown>>;
      const totalRequests = allUsage.reduce((s, u) => s + (u.request_count as number), 0);
      const totalTokens = allUsage.reduce((s, u) => s + (u.total_tokens as number), 0);
      const totalCost = allUsage.reduce((s, u) => s + (u.total_cost as number), 0);
      const totalErrors = allLogs.filter((l) => (l.status_code as number) >= 400).length;
      const avgLatency = allLogs.length > 0 ? allLogs.reduce((s, l) => s + (l.latency_ms as number ?? 0), 0) / allLogs.length : 0;
      const today = new Date().toISOString().split('T')[0];
      const requestsToday = allUsage.filter((u) => (u.usage_date as string) === today).reduce((s, u) => s + (u.request_count as number), 0);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const requestsThisMonth = allUsage.filter((u) => (u.usage_date as string).startsWith(thisMonth)).reduce((s, u) => s + (u.request_count as number), 0);
      return {
        apiKeys: (apiKeys.data ?? []) as never[], oauthClients: (oauthClients.data ?? []) as never[],
        logs: allLogs as never[], usage: allUsage as never[],
        rateLimits: (rateLimits.data ?? []) as never[], versions: (versions.data ?? []) as never[],
        developerApps: (devApps.data ?? []) as never[], developerUsers: (devUsers.data ?? []) as never[],
        developerOrgs: (devOrgs.data ?? []) as never[], auditLogs: (auditLogs.data ?? []) as never[],
        documentation: (docs.data ?? []) as never[], sdkVersions: (sdks.data ?? []) as never[],
        totalRequests, totalErrors, totalTokens, totalCost,
        activeKeys: (apiKeys.data ?? []).filter((k) => (k as Record<string, unknown>).is_active).length,
        activeApps: (devApps.data ?? []).filter((a) => (a as Record<string, unknown>).is_active).length,
        activeOrgs: (devOrgs.data ?? []).filter((o) => (o as Record<string, unknown>).org_status === 'active').length,
        avgLatency, errorRate: allLogs.length > 0 ? (totalErrors / allLogs.length) * 100 : 0,
        requestsToday, requestsThisMonth,
      } as APIPlatformDashboard;
    },
    refetchInterval: 15000,
  });
}

export function useCreateAPIKey() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; scopes?: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      const rawKey = `ei_${crypto.randomUUID().replace(/-/g, '')}${Date.now().toString(36)}`;
      const keyPrefix = rawKey.slice(0, 12);
      const { data, error } = await supabase.from('api_keys_v2').insert({ workspace_id: workspace.id, key_name: params.name, key_prefix: keyPrefix, key_hash: rawKey, key_type: 'api_key', scopes: params.scopes ?? ['read', 'write'], is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return { key: rawKey, record: data };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('I generated a new API key.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeAPIKey() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('api_keys_v2').update({ is_active: false }).eq('id', keyId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('API key revoked.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateOAuthClient() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; redirectUris: string[]; scopes?: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      const clientId = `client_${crypto.randomUUID().replace(/-/g, '')}`;
      const clientSecret = `secret_${crypto.randomUUID().replace(/-/g, '')}`;
      const { data, error } = await supabase.from('api_oauth_clients').insert({ workspace_id: workspace.id, client_id: clientId, client_secret_hash: clientSecret, client_name: params.name, redirect_uris: params.redirectUris, scopes: params.scopes ?? ['read'], grant_types: ['authorization_code'], is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return { clientId, clientSecret, record: data };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('I created an OAuth client.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateDeveloperOrg() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; billingEmail?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data, error } = await supabase.from('developer_organizations').insert({ workspace_id: workspace.id, org_name: params.name, org_slug: slug, org_status: 'active', plan_tier: 'free', billing_email: params.billingEmail ?? null }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('I created a developer organization.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateOpenAPISpec() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openapi-generator`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id }) });
      if (!res.ok) throw new Error('Failed to generate OpenAPI spec');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('I generated the OpenAPI specification.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateSDK() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => {
      if (!workspace) throw new Error('No workspace');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sdk-generator`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }, body: JSON.stringify({ workspace_id: workspace.id, language }) });
      if (!res.ok) throw new Error('Failed to generate SDK');
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: apiPlatformKeys.all }); toast.success('I generated the SDK package.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
