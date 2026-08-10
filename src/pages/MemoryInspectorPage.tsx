// ============================================================
// Memory Inspector — Developer Page
// ============================================================

import { useState } from 'react';
import {
  Brain,
  Search,
  Database,
  Zap,
  Clock,
  ShieldCheck,
  AlertCircle,
  Activity,
  HardDrive,
  TrendingUp,
  RefreshCw,
  GitBranch,
  Layers,
  Sparkles,
  ChevronRight,
  Award,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  useMemoryHealth,
  useMemorySummary,
  useLearningEvents,
  useMemory,
  useMemoryHistory,
  useMemoryRelationships,
  useStoreMemory,
  useRefreshMemory,
  useMemorySearch,
} from '@/hooks/useMemoryEngine';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type { MemoryEntityRecord, LearningEventRecord, MemoryRecordRecord } from '@/types/memory-engine';

// ============================================================
// Memory Type Icons
// ============================================================

const MEMORY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Database,
  contact: Activity,
  organization: Database,
  research: Search,
  revenue_intelligence: TrendingUp,
  meeting: Clock,
  email: Zap,
  proposal: FileText,
  conversation: Activity,
  crm: Database,
  document: FileText,
  agent: Brain,
  execution: Zap,
  user_preference: ShieldCheck,
  learning: Sparkles,
  decision: Brain,
  relationship: GitBranch,
  historical: Clock,
};

function FileText({ className }: { className?: string }) {
  return <Database className={className} />;
}

// ============================================================
// Learning Event Icons
// ============================================================

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  memory_created: Sparkles,
  memory_updated: RefreshCw,
  memory_merged: GitBranch,
  memory_expired: Clock,
  relationship_created: GitBranch,
  confidence_adjusted: TrendingUp,
  duplicate_detected: AlertCircle,
  learning_recorded: Brain,
  memory_refreshed: RefreshCw,
  memory_compressed: Layers,
};

// ============================================================
// Main Page
// ============================================================

