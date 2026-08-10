// ============================================================
// Proposal Workspace — Main Proposal Intelligence Page
// ============================================================

import { useState } from 'react';
import {
  FileText,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Eye,
  GitBranch,
  ShieldCheck,
  DollarSign,
  Target,
  Zap,
  Award,
  ChevronRight,
  X,
  RefreshCw,
  Send,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  useProposalProjects,
  useProposalHealth,
  useProposalSummary,
  useProposal,
  useProposalHistory,
  useGenerateProposal,
  useProposalExport,
  useReviewProposal,
} from '@/hooks/useProposalEngine';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type { ProposalType, ExportFormat, ProposalContent } from '@/types/proposal';

// ============================================================
// Main Page
// ============================================================

export function ProposalWorkspacePage() {
  const { data: summary, isLoading: summaryLoading } = useProposalSummary();
  const { data: health } = useProposalHealth();
  const { data: projects } = useProposalProjects(20);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <div>
      <PageHeader
        title="Proposal Workspace"
        description="AI-native proposal generation with research-driven personalization."
        actions={
          <Button size="sm" onClick={() => setShowGenerator(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Proposal
          </Button>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={FileText} label="Total Projects" value={summary ? formatNumber(summary.total_projects) : '—'} loading={summaryLoading} />
        <MetricCard icon={GitBranch} label="Total Versions" value={summary ? formatNumber(summary.total_versions) : '—'} loading={summaryLoading} />
        <MetricCard icon={CheckCircle2} label="Approved" value={summary ? formatNumber(summary.status_distribution.approved ?? 0) : '—'} loading={summaryLoading} tone="success" />
        <MetricCard icon={Clock} label="In Review" value={summary ? formatNumber(summary.status_distribution.in_review ?? 0) : '—'} loading={summaryLoading} tone="warning" />
        <MetricCard icon={Download} label="Exports" value={summary ? formatNumber(summary.total_assets) : '—'} loading={summaryLoading} />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Projects List */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-400" />
                Proposal Projects
              </CardTitle>
              <Badge tone="neutral">{projects?.length ?? 0} projects</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {!projects || projects.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No Proposals Yet"
                  description="Generate a proposal for any company to get started."
                />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onSelect={() => setSelectedProjectId(project.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proposal Type Distribution */}
          {summary && Object.keys(summary.type_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-ink-500" />
                  Proposal Type Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.type_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                      <Badge tone="brand">{count}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Health + Stats */}
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
                    <span className="text-xs text-ink-500">Draft</span>
                    <span className="text-xs text-ink-500">{health.draft_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">In Review</span>
                    <span className="text-xs text-ink-500">{health.in_review_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Approved</span>
                    <span className="text-xs text-ink-500">{health.approved_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Total Reviews</span>
                    <span className="text-xs text-ink-500">{health.total_reviews}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Avg Gen Time</span>
                    <span className="text-xs text-ink-500">{summary?.average_generation_duration_ms ?? 0}ms</span>
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

          {/* Status Distribution */}
          {summary && Object.keys(summary.status_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ink-500" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.status_distribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{status.replace(/_/g, ' ')}</span>
                      <Badge tone={status === 'approved' ? 'success' : status === 'rejected' ? 'error' : status === 'in_review' ? 'warning' : 'neutral'}>
                        {count}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Proposal Detail Modal */}
      {selectedProjectId && (
        <ProposalDetailModal projectId={selectedProjectId} onClose={() => setSelectedProjectId(null)} />
      )}

      {/* Generator Modal */}
      {showGenerator && (
        <ProposalGeneratorModal onClose={() => setShowGenerator(false)} />
      )}
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
// Project Row
// ============================================================

function ProjectRow({ project, onSelect }: {
  project: {
    id: string;
    project_name: string;
    proposal_type: string;
    status: string;
    priority: string;
    company_name: string;
    updated_at: string;
  };
  onSelect: () => void;
}) {
  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'brand'> = {
    draft: 'neutral',
    in_review: 'warning',
    approved: 'success',
    rejected: 'error',
    sent: 'brand',
    archived: 'neutral',
  };

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-500 truncate">{project.project_name}</span>
          <Badge tone="neutral">{project.proposal_type.replace(/_/g, ' ')}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-ink-500">{project.company_name}</span>
          <span className="text-xs text-ink-500">{timeAgo(project.updated_at)}</span>
        </div>
      </div>
      <Badge tone={statusTone[project.status] ?? 'neutral'} dot>
        {project.status.replace(/_/g, ' ')}
      </Badge>
      <ChevronRight className="h-4 w-4 text-ink-500" />
    </div>
  );
}

// ============================================================
// Proposal Detail Modal
// ============================================================

function ProposalDetailModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { data, isLoading } = useProposal(projectId);
  const { data: history } = useProposalHistory(projectId, 10);
  const exportMutation = useProposalExport();
  const reviewMutation = useReviewProposal();

  const [activeTab, setActiveTab] = useState<'preview' | 'pricing' | 'roadmap' | 'history'>('preview');

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-maroon-950 border border-gold-500/12 rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <Spinner className="h-6 w-6" />
        </div>
      </div>
    );
  }

  const { project, version } = data;
  const content = version?.content as ProposalContent | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-maroon-950 border-b border-gold-500/12 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-ink-500">{project?.project_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="neutral">{project?.proposal_type.replace(/_/g, ' ')}</Badge>
              <Badge tone={project?.status === 'approved' ? 'success' : project?.status === 'in_review' ? 'warning' : 'neutral'} dot>
                {project?.status.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-ink-500">v{version?.version_number}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate({ versionId: version!.id, format: 'html' })}
              loading={exportMutation.isPending}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            {project?.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => reviewMutation.mutate({
                  versionId: version!.id,
                  reviewStatus: 'approved',
                  reviewNotes: 'Auto-approved from workspace',
                  overallScore: 0.8,
                })}
                loading={reviewMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
            )}
            <button onClick={onClose} className="text-ink-500 hover:text-ink-500">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gold-500/8">
          {(['preview', 'pricing', 'roadmap', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-ink-500 hover:text-ink-500'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'preview' && content && (
            <>
              {/* Executive Summary */}
              <div className="rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-brand-400" />
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wide">Executive Summary</span>
                </div>
                <p className="text-sm text-ink-500">{content.executive_summary}</p>
              </div>

              {/* ROI Highlight */}
              <div className="grid grid-cols-3 gap-3">
                <ROIBlock icon={DollarSign} label="Investment" value={`$${content.roi.investment.toLocaleString()}`} />
                <ROIBlock icon={TrendingUp} label="Projected Value" value={`$${content.roi.total_projected_value.toLocaleString()}`} tone="success" />
                <ROIBlock icon={Zap} label="ROI" value={`${content.roi.roi_percentage.toFixed(1)}x`} tone="brand" />
              </div>

              {/* Problem Analysis */}
              {content.problem_analysis.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Problem Analysis</h3>
                  <div className="space-y-2">
                    {content.problem_analysis.map((pain, i) => (
                      <div key={i} className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-ink-500 font-medium">{pain.pain_point}</span>
                          <Badge tone={pain.severity === 'critical' ? 'error' : pain.severity === 'high' ? 'warning' : 'neutral'}>
                            {pain.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-500">{pain.description}</p>
                        <p className="text-xs text-ink-500 mt-1"><strong>Solution:</strong> {pain.proposed_solution}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solutions */}
              {content.solution_recommendations.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Recommended Solutions</h3>
                  <div className="space-y-2">
                    {content.solution_recommendations.map((sol, i) => (
                      <div key={i} className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-ink-500 font-medium">{sol.service_name}</span>
                          <Badge tone={sol.priority === 'high' ? 'warning' : 'neutral'}>{sol.priority}</Badge>
                        </div>
                        <p className="text-xs text-ink-500">{sol.description}</p>
                        <p className="text-xs text-ink-500 mt-1"><strong>Rationale:</strong> {sol.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Call to Action */}
              <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                <span className="text-[10px] text-ink-500 uppercase tracking-wide">Call to Action</span>
                <p className="text-sm text-ink-500 mt-1">{content.call_to_action}</p>
              </div>
            </>
          )}

          {activeTab === 'pricing' && content && (
            <>
              <div className="flex items-center justify-between mb-3">
                <Badge tone="brand">{content.pricing.model.replace(/_/g, ' ')}</Badge>
                <span className="text-xs text-ink-500">Valid until {content.pricing.valid_until}</span>
              </div>
              <div className="rounded-lg border border-gold-500/12 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-card-900">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-ink-500">Item</th>
                      <th className="text-left px-4 py-2 text-xs text-ink-500">Category</th>
                      <th className="text-right px-4 py-2 text-xs text-ink-500">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.pricing.line_items.map((item, i) => (
                      <tr key={i} className="border-t border-gold-500/8">
                        <td className="px-4 py-2 text-ink-500">{item.name}</td>
                        <td className="px-4 py-2 text-ink-500">{item.category}</td>
                        <td className="px-4 py-2 text-right text-ink-500">${item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Subtotal</span>
                  <span className="text-ink-500">${content.pricing.subtotal.toLocaleString()}</span>
                </div>
                {content.pricing.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">Discount</span>
                    <span className="text-success-400">-${content.pricing.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gold-500/8">
                  <span className="text-ink-500">Total</span>
                  <span className="text-brand-400">${content.pricing.total.toLocaleString()} {content.pricing.currency}</span>
                </div>
              </div>
              <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3 mt-3">
                <span className="text-[10px] text-ink-500 uppercase tracking-wide">Payment Terms</span>
                <p className="text-sm text-ink-500 mt-1">{content.pricing.payment_terms}</p>
              </div>
              <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                <span className="text-[10px] text-ink-500 uppercase tracking-wide">Pricing Rationale</span>
                <p className="text-sm text-ink-500 mt-1">{content.pricing.rationale}</p>
              </div>
            </>
          )}

          {activeTab === 'roadmap' && content && (
            <>
              {content.implementation_roadmap.map((phase, i) => (
                <div key={i} className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-gold-400 to-gold-300/20 text-brand-400 text-xs font-bold">
                        {phase.phase}
                      </span>
                      <span className="text-sm text-ink-500 font-medium">{phase.title}</span>
                    </div>
                    <Badge tone="neutral">{phase.duration_weeks} weeks</Badge>
                  </div>
                  <p className="text-xs text-ink-500">{phase.description}</p>
                  <div className="mt-2">
                    <span className="text-[10px] text-ink-500 uppercase tracking-wide">Deliverables</span>
                    <ul className="mt-1 space-y-0.5">
                      {phase.deliverables.map((d, j) => (
                        <li key={j} className="text-xs text-ink-500 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-success-400" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {!history || history.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-4">No version history available.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((ver) => (
                    <div key={ver.id} className="flex items-center justify-between rounded-lg border border-gold-500/12 bg-card-900 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-4 w-4 text-ink-500" />
                        <span className="text-sm text-ink-500">Version {ver.version_number}</span>
                        {ver.is_latest && <Badge tone="brand">Latest</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-500">{ver.token_count} tokens</span>
                        <span className="text-xs text-ink-500">{ver.generation_duration_ms}ms</span>
                        <span className="text-xs text-ink-500">{timeAgo(ver.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ROIBlock({ icon: Icon, label, value, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'brand';
}) {
  const toneClass = tone === 'success' ? 'text-success-400' : tone === 'brand' ? 'text-brand-400' : 'text-ink-500';
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-sm font-semibold', toneClass)}>{value}</p>
    </div>
  );
}

// ============================================================
// Proposal Generator Modal
// ============================================================

function ProposalGeneratorModal({ onClose }: { onClose: () => void }) {
  const generateMutation = useGenerateProposal();

  const [companyId, setCompanyId] = useState('');
  const [proposalType, setProposalType] = useState<ProposalType>('executive');
  const [projectName, setProjectName] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  const handleGenerate = () => {
    if (!companyId.trim()) return;
    generateMutation.mutate({
      companyId: companyId.trim(),
      proposalType,
      projectName: projectName.trim() || undefined,
      customInstructions: customInstructions.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink-500">Generate Proposal</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Company ID</Label>
            <Input
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="Company intelligence ID"
            />
          </div>

          <div>
            <Label>Proposal Type</Label>
            <Select value={proposalType} onChange={(e) => setProposalType(e.target.value as ProposalType)}>
              <option value="executive">Executive Proposal</option>
              <option value="sales">Sales Proposal</option>
              <option value="seo">SEO Proposal</option>
              <option value="google_ads">Google Ads Proposal</option>
              <option value="meta_ads">Meta Ads Proposal</option>
              <option value="linkedin_ads">LinkedIn Ads Proposal</option>
              <option value="digital_marketing">Digital Marketing Proposal</option>
              <option value="website">Website Proposal</option>
              <option value="software">Software Proposal</option>
              <option value="ai_solution">AI Solution Proposal</option>
              <option value="custom">Custom Proposal</option>
            </Select>
          </div>

          <div>
            <Label>Project Name (optional)</Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Custom project name"
            />
          </div>

          <div>
            <Label>Custom Instructions (optional)</Label>
            <Input
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Any specific requirements..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleGenerate} loading={generateMutation.isPending} disabled={!companyId.trim()}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
