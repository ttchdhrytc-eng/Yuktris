// ============================================================
// Knowledge Graph Dashboard — Main Page
// ============================================================

import { useState } from 'react';
import {
  Network,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Users,
  Cpu,
  Globe,
  Tag,
  Target,
  TrendingUp,
  Activity,
  Database,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Zap,
  Link2,
  Eye,
  X,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import {
  useGraphStatistics,
  useGraphHealth,
  useGraphSearch,
  useGraphEntity,
  useGraphRelationships,
  useCreateGraphNode,
  useDeleteGraphNode,
  useGraphRebuild,
} from '@/hooks/useKnowledgeGraph';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
  NodeType,
  RelationshipType,
} from '@/types/knowledge-graph';

// ============================================================
// Node type metadata
// ============================================================

const NODE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  contact: Users,
  person: Users,
  lead: Target,
  account: Building2,
  user: Users,
  organization: Building2,
  product: Layers,
  service: Zap,
  technology: Cpu,
  industry: Tag,
  location: Globe,
  website: Globe,
  domain: Globe,
  email: ArrowRight,
  meeting: Calendar,
  document: Database,
  proposal: Database,
  task: CheckCircle2,
  note: Database,
  research_report: Database,
  buying_signal: TrendingUp,
  growth_signal: TrendingUp,
  funding_event: TrendingUp,
  hiring_event: Users,
  competitor: Building2,
  crm_record: Database,
  calendar_event: Calendar,
  ai_insight: Zap,
};

const NODE_TYPE_LABELS: { value: NodeType; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'contact', label: 'Contact' },
  { value: 'person', label: 'Person' },
  { value: 'lead', label: 'Lead' },
  { value: 'account', label: 'Account' },
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'technology', label: 'Technology' },
  { value: 'industry', label: 'Industry' },
  { value: 'location', label: 'Location' },
  { value: 'website', label: 'Website' },
  { value: 'domain', label: 'Domain' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'buying_signal', label: 'Buying Signal' },
  { value: 'growth_signal', label: 'Growth Signal' },
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'WORKS_FOR', 'OWNS', 'BELONGS_TO', 'USES_TECHNOLOGY', 'COMPETES_WITH',
  'SERVES', 'TARGETS', 'LOCATED_IN', 'PARTNER_OF', 'CUSTOMER_OF',
  'PROSPECT_OF', 'ATTENDED', 'SENT_EMAIL', 'RECEIVED_EMAIL', 'HAS_MEETING',
  'RELATED_TO', 'GENERATED_BY', 'MENTIONS', 'HAS_BUYING_SIGNAL', 'HAS_GROWTH_SIGNAL',
  'HAS_DOCUMENT', 'HAS_PROPOSAL', 'REFERENCES', 'SIMILAR_TO', 'PARENT_OF', 'CHILD_OF',
];

// ============================================================
// Main Page
// ============================================================

