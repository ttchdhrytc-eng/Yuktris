import { useState } from 'react';
import { Activity, Server, Shield, Cpu, HardDrive, Network, Database, Zap, AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp, DollarSign, Gauge, Layers, RefreshCw, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import { useProductionOpsDashboard } from '@/hooks/useProductionOperations';
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'health', label: 'System Health', icon: Heart },
  { id: 'monitoring', label: 'Monitoring', icon: Gauge },
  { id: 'observability', label: 'Observability', icon: Layers },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'flags', label: 'Feature Flags', icon: ToggleLeft },
  { id: 'deployments', label: 'Deployments', icon: Rocket },
  { id: 'backups', label: 'Backups', icon: HardDrive },
  { id: 'queue', label: 'Queue Monitor', icon: ListOrdered },
  { id: 'incidents', label: 'Incident Center', icon: AlertTriangle },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server },
] as const;

import { Heart, ToggleLeft, Rocket, ListOrdered } from 'lucide-react';

type TabId = (typeof TABS)[number]['id'];

export function ProductionOperationsPage() {
  const { data: dash, isLoading } = useProductionOpsDashboard();
  const [tab, setTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Production Operations" description="Enterprise-grade observability, monitoring, security, and reliability for the entire platform." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div>
        <PageHeader title="Production Operations" description="Enterprise-grade observability, monitoring, security, and reliability for the entire platform." />
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
              <Activity className="h-8 w-8 text-brand-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-ink-500">Production Operations Platform</h3>
              <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Monitor system health, track performance metrics, manage security alerts, control feature flags, orchestrate deployments, manage backups, and respond to incidents — all from one operations center.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const healthColor = dash.overallHealthScore >= 90 ? 'text-success-400' : dash.overallHealthScore >= 70 ? 'text-warning-400' : 'text-error-400';
  const healthBg = dash.overallHealthScore >= 90 ? 'bg-success-500/10 border-success-500/20' : dash.overallHealthScore >= 70 ? 'bg-warning-500/10 border-warning-500/20' : 'bg-error-500/10 border-error-500/20';

  return (
    <div>
      <PageHeader title="Production Operations" description="Enterprise-grade observability, monitoring, security, and reliability for the entire platform." />
      <div className={cn('flex items-center gap-3 mb-6 rounded-xl border p-4', healthBg)}>
        <Gauge className={cn('h-5 w-5 shrink-0', healthColor)} />
        <div className="flex-1">
          <p className="text-sm text-ink-500">Platform Health Score: <span className={cn('font-bold', healthColor)}>{dash.overallHealthScore.toFixed(1)}/100</span> · {dash.healthyComponents} healthy · {dash.degradedComponents} degraded · {dash.unhealthyComponents} unhealthy</p>
          <p className="text-xs text-ink-500 mt-0.5">{dash.activeIncidents} active incidents · {dash.openAlerts} open security alerts · {dash.pendingJobs} pending jobs · {dash.failedJobs} failed jobs</p>
        </div>
      </div>
      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {tab === 'overview' && <OverviewTab dash={dash} />}
          {tab === 'health' && <HealthTab dash={dash} />}
          {tab === 'monitoring' && <MonitoringTab dash={dash} />}
          {tab === 'observability' && <ObservabilityTab dash={dash} />}
          {tab === 'security' && <SecurityTab dash={dash} />}
          {tab === 'flags' && <FeatureFlagsTab dash={dash} />}
          {tab === 'deployments' && <DeploymentsTab dash={dash} />}
          {tab === 'backups' && <BackupsTab dash={dash} />}
          {tab === 'queue' && <QueueTab dash={dash} />}
          {tab === 'incidents' && <IncidentsTab dash={dash} />}
          {tab === 'performance' && <PerformanceTab dash={dash} />}
          {tab === 'infrastructure' && <InfrastructureTab dash={dash} />}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', tone ?? 'text-brand-400')} />
        <span className="text-xs text-ink-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink-500">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </Card>
  );
}

function OverviewTab({ dash }: { dash: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Gauge} label="Health Score" value={`${dash.overallHealthScore.toFixed(1)}`} sub="out of 100" tone={dash.overallHealthScore >= 90 ? 'text-success-400' : dash.overallHealthScore >= 70 ? 'text-warning-400' : 'text-error-400'} />
        <StatCard icon={Activity} label="Total Jobs" value={dash.totalJobs} sub={`${dash.pendingJobs} pending · ${dash.activeJobs} active`} />
        <StatCard icon={Server} label="Workers" value={dash.totalWorkers} sub={`${dash.activeWorkers} active`} />
        <StatCard icon={DollarSign} label="Total Cost" value={`$${dash.totalCost.toFixed(2)}`} sub={`AI: $${dash.aiSpend.toFixed(2)}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="Open Alerts" value={dash.openAlerts} sub={`${dash.criticalAlerts} critical`} tone={dash.criticalAlerts > 0 ? 'text-error-400' : 'text-brand-400'} />
        <StatCard icon={AlertTriangle} label="Active Incidents" value={dash.activeIncidents} tone={dash.activeIncidents > 0 ? 'text-error-400' : 'text-success-400'} />
        <StatCard icon={ToggleLeft} label="Feature Flags" value={dash.totalFeatureFlags} sub={`${dash.enabledFeatureFlags} enabled`} />
        <StatCard icon={TrendingUp} label="Avg Latency" value={`${dash.avgResponseTime.toFixed(0)}ms`} sub={`Cache: ${(dash.cacheHitRatio * 100).toFixed(1)}%`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Incidents</h4>
          <div className="space-y-2">
            {dash.systemIncidents.length === 0 ? <p className="text-xs text-ink-500">No incidents recorded.</p> : dash.systemIncidents.slice(0, 5).map((inc: any) => (
              <div key={inc.id} className="flex items-start justify-between rounded-lg bg-card-900 p-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-500">{inc.incident_title}</p>
                  <p className="text-xs text-ink-500">{timeAgo(inc.created_at)} · {inc.incident_type}</p>
                </div>
                <Badge tone={inc.incident_status === 'resolved' ? 'success' : inc.incident_status === 'investigating' ? 'warning' : 'error'} dot>{inc.incident_status}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Security Alerts</h4>
          <div className="space-y-2">
            {dash.securityAlerts.length === 0 ? <p className="text-xs text-ink-500">No security alerts.</p> : dash.securityAlerts.slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex items-start justify-between rounded-lg bg-card-900 p-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-500">{a.alert_title}</p>
                  <p className="text-xs text-ink-500">{timeAgo(a.created_at)} · {a.alert_type}</p>
                </div>
                <Badge tone={a.alert_severity === 'critical' ? 'error' : a.alert_severity === 'high' ? 'warning' : 'neutral'} dot>{a.alert_severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HealthTab({ dash }: { dash: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle2} label="Healthy" value={dash.healthyComponents} tone="text-success-400" />
        <StatCard icon={AlertTriangle} label="Degraded" value={dash.degradedComponents} tone="text-warning-400" />
        <StatCard icon={XCircle} label="Unhealthy" value={dash.unhealthyComponents} tone="text-error-400" />
        <StatCard icon={Gauge} label="Overall Score" value={`${dash.overallHealthScore.toFixed(1)}`} tone="text-brand-400" />
      </div>
      <div className="space-y-2">
        {dash.systemHealth.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No health data. Run a system monitor to populate.</p> : dash.systemHealth.map((h: any) => (
          <Card key={h.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', h.health_status === 'healthy' ? 'bg-success-500/10' : h.health_status === 'degraded' ? 'bg-warning-500/10' : 'bg-error-500/10')}>
                  {h.health_status === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : h.health_status === 'degraded' ? <AlertTriangle className="h-4 w-4 text-warning-400" /> : <XCircle className="h-4 w-4 text-error-400" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-500 capitalize">{h.component_name.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink-500">{h.response_time_ms ?? 'N/A'}ms · {h.error_rate ?? 0}% error · {timeAgo(h.last_check_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-lg font-bold', h.health_score >= 90 ? 'text-success-400' : h.health_score >= 70 ? 'text-warning-400' : 'text-error-400')}>{h.health_score.toFixed(0)}</span>
                <Badge tone={h.health_status === 'healthy' ? 'success' : h.health_status === 'degraded' ? 'warning' : 'error'} dot>{h.health_status}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MonitoringTab({ dash }: { dash: any }) {
  const workers = dash.queueWorkers as any[];
  const health = dash.workerHealth as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Active Workers" value={dash.activeWorkers} sub={`${dash.totalWorkers} total`} />
        <StatCard icon={Activity} label="Pending Jobs" value={dash.pendingJobs} sub={`${dash.activeJobs} active`} />
        <StatCard icon={XCircle} label="Failed Jobs" value={dash.failedJobs} sub={`${dash.deadLetterJobs} dead letter`} />
        <StatCard icon={Gauge} label="Cache Hit Ratio" value={`${(dash.cacheHitRatio * 100).toFixed(1)}%`} tone="text-brand-400" />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Worker Status</h4>
        <div className="space-y-2">
          {workers.length === 0 ? <p className="text-xs text-ink-500">No workers registered.</p> : workers.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{w.worker_name}</p>
                  <p className="text-xs text-ink-500">{w.worker_type} · {w.jobs_completed} completed · {w.jobs_failed} failed</p>
                </div>
              </div>
              <Badge tone={w.status === 'idle' ? 'success' : w.status === 'busy' ? 'brand' : w.status === 'error' ? 'error' : 'neutral'} dot>{w.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Resource Usage</h4>
        <div className="space-y-2">
          {(dash.resourceUsage as any[]).slice(0, 10).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{r.resource_name}</p>
                  <p className="text-xs text-ink-500">{r.resource_type} · {r.usage_value} {r.usage_unit}</p>
                </div>
              </div>
              {r.usage_percent != null && <span className={cn('text-sm font-bold', r.usage_percent >= 90 ? 'text-error-400' : r.usage_percent >= 70 ? 'text-warning-400' : 'text-success-400')}>{r.usage_percent.toFixed(1)}%</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ObservabilityTab({ dash }: { dash: any }) {
  const logs = dash.applicationLogs as any[];
  const traces = dash.distributedTraces as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Layers} label="Total Logs" value={dash.totalLogs} />
        <StatCard icon={XCircle} label="Error Logs" value={dash.errorLogs} tone={dash.errorLogs > 0 ? 'text-error-400' : 'text-success-400'} />
        <StatCard icon={AlertTriangle} label="Warning Logs" value={dash.warningLogs} tone="text-warning-400" />
        <StatCard icon={Activity} label="Traces" value={traces.length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Application Logs</h4>
        <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
          {logs.length === 0 ? <p className="text-xs text-ink-500">No application logs.</p> : logs.slice(0, 30).map((l: any) => (
            <div key={l.id} className="flex items-start gap-2 rounded-lg bg-card-900 p-2 text-xs">
              <Badge tone={l.log_level === 'error' || l.log_level === 'fatal' ? 'error' : l.log_level === 'warn' ? 'warning' : 'neutral'}>{l.log_level}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-ink-500 font-mono truncate">{l.log_message}</p>
                <p className="text-ink-500">{l.source_module} · {l.log_category} · {timeAgo(l.created_at)}{l.duration_ms ? ` · ${l.duration_ms}ms` : ''}</p>
              </div>
              {l.correlation_id && <span className="text-ink-500 font-mono text-[10px] shrink-0">{l.correlation_id.slice(0, 8)}</span>}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Traces</h4>
        <div className="space-y-2">
          {traces.length === 0 ? <p className="text-xs text-ink-500">No traces recorded.</p> : traces.slice(0, 10).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500 font-mono">{t.service_name}::{t.operation_name}</p>
                  <p className="text-xs text-ink-500 font-mono">trace: {t.trace_id.slice(0, 12)}... · span: {t.span_id.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500">{t.duration_ms ?? 0}ms</span>
                <Badge tone={t.span_status === 'ok' ? 'success' : 'error'}>{t.span_status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SecurityTab({ dash }: { dash: any }) {
  const events = dash.securityEvents as any[];
  const alerts = dash.securityAlerts as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="Security Events" value={events.length} />
        <StatCard icon={AlertTriangle} label="Open Alerts" value={dash.openAlerts} tone={dash.openAlerts > 0 ? 'text-error-400' : 'text-success-400'} />
        <StatCard icon={XCircle} label="Critical Alerts" value={dash.criticalAlerts} tone={dash.criticalAlerts > 0 ? 'text-error-400' : 'text-success-400'} />
        <StatCard icon={CheckCircle2} label="MFA Sessions" value={(dash.mfaSessions as any[]).length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Security Alerts</h4>
        <div className="space-y-2">
          {alerts.length === 0 ? <p className="text-xs text-ink-500">No security alerts.</p> : alerts.slice(0, 10).map((a: any) => (
            <div key={a.id} className="flex items-start justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Shield className={cn('h-4 w-4', a.alert_severity === 'critical' ? 'text-error-400' : a.alert_severity === 'high' ? 'text-warning-400' : 'text-brand-400')} />
                <div>
                  <p className="text-sm font-medium text-ink-500">{a.alert_title}</p>
                  <p className="text-xs text-ink-500">{a.alert_type} · {timeAgo(a.created_at)}</p>
                </div>
              </div>
              <Badge tone={a.alert_status === 'resolved' ? 'success' : a.alert_status === 'open' ? 'error' : 'warning'} dot>{a.alert_status}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Security Events</h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
          {events.length === 0 ? <p className="text-xs text-ink-500">No security events.</p> : events.slice(0, 20).map((e: any) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg bg-card-900 p-2 text-xs">
              <Badge tone={e.event_severity === 'critical' ? 'error' : e.event_severity === 'high' ? 'warning' : 'neutral'}>{e.event_severity}</Badge>
              <span className="text-ink-500 flex-1">{e.event_type.replace(/_/g, ' ')}</span>
              <span className="text-ink-500">{e.event_source} · {timeAgo(e.created_at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FeatureFlagsTab({ dash }: { dash: any }) {
  const flags = dash.featureFlags as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ToggleLeft} label="Total Flags" value={dash.totalFeatureFlags} />
        <StatCard icon={CheckCircle2} label="Enabled" value={dash.enabledFeatureFlags} tone="text-success-400" />
        <StatCard icon={XCircle} label="Disabled" value={dash.totalFeatureFlags - dash.enabledFeatureFlags} tone="text-ink-500" />
        <StatCard icon={Zap} label="Kill Switches" value={flags.filter((f: any) => f.is_kill_switch).length} tone="text-error-400" />
      </div>
      <div className="space-y-2">
        {flags.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No feature flags configured.</p> : flags.map((f: any) => (
          <Card key={f.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ToggleLeft className={cn('h-4 w-4', f.is_enabled ? 'text-success-400' : 'text-ink-500')} />
                <div>
                  <p className="text-sm font-medium text-ink-500">{f.flag_name}</p>
                  <p className="text-xs text-ink-500 font-mono">{f.flag_key} · {f.rollout_strategy} · {f.rollout_percentage}%</p>
                </div>
              </div>
              <Badge tone={f.is_enabled ? 'success' : 'neutral'} dot>{f.is_enabled ? 'Enabled' : 'Disabled'}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeploymentsTab({ dash }: { dash: any }) {
  const deployments = dash.deploymentHistory as any[];
  const versions = dash.releaseVersions as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Rocket} label="Active Deploys" value={dash.activeDeployments} tone={dash.activeDeployments > 0 ? 'text-brand-400' : 'text-ink-500'} />
        <StatCard icon={CheckCircle2} label="Succeeded" value={deployments.filter((d: any) => d.deployment_status === 'succeeded').length} tone="text-success-400" />
        <StatCard icon={XCircle} label="Failed" value={deployments.filter((d: any) => d.deployment_status === 'failed').length} tone="text-error-400" />
        <StatCard icon={RefreshCw} label="Rollbacks" value={deployments.filter((d: any) => d.deployment_status === 'rolled_back').length} tone="text-warning-400" />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Deployment History</h4>
        <div className="space-y-2">
          {deployments.length === 0 ? <p className="text-xs text-ink-500">No deployments recorded.</p> : deployments.slice(0, 15).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{d.environment} · {d.deployment_strategy}</p>
                  <p className="text-xs text-ink-500 font-mono">{d.commit_sha ? d.commit_sha.slice(0, 7) : 'N/A'} · {d.branch ?? 'N/A'} · {timeAgo(d.created_at)}</p>
                </div>
              </div>
              <Badge tone={d.deployment_status === 'succeeded' ? 'success' : d.deployment_status === 'failed' ? 'error' : d.deployment_status === 'rolled_back' ? 'warning' : 'brand'} dot>{d.deployment_status}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Release Versions</h4>
        <div className="space-y-2">
          {versions.length === 0 ? <p className="text-xs text-ink-500">No release versions.</p> : versions.slice(0, 10).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">v{v.version_number} {v.version_label ? `· ${v.version_label}` : ''}</p>
                  <p className="text-xs text-ink-500">{v.release_channel} · {timeAgo(v.created_at)}{v.is_breaking_change ? ' · breaking' : ''}</p>
                </div>
              </div>
              <Badge tone={v.is_deployed ? 'success' : 'neutral'} dot>{v.is_deployed ? 'Deployed' : 'Not Deployed'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BackupsTab({ dash }: { dash: any }) {
  const jobs = dash.backupJobs as any[];
  const history = dash.backupHistory as any[];
  const restores = dash.restoreHistory as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={HardDrive} label="Backup Jobs" value={jobs.length} />
        <StatCard icon={CheckCircle2} label="Completed" value={dash.completedBackups} tone="text-success-400" />
        <StatCard icon={XCircle} label="Failed" value={dash.failedBackups} tone="text-error-400" />
        <StatCard icon={RefreshCw} label="Restores" value={restores.length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Backup Jobs</h4>
        <div className="space-y-2">
          {jobs.length === 0 ? <p className="text-xs text-ink-500">No backup jobs configured.</p> : jobs.map((j: any) => (
            <div key={j.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{j.job_name}</p>
                  <p className="text-xs text-ink-500">{j.backup_type} · {j.retention_days}d retention · {j.is_scheduled ? `cron: ${j.schedule_cron}` : 'manual'}</p>
                </div>
              </div>
              <Badge tone={j.is_active ? 'success' : 'neutral'} dot>{j.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Backups</h4>
        <div className="space-y-2">
          {history.length === 0 ? <p className="text-xs text-ink-500">No backup history.</p> : history.slice(0, 10).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{b.backup_type} backup</p>
                  <p className="text-xs text-ink-500">{b.backup_size_bytes ? `${(b.backup_size_bytes / 1024 / 1024).toFixed(1)} MB · ` : ''}{timeAgo(b.created_at)} · {b.duration_seconds ?? 0}s</p>
                </div>
              </div>
              <Badge tone={b.backup_status === 'completed' ? 'success' : b.backup_status === 'failed' ? 'error' : 'brand'} dot>{b.backup_status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function QueueTab({ dash }: { dash: any }) {
  const jobs = dash.queueJobs as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ListOrdered} label="Total Jobs" value={dash.totalJobs} />
        <StatCard icon={Clock} label="Pending" value={dash.pendingJobs} tone="text-warning-400" />
        <StatCard icon={Activity} label="Active" value={dash.activeJobs} tone="text-brand-400" />
        <StatCard icon={XCircle} label="Failed / Dead Letter" value={dash.failedJobs + dash.deadLetterJobs} tone="text-error-400" />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Job Queue</h4>
        <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
          {jobs.length === 0 ? <p className="text-xs text-ink-500">No jobs in queue.</p> : jobs.slice(0, 30).map((j: any) => (
            <div key={j.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{j.job_type}</p>
                  <p className="text-xs text-ink-500">{j.queue_name} · priority {j.priority} · attempt {j.attempts}/{j.max_attempts} · {timeAgo(j.created_at)}</p>
                </div>
              </div>
              <Badge tone={j.status === 'completed' ? 'success' : j.status === 'failed' || j.status === 'dead_letter' ? 'error' : j.status === 'active' ? 'brand' : 'warning'} dot>{j.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function IncidentsTab({ dash }: { dash: any }) {
  const incidents = dash.systemIncidents as any[];
  const timelines = dash.incidentTimelines as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Active" value={dash.activeIncidents} tone={dash.activeIncidents > 0 ? 'text-error-400' : 'text-success-400'} />
        <StatCard icon={CheckCircle2} label="Resolved" value={incidents.filter((i: any) => i.incident_status === 'resolved').length} tone="text-success-400" />
        <StatCard icon={Clock} label="Investigating" value={incidents.filter((i: any) => i.incident_status === 'investigating').length} tone="text-warning-400" />
        <StatCard icon={Activity} label="Timeline Events" value={timelines.length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Active Incidents</h4>
        <div className="space-y-2">
          {incidents.length === 0 ? <p className="text-xs text-ink-500">No incidents recorded.</p> : incidents.slice(0, 10).map((inc: any) => (
            <div key={inc.id} className="rounded-lg bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-ink-500">{inc.incident_title}</p>
                <Badge tone={inc.incident_severity === 'critical' || inc.incident_severity === 'catastrophic' ? 'error' : inc.incident_severity === 'major' ? 'warning' : 'neutral'} dot>{inc.incident_severity}</Badge>
              </div>
              <p className="text-xs text-ink-500">{inc.incident_type} · {inc.affected_components?.join(', ') || 'N/A'} · {timeAgo(inc.created_at)}</p>
              <div className="mt-1.5"><Badge tone={inc.incident_status === 'resolved' ? 'success' : inc.incident_status === 'investigating' ? 'warning' : 'brand'} dot>{inc.incident_status}</Badge></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PerformanceTab({ dash }: { dash: any }) {
  const metrics = dash.performanceMetrics as any[];
  const cache = dash.cacheMetrics as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Avg Latency" value={`${dash.avgResponseTime.toFixed(0)}ms`} />
        <StatCard icon={Gauge} label="Cache Hit" value={`${(dash.cacheHitRatio * 100).toFixed(1)}%`} tone="text-brand-400" />
        <StatCard icon={Activity} label="Metrics Recorded" value={metrics.length} />
        <StatCard icon={DollarSign} label="Total Cost" value={`$${dash.totalCost.toFixed(2)}`} sub={`AI: $${dash.aiSpend.toFixed(2)}`} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Performance Metrics</h4>
        <div className="space-y-2">
          {metrics.length === 0 ? <p className="text-xs text-ink-500">No performance metrics recorded.</p> : metrics.slice(0, 15).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{m.metric_name}</p>
                  <p className="text-xs text-ink-500">{m.metric_category} · {timeAgo(m.recorded_at)}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-ink-500">{m.metric_value} {m.metric_unit ?? ''}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Cache Performance</h4>
        <div className="space-y-2">
          {cache.length === 0 ? <p className="text-xs text-ink-500">No cache metrics.</p> : cache.slice(0, 10).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{c.cache_name}</p>
                  <p className="text-xs text-ink-500">{c.cache_type} · {c.hit_count} hits · {c.miss_count} misses · {c.total_keys} keys</p>
                </div>
              </div>
              <span className={cn('text-sm font-bold', (c.hit_ratio ?? 0) >= 0.8 ? 'text-success-400' : (c.hit_ratio ?? 0) >= 0.5 ? 'text-warning-400' : 'text-error-400')}>{((c.hit_ratio ?? 0) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function InfrastructureTab({ dash }: { dash: any }) {
  const resources = dash.resourceUsage as any[];
  const costs = dash.costTracking as any[];
  const envs = dash.environmentConfigs as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Resources Tracked" value={resources.length} />
        <StatCard icon={DollarSign} label="AI Spend" value={`$${dash.aiSpend.toFixed(2)}`} />
        <StatCard icon={Network} label="API Cost" value={`$${dash.apiUsageCost.toFixed(2)}`} />
        <StatCard icon={HardDrive} label="Infra Cost" value={`$${dash.infrastructureCost.toFixed(2)}`} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Resource Usage</h4>
        <div className="space-y-2">
          {resources.length === 0 ? <p className="text-xs text-ink-500">No resource data.</p> : resources.slice(0, 15).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                {r.resource_type === 'cpu' ? <Cpu className="h-4 w-4 text-brand-400" /> : r.resource_type === 'memory' || r.resource_type === 'storage' ? <HardDrive className="h-4 w-4 text-brand-400" /> : <Server className="h-4 w-4 text-brand-400" />}
                <div>
                  <p className="text-sm font-medium text-ink-500">{r.resource_name}</p>
                  <p className="text-xs text-ink-500">{r.resource_type} · {r.usage_value} {r.usage_unit}</p>
                </div>
              </div>
              {r.usage_percent != null && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-card-900 overflow-hidden">
                    <div className={cn('h-full rounded-full', r.usage_percent >= 90 ? 'bg-error-500' : r.usage_percent >= 70 ? 'bg-warning-500' : 'bg-success-500')} style={{ width: `${Math.min(r.usage_percent, 100)}%` }} />
                  </div>
                  <span className={cn('text-xs font-bold', r.usage_percent >= 90 ? 'text-error-400' : r.usage_percent >= 70 ? 'text-warning-400' : 'text-success-400')}>{r.usage_percent.toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Environment Configurations</h4>
        <div className="space-y-2">
          {envs.length === 0 ? <p className="text-xs text-ink-500">No environment configs.</p> : envs.slice(0, 15).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500 font-mono">{e.config_key}</p>
                  <p className="text-xs text-ink-500">{e.environment} · {e.config_type}{e.is_secret ? ' · secret' : ''}</p>
                </div>
              </div>
              <Badge tone={e.environment === 'production' ? 'error' : e.environment === 'staging' ? 'warning' : 'brand'}>{e.environment}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Cost Breakdown</h4>
        <div className="space-y-2">
          {costs.length === 0 ? <p className="text-xs text-ink-500">No cost data.</p> : costs.slice(0, 15).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{c.cost_source}</p>
                  <p className="text-xs text-ink-500">{c.cost_category} · {timeAgo(c.recorded_at)}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-ink-500">${c.cost_amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { Settings } from 'lucide-react';
