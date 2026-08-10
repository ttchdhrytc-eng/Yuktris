import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ProductionOpsDashboard } from '@/types/production-operations';

export const prodOpsKeys = {
  all: ['prod-ops'] as const,
  dashboard: (wsId: string) => ['prod-ops', 'dashboard', wsId] as const,
};

export function useProductionOpsDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: prodOpsKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [
        systemLogs, applicationLogs, perfMetrics, traces,
        queueJobs, queueWorkers, workerHealth, cacheMetrics,
        costTracking, resourceUsage,
        securityEvents, securityAlerts, mfaSessions,
        featureFlags, featureRollouts,
        releaseVersions, deploymentHistory, environmentConfigs,
        backupJobs, backupHistory, restoreHistory,
        systemHealth, systemIncidents, incidentTimelines,
        platformMetrics, systemSettings,
      ] = await Promise.all([
        supabase.from('system_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('application_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('system_performance_metrics').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(100),
        supabase.from('distributed_traces').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('queue_jobs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('queue_workers').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('worker_health').select('*').eq('workspace_id', workspace.id).order('checked_at', { ascending: false }).limit(50),
        supabase.from('cache_metrics').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(50),
        supabase.from('cost_tracking').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(100),
        supabase.from('resource_usage').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(100),
        supabase.from('security_events').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('security_alerts').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('mfa_sessions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('feature_flags').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('feature_rollouts').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('release_versions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('deployment_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('environment_configs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('backup_jobs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('backup_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('restore_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('system_health').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }),
        supabase.from('system_incidents').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('incident_timelines').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('platform_metrics').select('*').eq('workspace_id', workspace.id).order('metric_timestamp', { ascending: false }).limit(100),
        supabase.from('system_settings').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      ]);

      const allJobs = (queueJobs.data ?? []) as Array<Record<string, unknown>>;
      const allWorkers = (queueWorkers.data ?? []) as Array<Record<string, unknown>>;
      const allCosts = (costTracking.data ?? []) as Array<Record<string, unknown>>;
      const allAlerts = (securityAlerts.data ?? []) as Array<Record<string, unknown>>;
      const allIncidents = (systemIncidents.data ?? []) as Array<Record<string, unknown>>;
      const allHealth = (systemHealth.data ?? []) as Array<Record<string, unknown>>;
      const allFlags = (featureFlags.data ?? []) as Array<Record<string, unknown>>;
      const allDeployments = (deploymentHistory.data ?? []) as Array<Record<string, unknown>>;
      const allBackups = (backupHistory.data ?? []) as Array<Record<string, unknown>>;
      const allAppLogs = (applicationLogs.data ?? []) as Array<Record<string, unknown>>;
      const allPerfMetrics = (perfMetrics.data ?? []) as Array<Record<string, unknown>>;
      const allCacheMetrics = (cacheMetrics.data ?? []) as Array<Record<string, unknown>>;

      return {
        systemLogs: (systemLogs.data ?? []) as never[],
        applicationLogs: allAppLogs as never[],
        performanceMetrics: allPerfMetrics as never[],
        distributedTraces: (traces.data ?? []) as never[],
        queueJobs: allJobs as never[],
        queueWorkers: allWorkers as never[],
        workerHealth: (workerHealth.data ?? []) as never[],
        cacheMetrics: allCacheMetrics as never[],
        costTracking: allCosts as never[],
        resourceUsage: (resourceUsage.data ?? []) as never[],
        securityEvents: (securityEvents.data ?? []) as never[],
        securityAlerts: allAlerts as never[],
        mfaSessions: (mfaSessions.data ?? []) as never[],
        featureFlags: allFlags as never[],
        featureRollouts: (featureRollouts.data ?? []) as never[],
        releaseVersions: (releaseVersions.data ?? []) as never[],
        deploymentHistory: allDeployments as never[],
        environmentConfigs: (environmentConfigs.data ?? []) as never[],
        backupJobs: (backupJobs.data ?? []) as never[],
        backupHistory: allBackups as never[],
        restoreHistory: (restoreHistory.data ?? []) as never[],
        systemHealth: allHealth as never[],
        systemIncidents: allIncidents as never[],
        incidentTimelines: (incidentTimelines.data ?? []) as never[],
        platformMetrics: (platformMetrics.data ?? []) as never[],
        systemSettings: (systemSettings.data ?? []) as never[],
        totalJobs: allJobs.length,
        pendingJobs: allJobs.filter(j => j.status === 'pending').length,
        activeJobs: allJobs.filter(j => j.status === 'active').length,
        failedJobs: allJobs.filter(j => j.status === 'failed').length,
        deadLetterJobs: allJobs.filter(j => j.status === 'dead_letter').length,
        totalWorkers: allWorkers.length,
        activeWorkers: allWorkers.filter(w => w.status === 'idle' || w.status === 'busy').length,
        totalCost: allCosts.reduce((s, c) => s + (c.cost_amount as number), 0),
        aiSpend: allCosts.filter(c => c.cost_category === 'ai_spend').reduce((s, c) => s + (c.cost_amount as number), 0),
        apiUsageCost: allCosts.filter(c => c.cost_category === 'api_usage').reduce((s, c) => s + (c.cost_amount as number), 0),
        infrastructureCost: allCosts.filter(c => c.cost_category === 'infrastructure').reduce((s, c) => s + (c.cost_amount as number), 0),
        openAlerts: allAlerts.filter(a => a.alert_status === 'open' || a.alert_status === 'acknowledged').length,
        criticalAlerts: allAlerts.filter(a => a.alert_severity === 'critical' && a.alert_status !== 'resolved').length,
        activeIncidents: allIncidents.filter(i => i.incident_status !== 'resolved' && i.incident_status !== 'closed').length,
        overallHealthScore: allHealth.length > 0 ? allHealth.reduce((s, h) => s + (h.health_score as number), 0) / allHealth.length : 100,
        healthyComponents: allHealth.filter(h => h.health_status === 'healthy').length,
        degradedComponents: allHealth.filter(h => h.health_status === 'degraded').length,
        unhealthyComponents: allHealth.filter(h => h.health_status === 'unhealthy').length,
        totalFeatureFlags: allFlags.length,
        enabledFeatureFlags: allFlags.filter(f => f.is_enabled).length,
        activeDeployments: allDeployments.filter(d => d.deployment_status === 'in_progress').length,
        completedBackups: allBackups.filter(b => b.backup_status === 'completed').length,
        failedBackups: allBackups.filter(b => b.backup_status === 'failed').length,
        totalLogs: allAppLogs.length,
        errorLogs: allAppLogs.filter(l => l.log_level === 'error' || l.log_level === 'fatal').length,
        warningLogs: allAppLogs.filter(l => l.log_level === 'warn').length,
        avgResponseTime: allPerfMetrics.filter(m => m.metric_category === 'latency').length > 0
          ? allPerfMetrics.filter(m => m.metric_category === 'latency').reduce((s, m) => s + (m.metric_value as number), 0) / allPerfMetrics.filter(m => m.metric_category === 'latency').length
          : 0,
        cacheHitRatio: allCacheMetrics.length > 0
          ? allCacheMetrics.reduce((s, c) => s + (c.hit_ratio as number ?? 0), 0) / allCacheMetrics.length
          : 0,
        totalResourceUsage: (resourceUsage.data ?? []).length,
      } as ProductionOpsDashboard;
    },
    refetchInterval: 10000,
  });
}

// Queue mutations
export function useRetryJob() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('queue_jobs').update({ status: 'pending', attempts: 0, error_message: null, error_stack: null, updated_at: new Date().toISOString() }).eq('id', jobId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Job retried.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelJob() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('queue_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', jobId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Job cancelled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePurgeDeadLetter() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('queue_jobs').delete().eq('workspace_id', workspace.id).eq('status', 'dead_letter');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Dead letter queue purged.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Security mutations
export function useAcknowledgeAlert() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('security_alerts').update({ alert_status: 'acknowledged', acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', alertId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Alert acknowledged.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResolveAlert() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { alertId: string; notes?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('security_alerts').update({ alert_status: 'resolved', resolved_at: new Date().toISOString(), resolution_notes: params.notes ?? null, updated_at: new Date().toISOString() }).eq('id', params.alertId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Alert resolved.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Feature flag mutations
export function useToggleFeatureFlag() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { flagId: string; enabled: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('feature_flags').update({ is_enabled: params.enabled, updated_at: new Date().toISOString() }).eq('id', params.flagId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Feature flag toggled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateFeatureFlag() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { key: string; name: string; description?: string; type?: string; strategy?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('feature_flags').insert({
        workspace_id: workspace.id,
        flag_key: params.key,
        flag_name: params.name,
        flag_description: params.description ?? null,
        flag_type: params.type ?? 'boolean',
        is_enabled: false,
        rollout_strategy: params.strategy ?? 'off',
        rollout_percentage: 0,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Feature flag created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Deployment mutations
export function useCreateDeployment() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { environment: string; version?: string; strategy?: string; commitSha?: string; branch?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('deployment_history').insert({
        workspace_id: workspace.id,
        environment: params.environment,
        deployment_status: 'pending',
        deployment_strategy: params.strategy ?? 'rolling',
        commit_sha: params.commitSha ?? null,
        branch: params.branch ?? null,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Deployment created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRollbackDeployment() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deploymentId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('deployment_history').update({ deployment_status: 'rolled_back', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', deploymentId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Deployment rolled back.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Backup mutations
export function useCreateBackupJob() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; type: string; scheduleCron?: string; retentionDays?: number }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('backup_jobs').insert({
        workspace_id: workspace.id,
        job_name: params.name,
        backup_type: params.type,
        is_scheduled: !!params.scheduleCron,
        schedule_cron: params.scheduleCron ?? null,
        retention_days: params.retentionDays ?? 30,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Backup job created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTriggerBackup() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('backup_history').insert({
        workspace_id: workspace.id,
        backup_job_id: jobId,
        backup_status: 'pending',
        backup_type: 'database',
        started_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Backup triggered.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Incident mutations
export function useCreateIncident() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { title: string; description?: string; severity: string; type: string; affectedComponents?: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('system_incidents').insert({
        workspace_id: workspace.id,
        incident_title: params.title,
        incident_description: params.description ?? null,
        incident_severity: params.severity,
        incident_status: 'investigating',
        incident_type: params.type,
        affected_components: params.affectedComponents ?? [],
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Incident created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateIncidentStatus() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { incidentId: string; status: string; rootCause?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const update: Record<string, unknown> = { incident_status: params.status, updated_at: new Date().toISOString() };
      if (params.status === 'resolved') update.resolved_at = new Date().toISOString();
      if (params.rootCause) update.root_cause = params.rootCause;
      const { error } = await supabase.from('system_incidents').update(update).eq('id', params.incidentId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Incident updated.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddIncidentTimelineEvent() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { incidentId: string; eventType: string; message: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('incident_timelines').insert({
        workspace_id: workspace.id,
        incident_id: params.incidentId,
        event_type: params.eventType,
        event_message: params.message,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Timeline event added.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Environment config mutations
export function useCreateEnvConfig() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { environment: string; key: string; value: string; type?: string; isSecret?: boolean; description?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('environment_configs').insert({
        workspace_id: workspace.id,
        environment: params.environment,
        config_key: params.key,
        config_value: params.value,
        config_type: params.type ?? 'string',
        is_secret: params.isSecret ?? false,
        description: params.description ?? null,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Environment variable added.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Release version mutations
export function useCreateReleaseVersion() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { version: string; label?: string; channel?: string; notes?: string; breaking?: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('release_versions').insert({
        workspace_id: workspace.id,
        version_number: params.version,
        version_label: params.label ?? null,
        release_channel: params.channel ?? 'stable',
        release_notes: params.notes ?? null,
        is_breaking_change: params.breaking ?? false,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: prodOpsKeys.all }); toast.success('Release version created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
