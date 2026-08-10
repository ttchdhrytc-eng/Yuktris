// ============================================================
// Context Inspector — Developer Page
// ============================================================

import { useState } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  Trash2,
  Database,
  Zap,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Activity,
  Cpu,
  HardDrive,
  Eye,
  X,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  useContextHealth,
  useContextSummary,
  useContextProfiles,
  useContextCache,
  useBuildContext,
  useRefreshContext,
  useClearContextCache,
} from '@/hooks/useContextEngine';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type { ContextProfileRecord } from '@/types/context-engine';

// ============================================================
// Main Page
// ============================================================

export function ContextInspectorPage() {
  const { data: health } = useContextHealth();
  const { data: summary, isLoading: summaryLoading } = useContextSummary();
  const { data: profiles } = useContextProfiles(20);
  const { data: cacheStats } = useContextCache();
  const buildMutation = useBuildContext();
  const refreshMutation = useRefreshContext();
  const clearCacheMutation = useClearContextCache();

  const [entityType, setEntityType] = useState('company');
  const [entityId, setEntityId] = useState('');
  const [contextType, setContextType] = useState('company');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const handleBuild = () => {
    if (!entityId.trim()) return;
    buildMutation.mutate({
      contextType,
      entityType,
      entityId: entityId.trim(),
    });
  };

  return (
    <div>
      <PageHeader
        title="Context Inspector"
        description="Developer tools for inspecting and managing AI context generation."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCacheMutation.mutate()}
            loading={clearCacheMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Expired Cache
          </Button>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Layers} label="Total Profiles" value={summary ? formatNumber(summary.total_profiles) : '—'} loading={summaryLoading} />
        <MetricCard icon={CheckCircle2} label="Active" value={summary ? formatNumber(summary.active_profiles) : '—'} loading={summaryLoading} tone="success" />
        <MetricCard icon={Clock} label="Stale" value={summary ? formatNumber(summary.stale_profiles) : '—'} loading={summaryLoading} tone={summary && summary.stale_profiles > 0 ? 'warning' : 'default'} />
        <MetricCard icon={HardDrive} label="Cache Entries" value={summary ? formatNumber(summary.cache_entries) : '—'} loading={summaryLoading} />
        <MetricCard icon={Zap} label="Avg Tokens" value={summary ? formatNumber(summary.average_token_count) : '—'} loading={summaryLoading} tone="brand" />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Build Context + Profiles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Build Context */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-brand-400" />
                Build Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Entity Type</Label>
                  <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                    <option value="company">Company</option>
                    <option value="graph_node">Graph Node</option>
                    <option value="contact">Contact</option>
                    <option value="custom">Custom</option>
                  </Select>
                </div>
                <div>
                  <Label>Context Type</Label>
                  <Select value={contextType} onChange={(e) => setContextType(e.target.value)}>
                    <option value="company">Company</option>
                    <option value="prospect">Prospect</option>
                    <option value="contact">Contact</option>
                    <option value="meeting">Meeting</option>
                    <option value="task">Task</option>
                    <option value="conversation">Conversation</option>
                    <option value="outreach">Outreach</option>
                    <option value="proposal">Proposal</option>
                    <option value="custom">Custom</option>
                  </Select>
                </div>
                <div>
                  <Label>Entity ID</Label>
                  <Input
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder="e.g. uuid"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleBuild} loading={buildMutation.isPending} disabled={!entityId.trim()}>
                  <Zap className="h-3.5 w-3.5" />
                  Build Context
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (entityId.trim()) {
                      refreshMutation.mutate({ contextType, entityType, entityId: entityId.trim() });
                    }
                  }}
                  loading={refreshMutation.isPending}
                  disabled={!entityId.trim()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Context Profiles */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-ink-500" />
                Context Profiles
              </CardTitle>
              <Badge tone="neutral">{profiles?.length ?? 0} profiles</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {!profiles || profiles.length === 0 ? (
                <EmptyState
                  icon={<Database className="h-6 w-6" />}
                  title="No Context Profiles"
                  description="Build context for an entity to create a profile."
                />
              ) : (
                <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
                  {profiles.map((profile) => (
                    <ProfileRow
                      key={profile.id}
                      profile={profile}
                      onSelect={() => setSelectedProfileId(profile.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Health, Cache, Sources */}
        <div className="space-y-6">
          {/* Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-400" />
                Engine Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!health ? (
                <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Status</span>
                    <Badge tone={health.healthy ? 'success' : 'warning'} dot>
                      {health.healthy ? 'Healthy' : 'Issues'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Active Profiles</span>
                    <span className="text-xs text-ink-500">{health.active_profiles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Stale Profiles</span>
                    <span className="text-xs text-ink-500">{health.stale_profiles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Quality</span>
                    <span className="text-xs text-ink-500">{Math.round(health.average_quality_score * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Build Time</span>
                    <span className="text-xs text-ink-500">{health.average_build_duration_ms}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Compression Ratio</span>
                    <span className="text-xs text-ink-500">{health.average_compression_ratio.toFixed(2)}</span>
                  </div>
                  {health.errors.length > 0 && (
                    <div className="pt-2 border-t border-gold-500/8 space-y-1">
                      {health.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-error-400">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Cache Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-ink-500" />
                Cache Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!cacheStats ? (
                <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Total Entries</span>
                    <Badge tone="neutral">{cacheStats.total_entries}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Expired</span>
                    <Badge tone={cacheStats.expired_entries > 0 ? 'warning' : 'neutral'}>{cacheStats.expired_entries}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Active</span>
                    <Badge tone="success">{cacheStats.total_entries - cacheStats.expired_entries}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Tokens</span>
                    <span className="text-xs text-ink-500">{cacheStats.avg_token_count}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Source Usage */}
          {summary && Object.keys(summary.source_usage).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ink-500" />
                  Source Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.source_usage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{source.replace(/_/g, ' ')}</span>
                      <Badge tone="neutral">{count}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Context Type Distribution */}
          {summary && Object.keys(summary.context_type_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ink-500" />
                  Context Types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.context_type_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{type}</span>
                      <Badge tone="brand">{count}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Profile Detail Modal */}
      <ProfileDetailModal profileId={selectedProfileId} onClose={() => setSelectedProfileId(null)} />
    </div>
  );
}

// ============================================================
// Metric Card
// ============================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'brand';
}) {
  const toneClasses = {
    default: 'text-ink-500',
    success: 'text-success-400',
    warning: 'text-warning-500',
    error: 'text-error-400',
    brand: 'text-brand-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <span className={cn('text-lg font-semibold', toneClasses[tone])}>{value}</span>
      )}
    </Card>
  );
}

// ============================================================
// Profile Row
// ============================================================

function ProfileRow({ profile, onSelect }: { profile: ContextProfileRecord; onSelect: () => void }) {
  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    active: 'success',
    stale: 'warning',
    archived: 'neutral',
    error: 'error',
  };

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-500 truncate">{profile.context_name}</span>
          <Badge tone="neutral">{profile.context_type}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-ink-500">{profile.token_count} tokens</span>
          <span className="text-xs text-ink-500">{profile.source_count} sources</span>
          <span className="text-xs text-ink-500">{timeAgo(profile.updated_at)}</span>
        </div>
      </div>
      <Badge tone={statusTone[profile.status] ?? 'neutral'} dot>
        {profile.status}
      </Badge>
      <span className="text-xs text-ink-500">v{profile.version}</span>
    </div>
  );
}