export function MemoryInspectorPage() {
  const { data: health } = useMemoryHealth();
  const { data: summary, isLoading: summaryLoading } = useMemorySummary();
  const { data: learningEvents } = useLearningEvents(15);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  const searchRequest = searchQuery.length > 1 ? { query: searchQuery, limit: 20 } : null;
  const { data: searchResults, isLoading: searchLoading } = useMemorySearch(searchRequest);

  return (
    <div>
      <PageHeader
        title="Memory Inspector"
        description="Inspect and manage the Enterprise Memory & Learning Engine."
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Brain} label="Total Memories" value={summary ? formatNumber(summary.total_memories) : '—'} loading={summaryLoading} />
        <MetricCard icon={ShieldCheck} label="Active" value={summary ? formatNumber(summary.active_memories) : '—'} loading={summaryLoading} tone="success" />
        <MetricCard icon={Clock} label="Expired" value={summary ? formatNumber(summary.expired_memories) : '—'} loading={summaryLoading} tone={summary && summary.expired_memories > 0 ? 'warning' : 'default'} />
        <MetricCard icon={GitBranch} label="Relationships" value={summary ? formatNumber(summary.total_relationships) : '—'} loading={summaryLoading} />
        <MetricCard icon={Zap} label="Avg Confidence" value={summary ? `${Math.round(summary.average_confidence * 100)}%` : '—'} loading={summaryLoading} tone="brand" />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Memory Search + Top Entities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-400" />
                Memory Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search memories by title or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {/* Search Results (when query > 1 char) */}
              {searchQuery.length > 1 && (
                <div>
                  <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">
                    Search Results {searchResults ? `(${searchResults.length})` : ''}
                  </h4>
                  {searchLoading ? (
                    <div className="flex justify-center py-4"><Spinner className="h-4 w-4" /></div>
                  ) : !searchResults || searchResults.length === 0 ? (
                    <p className="text-xs text-ink-500">No memories match "{searchQuery}".</p>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <div
                          key={result.entity.id}
                          className="flex items-center gap-3 rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2 cursor-pointer hover:bg-card-800"
                          onClick={() => setSelectedMemoryId(result.entity.id)}
                        >
                          <Search className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-ink-500 truncate">{result.entity.title}</p>
                            {result.entity.summary && (
                              <p className="text-xs text-ink-500 truncate">{result.entity.summary}</p>
                            )}
                          </div>
                          <Badge tone="brand">{Math.round(result.score * 100)}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Top Entities (when no search) */}
              {searchQuery.length <= 1 && summary && (
                <div>
                  <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Top Entities by Importance</h4>
                  <div className="space-y-2">
                    {summary.top_entities.length === 0 ? (
                      <p className="text-xs text-ink-500">No memories stored yet.</p>
                    ) : (
                      summary.top_entities.map((entity, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2 cursor-pointer hover:bg-card-800"
                          onClick={() => setSelectedMemoryId(entity.entity_id)}
                        >
                          <span className="text-xs text-ink-500">{i + 1}.</span>
                          <Award className="h-3.5 w-3.5 text-brand-400" />
                          <span className="text-sm text-ink-500 truncate flex-1">{entity.title}</span>
                          <Badge tone="brand">{Math.round(entity.importance * 100)}%</Badge>
                          <Badge tone="neutral">{Math.round(entity.confidence * 100)}%</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Memory Type Distribution */}
          {summary && Object.keys(summary.memory_type_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-ink-500" />
                  Memory Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.memory_type_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const Icon = MEMORY_TYPE_ICONS[type] ?? Database;
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-ink-500" />
                          <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge tone="neutral">{count}</Badge>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Health, Learning Events, Stats */}
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
                    <span className="text-xs text-ink-500">Active Memories</span>
                    <span className="text-xs text-ink-500">{health.active_memories}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Expired</span>
                    <span className="text-xs text-ink-500">{health.expired_memories}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Relationships</span>
                    <span className="text-xs text-ink-500">{health.total_relationships}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Learning Events</span>
                    <span className="text-xs text-ink-500">{health.total_learning_events}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Freshness</span>
                    <span className="text-xs text-ink-500">{Math.round(health.average_freshness * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Importance</span>
                    <span className="text-xs text-ink-500">{Math.round(health.average_importance * 100)}%</span>
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

          {/* Recent Learning Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ink-500" />
                Recent Learning Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
              {!learningEvents || learningEvents.length === 0 ? (
                <p className="text-xs text-ink-500 py-3 text-center">No learning events yet.</p>
              ) : (
                learningEvents.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </CardContent>
          </Card>

          {/* Learning Event Distribution */}
          {summary && Object.keys(summary.learning_event_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ink-500" />
                  Event Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.learning_event_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                      <Badge tone="neutral">{count}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Memory Detail Modal */}
      <MemoryDetailModal memoryId={selectedMemoryId} onClose={() => setSelectedMemoryId(null)} />
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
// Learning Event Row
// ============================================================

function EventRow({ event }: { event: LearningEventRecord }) {
  const Icon = EVENT_ICONS[event.event_type] ?? Activity;

  const tone: Record<string, 'success' | 'warning' | 'error' | 'brand' | 'neutral'> = {
    memory_created: 'success',
    memory_updated: 'brand',
    memory_merged: 'brand',
    memory_expired: 'warning',
    relationship_created: 'neutral',
    confidence_adjusted: 'neutral',
    duplicate_detected: 'warning',
    learning_recorded: 'success',
    memory_refreshed: 'brand',
    memory_compressed: 'neutral',
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border border-gold-500/12 bg-card-900 p-2.5">
      <Icon className="h-3.5 w-3.5 text-ink-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={tone[event.event_type] ?? 'neutral'} dot>
            {event.event_type.replace(/_/g, ' ')}
          </Badge>
          <span className="text-[10px] text-ink-500">{timeAgo(event.created_at)}</span>
        </div>
        {event.learning_summary && (
          <p className="text-xs text-ink-500 mt-1 truncate">{event.learning_summary}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Memory Detail Modal
// ============================================================

function MemoryDetailModal({ memoryId, onClose }: { memoryId: string | null; onClose: () => void }) {
  const { data: memory } = useMemory(memoryId);
  const { data: history } = useMemoryHistory(memoryId, 10);
  const { data: relationships } = useMemoryRelationships(memoryId);
  const refreshMutation = useRefreshMemory();

  if (!memoryId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!memory ? (
          <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink-500">{memory.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="brand">{memory.memory_type.replace(/_/g, ' ')}</Badge>
                  <Badge tone="neutral">{memory.entity_type}</Badge>
                  <span className="text-xs text-ink-500">v{memory.version}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate(memory.id)}
                loading={refreshMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            {/* Summary */}
            {memory.summary && (
              <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                <span className="text-[10px] text-ink-500 uppercase tracking-wide">Summary</span>
                <p className="text-sm text-ink-500 mt-1">{memory.summary}</p>
              </div>
            )}

            {/* Scores */}
            <div className="grid grid-cols-3 gap-3">
              <ScoreBlock label="Confidence" value={memory.confidence_score} />
              <ScoreBlock label="Freshness" value={memory.freshness_score} />
              <ScoreBlock label="Importance" value={memory.importance_score} />
            </div>

            {/* Content */}
            {memory.content && Object.keys(memory.content).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Content</h3>
                <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                  {Object.entries(memory.content).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-ink-500 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-ink-500 text-right">
                        {typeof value === 'object' ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships */}
            {relationships && relationships.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
                  Relationships ({relationships.length})
                </h3>
                <div className="space-y-1.5">
                  {relationships.map((rel) => (
                    <div key={rel.id} className="flex items-center gap-2 rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2">
                      <GitBranch className="h-3.5 w-3.5 text-ink-500" />
                      <Badge tone="neutral">{rel.relationship_type}</Badge>
                      <span className="text-xs text-ink-500">
                        {rel.source_memory_id === memory.id ? '→' : '←'} {rel.source_memory_id === memory.id ? rel.target_memory_id.slice(0, 8) : rel.source_memory_id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-ink-500 ml-auto">{Math.round(rel.strength * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Version History */}
            {history && history.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
                  Version History ({history.length})
                </h3>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                  {history.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-ink-500" />
                        <span className="text-xs text-ink-500">v{record.version}</span>
                        <span className="text-xs text-ink-500">{record.source}</span>
                      </div>
                      <span className="text-[10px] text-ink-500">{timeAgo(record.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-ink-500 pt-2 border-t border-gold-500/8 flex items-center justify-between">
              <span>Created {timeAgo(memory.created_at)}</span>
              <span>Updated {timeAgo(memory.updated_at)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 70 ? 'text-success-400' : pct >= 40 ? 'text-warning-500' : 'text-error-400';
  const barColor = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';

  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      <p className={cn('text-sm font-semibold mt-1', tone)}>{pct}%</p>
      <div className="w-full h-1 rounded-full bg-maroon-950 overflow-hidden mt-1.5">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
