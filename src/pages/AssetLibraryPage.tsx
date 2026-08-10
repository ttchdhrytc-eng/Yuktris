// ============================================================
// Proposal Asset Library — Main Page
// ============================================================

import { useState } from 'react';
import {
  Library,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Eye,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  Archive,
  Award,
  Tag,
  FolderTree,
  Sparkles,
  X,
  Plus,
  Star,
  ChevronRight,
  Copy,
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
  useAssets,
  useAssetHealth,
  useAssetAnalytics,
  useAssetCategories,
  useAssetTags,
  useAsset,
  useAssetVersions,
  useAssetReviews,
  usePendingAssetReviews,
  useCreateAsset,
  useArchiveAsset,
  useCloneAsset,
  useApproveAsset,
  useRejectAsset,
  useSubmitAssetForReview,
} from '@/hooks/useProposalAssets';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type { AssetType, ProposalAssetRecord, AssetReviewRecord } from '@/types/proposal-assets';

// ============================================================
// Asset Type Icons
// ============================================================

const ASSET_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  service_description: FileText,
  industry_template: FolderTree,
  proposal_template: FileText,
  case_study: Award,
  client_testimonial: Star,
  success_story: TrendingUp,
  pricing_model: Tag,
  pricing_package: Tag,
  pricing_rule: Tag,
  implementation_plan: GitBranch,
  project_timeline: Clock,
  team_profile: ShieldCheck,
  certification: Award,
  award: Award,
  partnership: ShieldCheck,
  faq: FileText,
  legal_terms: FileText,
  terms_conditions: FileText,
  contract: FileText,
  sow_template: FileText,
  proposal_section: FileText,
  email_template: FileText,
  executive_summary: Sparkles,
  call_to_action: Sparkles,
  visual_asset: FileText,
  image: FileText,
  icon: FileText,
  logo: FileText,
  brand_guideline: FileText,
  video: FileText,
  attachment: FileText,
  whitepaper: FileText,
  brochure: FileText,
  product_sheet: FileText,
  roi_model: TrendingUp,
  business_value_statement: TrendingUp,
  competitive_advantage: Award,
  feature_list: FileText,
  technology_stack: FileText,
  methodology: GitBranch,
  compliance_document: ShieldCheck,
};

// ============================================================
// Main Page
// ============================================================