export function KnowledgeGraphPage() {
  const { data: stats, isLoading: statsLoading } = useGraphStatistics();
  const { data: health } = useGraphHealth();
  const rebuildMutation = useGraphRebuild();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<NodeType | ''>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: searchResults } = useGraphSearch(
    searchQuery,
    searchType || undefined,
    searchQuery.length > 1
  );

  return (
    <div>
      <PageHeader
        title="Knowledge Graph"
        description="Centralized intelligence graph for all business entity relationships."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => rebuildMutation.mutate()} loading={rebuildMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Rebuild
            </Button>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Entity
            </Button>
          </div>
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Network} label="Total Nodes" value={stats ? formatNumber(stats.total_nodes) : '—'} loading={statsLoading} />
        <MetricCard icon={Link2} label="Total Edges" value={stats ? formatNumber(stats.total_edges) : '—'} loading={statsLoading} />
        <MetricCard icon={Activity} label="Density" value={stats ? `${(stats.graph_density * 100).toFixed(2)}%` : '—'} loading={statsLoading} tone="brand" />
        <MetricCard icon={Target} label="Avg Confidence" value={stats ? `${Math.round(stats.average_confidence * 100)}%` : '—'} loading={statsLoading} tone="success" />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
        <MetricCard icon={Database} label="Node Types" value={stats ? Object.keys(stats.nodes_by_type).length.toString() : '—'} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Search & Entity List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-400" />
                Entity Explorer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search entities by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as NodeType | '')}
                  className="w-40"
                >
                  <option value="">All Types</option>
                  {NODE_TYPE_LABELS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>

              {/* Search Results */}
              {searchQuery.length > 1 && (
                <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
                  {!searchResults || searchResults.nodes.length === 0 ? (
                    <p className="text-xs text-ink-500 py-4 text-center">No entities found.</p>
                  ) : (
                    searchResults.nodes.map((node) => (
                      <EntityRow
                        key={node.id}
                        node={node}
                        onSelect={() => setSelectedNodeId(node.id)}
                      />
                    ))
                  )}
                </div>
              )}

              {searchQuery.length <= 1 && stats && (
                <div>
                  <h4 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Node Distribution by Type</h4>
                  <div className="space-y-2">
                    {Object.entries(stats.nodes_by_type)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const Icon = NODE_TYPE_ICONS[type] ?? Network;
                              return <Icon className="h-3.5 w-3.5 text-ink-500" />;
                            })()}
                            <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                          </div>
                          <Badge tone="neutral">{count}</Badge>
                        </div>
                      ))}
                    {Object.keys(stats.nodes_by_type).length === 0 && (
                      <p className="text-xs text-ink-500">No entities in the graph yet.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relationship Distribution */}
          {stats && Object.keys(stats.edges_by_type).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-ink-500" />
                  Relationship Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.edges_by_type)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500">{type.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-card-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300"
                            style={{ width: `${Math.min((count / stats.total_edges) * 100, 100)}%` }}
                          />
                        </div>
                        <Badge tone="neutral">{count}</Badge>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Health & Most Connected */}
        <div className="space-y-6">
          {/* Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-400" />
                Graph Health
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
                      {health.healthy ? 'Healthy' : 'Issues Detected'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Orphaned Nodes</span>
                    <span className="text-xs text-ink-500">{health.orphaned_nodes}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Low Confidence Edges</span>
                    <span className="text-xs text-ink-500">{health.low_confidence_edges}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Deleted Nodes</span>
                    <span className="text-xs text-ink-500">{health.deleted_nodes}</span>
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

          {/* Most Connected */}
          {stats && stats.most_connected_nodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ink-500" />
                  Most Connected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.most_connected_nodes.slice(0, 8).map((node, i) => (
                  <div
                    key={node.node_id}
                    className="flex items-center justify-between cursor-pointer hover:bg-card-800 -mx-2 px-2 py-1 rounded"
                    onClick={() => setSelectedNodeId(node.node_id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-ink-500">{i + 1}.</span>
                      <span className="text-xs text-ink-500 truncate">{node.display_name}</span>
                    </div>
                    <Badge tone="brand">{node.degree}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Entity Detail Modal */}
      <EntityDetailModal
        nodeId={selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
      />

      {/* Create Entity Modal */}
      <CreateEntityModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
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
// Entity Row
// ============================================================

function EntityRow({ node, onSelect }: { node: GraphNodeRecord; onSelect: () => void }) {
  const Icon = NODE_TYPE_ICONS[node.node_type] ?? Network;
  const confidence = node.confidence_score ? Math.round(node.confidence_score * 100) : null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-card-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-900 border border-gold-500/12 shrink-0">
        <Icon className="h-4 w-4 text-ink-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-500 truncate">{node.display_name}</span>
          <Badge tone="neutral">{node.node_type.replace(/_/g, ' ')}</Badge>
        </div>
        {node.external_id && (
          <span className="text-[10px] text-ink-500 truncate block">{node.external_id}</span>
        )}
      </div>
      {confidence !== null && (
        <span className={cn(
          'text-xs font-medium',
          confidence >= 80 ? 'text-success-400' : confidence >= 50 ? 'text-warning-500' : 'text-error-400'
        )}>
          {confidence}%
        </span>
      )}
      <span className="text-[10px] text-ink-500">{timeAgo(node.updated_at)}</span>
    </div>
  );
}

// ============================================================
// Entity Detail Modal
// ============================================================

function EntityDetailModal({ nodeId, onClose }: { nodeId: string | null; onClose: () => void }) {
  const { data: entity } = useGraphEntity(nodeId);
  const { data: relationships } = useGraphRelationships(nodeId);
  const deleteMutation = useDeleteGraphNode();

  if (!nodeId) return null;

  const Icon = entity ? (NODE_TYPE_ICONS[entity.node_type] ?? Network) : Network;

  return (
    <Modal open={!!nodeId} onClose={onClose} size="xl">
      {!entity ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-900 border border-gold-500/12">
                <Icon className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink-500">{entity.display_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge tone="brand">{entity.node_type.replace(/_/g, ' ')}</Badge>
                  {entity.external_id && <span className="text-xs text-ink-500">{entity.external_id}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entity.confidence_score !== null && (
                <Badge tone="brand" dot>{Math.round(entity.confidence_score * 100)}% confidence</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  deleteMutation.mutate(entity.id);
                  onClose();
                }}
                loading={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-error-400" />
              </Button>
            </div>
          </div>

          {/* Properties */}
          {entity.properties && Object.keys(entity.properties).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Properties</h3>
              <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3 space-y-1.5">
                {Object.entries(entity.properties).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4">
                    <span className="text-xs text-ink-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-ink-500 text-right">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relationships */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
              Relationships ({relationships?.edges.length ?? 0})
            </h3>
            {!relationships || relationships.edges.length === 0 ? (
              <p className="text-xs text-ink-500 py-3 text-center">No relationships found.</p>
            ) : (
              <div className="space-y-1.5">
                {relationships.edges.map((edge) => {
                  const isOutgoing = edge.source_node_id === entity.id;
                  const connectedNode = relationships.nodes.find(
                    (n) => n.id === (isOutgoing ? edge.target_node_id : edge.source_node_id)
                  );
                  const ConnectedIcon = connectedNode
                    ? (NODE_TYPE_ICONS[connectedNode.node_type] ?? Network)
                    : Network;

                  return (
                    <div key={edge.id} className="flex items-center gap-2 rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2">
                      {isOutgoing ? (
                        <ArrowRight className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                      ) : (
                        <ArrowLeft className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                      )}
                      <Badge tone="neutral">{edge.relationship_type.replace(/_/g, ' ')}</Badge>
                      {connectedNode && <ConnectedIcon className="h-3.5 w-3.5 text-ink-500 shrink-0" />}
                      <span className="text-xs text-ink-500 truncate flex-1">
                        {connectedNode?.display_name ?? 'Unknown'}
                      </span>
                      <span className="text-[10px] text-ink-500">
                        {Math.round(edge.confidence_score * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="text-xs text-ink-500 pt-2 border-t border-gold-500/8 flex items-center justify-between">
            <span>Created {timeAgo(entity.created_at)}</span>
            <span>Updated {timeAgo(entity.updated_at)}</span>
            <span>v{entity.version}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// Create Entity Modal
// ============================================================

function CreateEntityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateGraphNode();
  const [nodeType, setNodeType] = useState<NodeType>('company');
  const [displayName, setDisplayName] = useState('');
  const [externalId, setExternalId] = useState('');

  const handleCreate = () => {
    if (!displayName.trim()) return;
    createMutation.mutate({
      nodeType,
      displayName: displayName.trim(),
      externalId: externalId.trim() || null,
    });
    setDisplayName('');
    setExternalId('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand-400" />
          <h2 className="text-base font-semibold text-ink-500">Add Entity to Graph</h2>
        </div>

        <div>
          <Label>Entity Type</Label>
          <Select value={nodeType} onChange={(e) => setNodeType(e.target.value as NodeType)}>
            {NODE_TYPE_LABELS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Acme Corporation"
            autoFocus
          />
        </div>

        <div>
          <Label>External ID (optional)</Label>
          <Input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="e.g. crm:acme-001"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} loading={createMutation.isPending} disabled={!displayName.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Create Entity
          </Button>
        </div>
      </div>
    </Modal>
  );
}