// ============================================================
// Profile Detail Modal
// ============================================================

function ProfileDetailModal({ profileId, onClose }: { profileId: string | null; onClose: () => void }) {
  const { data: profiles } = useContextProfiles(50);
  const profile = profiles?.find((p) => p.id === profileId) ?? null;

  if (!profileId || !profile) return null;

  return (
    <Modal open={!!profileId} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-500">{profile.context_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="neutral">{profile.context_type}</Badge>
              <Badge tone={profile.status === 'active' ? 'success' : 'warning'} dot>{profile.status}</Badge>
              <span className="text-xs text-ink-500">v{profile.version}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Token Count" value={profile.token_count.toString()} />
          <InfoBlock label="Source Count" value={profile.source_count.toString()} />
          <InfoBlock label="Compression Ratio" value={profile.compression_ratio.toFixed(2)} />
          <InfoBlock label="Quality Score" value={`${Math.round(profile.quality_score * 100)}%`} />
          <InfoBlock label="Build Duration" value={`${profile.build_duration_ms ?? 0}ms`} />
          <InfoBlock label="Entity Type" value={profile.entity_type ?? '—'} />
        </div>

        <div className="text-xs text-ink-500 pt-2 border-t border-gold-500/8">
          Created {timeAgo(profile.created_at)} · Updated {timeAgo(profile.updated_at)}
        </div>
      </div>
    </Modal>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-ink-500 mt-1">{value}</p>
    </div>
  );
}