export function AssetLibraryPage() {
  const { data: health } = useAssetHealth();
  const { data: analytics, isLoading: analyticsLoading } = useAssetAnalytics();
  const { data: categories } = useAssetCategories();
  const { data: tags } = useAssetTags();
  const { data: pendingReviews } = usePendingAssetReviews();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'approvals' | 'analytics'>('library');

  const assetsQuery = useAssets({
    query: searchQuery || undefined,
    assetType: (filterType || undefined) as AssetType | undefined,
    categoryId: filterCategory || undefined,
    limit: 100,
  });

  return (
    <div>
      <PageHeader
        title="Asset Library"
        description="Reusable proposal assets for intelligent proposal assembly."
        actions={
          <Button size="sm" onClick={() => setShowCreator(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Asset
          </Button>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Library} label="Total Assets" value={analytics ? formatNumber(analytics.total_assets) : '—'} loading={analyticsLoading} />
        <MetricCard icon={CheckCircle2} label="Active" value={analytics ? formatNumber(analytics.active_assets) : '—'} loading={analyticsLoading} tone="success" />
        <MetricCard icon={Clock} label="Pending" value={analytics ? formatNumber(analytics.pending_approval) : '—'} loading={analyticsLoading} tone="warning" />
        <MetricCard icon={Archive} label="Archived" value={analytics ? formatNumber(analytics.archived_assets) : '—'} loading={analyticsLoading} />
        <MetricCard icon={TrendingUp} label="Total Usage" value={analytics ? formatNumber(analytics.total_usage) : '—'} loading={analyticsLoading} tone="brand" />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gold-500/8">
        {(['library', 'approvals', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-ink-500 hover:text-ink-500'
            )}
          >
            {tab}
            {tab === 'approvals' && (pendingReviews?.length ?? 0) > 0 && (
              <span className="ml-1.5 text-xs bg-warning-500/20 text-warning-500 px-1.5 py-0.5 rounded-full">
                {pendingReviews?.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'library' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Filters */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4 text-brand-400" />
                  Search & Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Search</Label>
                  <Input
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Asset Type</Label>
                  <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="">All Types</option>
                    {Object.keys(ASSET_TYPE_ICONS).map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-ink-500" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 20).map((tag) => (
                    <Badge key={tag.id} tone="neutral">{tag.name}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center: Asset List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Library className="h-4 w-4 text-brand-400" />
                  Assets
                </CardTitle>
                <Badge tone="neutral">{assetsQuery.data?.length ?? 0} assets</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {!assetsQuery.data || assetsQuery.data.length === 0 ? (
                  <EmptyState
                    icon={<Library className="h-6 w-6" />}
                    title="No Assets Found"
                    description="Create a new asset or adjust your filters."
                  />
                ) : (
                  <div className="divide-y divide-border-subtle max-h-[600px] overflow-y-auto">
                    {assetsQuery.data.map((asset) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        onSelect={() => setSelectedAssetId(asset.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <ApprovalQueue />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard analytics={analytics} loading={analyticsLoading} />
      )}

      {/* Asset Detail Modal */}
      {selectedAssetId && (
        <AssetDetailModal assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
      )}

      {/* Asset Creator Modal */}
      {showCreator && (
        <AssetCreatorModal onClose={() => setShowCreator(false)} />
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
// Asset Row
// ============================================================

function AssetRow({ asset, onSelect }: { asset: ProposalAssetRecord; onSelect: () => void }) {
  const Icon = ASSET_TYPE_ICONS[asset.asset_type] ?? FileText;

  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    active: 'success',
    draft: 'neutral',
    archived: 'neutral',
    expired: 'warning',
  };

  const approvalTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    approved: 'success',
    pending: 'warning',
    in_review: 'warning',
    rejected: 'error',
  };

  return (
    <div
      className="flex items-center gap-3 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <Icon className="h-4 w-4 text-ink-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-500 truncate">{asset.title}</span>
          <Badge tone="neutral">{asset.asset_type.replace(/_/g, ' ')}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          {asset.industry && <span className="text-xs text-ink-500">{asset.industry}</span>}
          {asset.service && <span className="text-xs text-ink-500">{asset.service}</span>}
          <span className="text-xs text-ink-500">{asset.usage_count} uses</span>
          <span className="text-xs text-ink-500">v{asset.version}</span>
          <span className="text-xs text-ink-500">{timeAgo(asset.updated_at)}</span>
        </div>
      </div>
      <Badge tone={approvalTone[asset.approval_status] ?? 'neutral'} dot>
        {asset.approval_status.replace(/_/g, ' ')}
      </Badge>
      <Badge tone={statusTone[asset.status] ?? 'neutral'}>
        {asset.status}
      </Badge>
      <ChevronRight className="h-4 w-4 text-ink-500" />
    </div>
  );
}

// ============================================================
// Asset Detail Modal
// ============================================================

function AssetDetailModal({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const { data: asset } = useAsset(assetId);
  const { data: versions } = useAssetVersions(assetId, 10);
  const { data: reviews } = useAssetReviews(assetId);
  const archiveMutation = useArchiveAsset();
  const cloneMutation = useCloneAsset();
  const submitReviewMutation = useSubmitAssetForReview();

  const [activeTab, setActiveTab] = useState<'content' | 'versions' | 'reviews'>('content');

  if (!asset) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-maroon-950 border border-gold-500/12 rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <Spinner className="h-6 w-6" />
        </div>
      </div>
    );
  }

  const Icon = ASSET_TYPE_ICONS[asset.asset_type] ?? FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-maroon-950 border-b border-gold-500/12 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-brand-400" />
            <div>
              <h2 className="text-base font-semibold text-ink-500">{asset.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone="neutral">{asset.asset_type.replace(/_/g, ' ')}</Badge>
                <Badge tone={asset.approval_status === 'approved' ? 'success' : 'warning'} dot>
                  {asset.approval_status.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-ink-500">v{asset.version}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {asset.approval_status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitReviewMutation.mutate({ assetId: asset.id })}
                loading={submitReviewMutation.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                Submit for Review
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => cloneMutation.mutate({ id: asset.id, newTitle: `${asset.title} (Copy)` })}
              loading={cloneMutation.isPending}
            >
              <Copy className="h-3.5 w-3.5" />
              Clone
            </Button>
            {asset.status !== 'archived' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => archiveMutation.mutate(asset.id)}
                loading={archiveMutation.isPending}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
            )}
            <button onClick={onClose} className="text-ink-500 hover:text-ink-500">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gold-500/8">
          {(['content', 'versions', 'reviews'] as const).map((tab) => (
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
              {tab === 'versions' && (versions?.length ?? 0) > 0 && ` (${versions?.length})`}
              {tab === 'reviews' && (reviews?.length ?? 0) > 0 && ` (${reviews?.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'content' && (
            <>
              {asset.description && (
                <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                  <span className="text-[10px] text-ink-500 uppercase tracking-wide">Description</span>
                  <p className="text-sm text-ink-500 mt-1">{asset.description}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <InfoBlock label="Industry" value={asset.industry ?? '—'} />
                <InfoBlock label="Service" value={asset.service ?? '—'} />
                <InfoBlock label="Language" value={asset.language} />
                <InfoBlock label="Owner" value={asset.owner ?? '—'} />
                <InfoBlock label="Confidence" value={`${Math.round(asset.confidence_score * 100)}%`} />
                <InfoBlock label="Usage Count" value={String(asset.usage_count)} />
              </div>

              {asset.content_text && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Content</h3>
                  <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3 max-h-[300px] overflow-y-auto">
                    <pre className="text-xs text-ink-500 whitespace-pre-wrap">{asset.content_text}</pre>
                  </div>
                </div>
              )}

              {asset.content && Object.keys(asset.content).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Structured Content</h3>
                  <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3 max-h-[200px] overflow-y-auto">
                    <pre className="text-xs text-ink-500 whitespace-pre-wrap">{JSON.stringify(asset.content, null, 2)}</pre>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'versions' && (
            <>
              {!versions || versions.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-4">No version history.</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((ver) => (
                    <div key={ver.id} className="flex items-center justify-between rounded-lg border border-gold-500/12 bg-card-900 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-4 w-4 text-ink-500" />
                        <span className="text-sm text-ink-500">Version {ver.version_number}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {ver.change_summary && <span className="text-xs text-ink-500">{ver.change_summary}</span>}
                        <span className="text-xs text-ink-500">{timeAgo(ver.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'reviews' && (
            <>
              {!reviews || reviews.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-4">No reviews yet.</p>
              ) : (
                <div className="space-y-2">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-ink-500">{rev.reviewer_name ?? 'Anonymous'}</span>
                        <Badge tone={rev.review_status === 'approved' ? 'success' : rev.review_status === 'rejected' ? 'error' : 'warning'}>
                          {rev.review_status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {rev.review_notes && <p className="text-xs text-ink-500 mt-1">{rev.review_notes}</p>}
                      <span className="text-[10px] text-ink-500">{timeAgo(rev.created_at)}</span>
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

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-ink-500 mt-1">{value}</p>
    </div>
  );
}

// ============================================================
// Approval Queue
// ============================================================

function ApprovalQueue() {
  const { data: pendingReviews } = usePendingAssetReviews();
  const approveMutation = useApproveAsset();
  const rejectMutation = useRejectAsset();

  if (!pendingReviews || pendingReviews.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="No Pending Approvals"
            description="All assets have been reviewed."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pendingReviews.map((review) => (
        <ApprovalRow
          key={review.id}
          review={review}
          onApprove={(notes) => approveMutation.mutate({ reviewId: review.id, assetId: review.asset_id, notes })}
          onReject={(notes) => rejectMutation.mutate({ reviewId: review.id, assetId: review.asset_id, notes })}
        />
      ))}
    </div>
  );
}

function ApprovalRow({ review, onApprove, onReject }: {
  review: AssetReviewRecord;
  onApprove: (notes?: string) => void;
  onReject: (notes?: string) => void;
}) {
  const { data: asset } = useAsset(review.asset_id);
  const Icon = asset ? (ASSET_TYPE_ICONS[asset.asset_type] ?? FileText) : FileText;

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Icon className="h-5 w-5 text-ink-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-ink-500">{asset?.title ?? 'Unknown Asset'}</span>
          {asset && <Badge tone="neutral">{asset.asset_type.replace(/_/g, ' ')}</Badge>}
          {review.reviewer_name && <span className="text-xs text-ink-500 ml-2">by {review.reviewer_name}</span>}
          <span className="text-xs text-ink-500 ml-2">{timeAgo(review.created_at)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onApprove()} loading={false}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject()}>
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Analytics Dashboard
// ============================================================

function AnalyticsDashboard({ analytics, loading }: { analytics: ReturnType<typeof useAssetAnalytics>['data']; loading: boolean }) {
  if (loading || !analytics) {
    return (
      <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Most Used */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-brand-400" />
            Most Used Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {analytics.most_used.length === 0 ? (
            <p className="text-xs text-ink-500">No usage data yet.</p>
          ) : (
            analytics.most_used.map((item, i) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-500">{i + 1}.</span>
                  <span className="text-sm text-ink-500 truncate">{item.title}</span>
                  <Badge tone="neutral">{item.asset_type.replace(/_/g, ' ')}</Badge>
                </div>
                <Badge tone="brand">{item.usage_count}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Top Rated */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-brand-400" />
            Top Rated Assets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {analytics.top_rated.length === 0 ? (
            <p className="text-xs text-ink-500">No ratings yet.</p>
          ) : (
            analytics.top_rated.map((item, i) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-500">{i + 1}.</span>
                  <span className="text-sm text-ink-500 truncate">{item.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-warning-500" />
                  <span className="text-xs text-ink-500">{item.average_rating.toFixed(1)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FolderTree className="h-4 w-4 text-ink-500" />
            Type Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(analytics.type_distribution)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                <Badge tone="neutral">{count}</Badge>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Industry Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-ink-500" />
            Industry Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(analytics.industry_distribution).length === 0 ? (
            <p className="text-xs text-ink-500">No industry data.</p>
          ) : (
            Object.entries(analytics.industry_distribution)
              .sort((a, b) => b[1] - a[1])
              .map(([industry, count]) => (
                <div key={industry} className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">{industry}</span>
                  <Badge tone="brand">{count}</Badge>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      {/* Duplicates */}
      {analytics.duplicate_candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-warning-500" />
              Duplicate Candidates ({analytics.duplicate_candidates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.duplicate_candidates.slice(0, 10).map((dup, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2">
                <span className="text-xs text-ink-500">
                  {dup.primary_id.slice(0, 8)} ↔ {dup.duplicate_id.slice(0, 8)}
                </span>
                <Badge tone="warning">{Math.round(dup.similarity * 100)}% similar</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unused */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Archive className="h-4 w-4 text-ink-500" />
            Unused Assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-500">Assets with 0 usage</span>
            <Badge tone={analytics.unused_assets > 0 ? 'warning' : 'success'}>{analytics.unused_assets}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Asset Creator Modal
// ============================================================

function AssetCreatorModal({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateAsset();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('service_description');
  const [industry, setIndustry] = useState('');
  const [service, setService] = useState('');
  const [contentText, setContentText] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      assetType,
      industry: industry.trim() || undefined,
      service: service.trim() || undefined,
      contentText: contentText.trim() || undefined,
      content: contentText.trim() ? { text: contentText.trim() } : {},
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
          <h2 className="text-base font-semibold text-ink-500">Create New Asset</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asset title" />
          </div>

          <div>
            <Label>Asset Type</Label>
            <Select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}>
              {Object.keys(ASSET_TYPE_ICONS).map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS" />
            </div>
            <div>
              <Label>Service</Label>
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. SEO" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          </div>

          <div>
            <Label>Content</Label>
            <textarea
              className="w-full rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2 text-sm text-ink-500 min-h-[100px]"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Asset content..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!title.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Create
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
