import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Microscope, Search, RefreshCw, Activity, CheckCircle2, AlertCircle,
  Clock, Globe, Cpu, Database, TrendingUp, Target, Layers, Users,
  Mail, MapPin, ExternalLink, Zap, ShieldCheck, Building2, Tag,
  BarChart3, Phone, Sparkles, AlertTriangle, FileText, Linkedin,
  Send, CalendarCheck, GitBranch,
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
  useResearchSummary, useResearchHistory, useResearchProviders,
  useResearchHealth, useCompanyResearch, useResearchRefresh,
  useAllCompanyIntelligence, useResearchSources,
} from '@/hooks/useResearchIntelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { PIPELINE_STAGES, useRevenueAIPipeline, type PipelineStageStatus } from '@/hooks/useRevenueAIPipeline';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type {
  CompanyIntelligenceRecord, ResearchRequestRecord,
  ResearchRequestType, ProviderHealth,
} from '@/types/research-intelligence';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe, Building2, Cpu, FileText, Search, Users, Target, Linkedin,
  Mail, Send, CalendarCheck, Database, GitBranch, Sparkles,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ResearchIntelligencePage() {
  const navigate = useNavigate();
  const { workspace, selectedCompany, setSelectedCompany } = useWorkspace();
  const { data: summary, isLoading: summaryLoading } = useResearchSummary();
  const { data: history, isLoading: historyLoading } = useResearchHistory(15);
  const { data: providers } = useResearchProviders();
  const { data: health } = useResearchHealth();
  const { data: intelligenceRecords } = useAllCompanyIntelligence(20);

  const researchMutation = useCompanyResearch();
  const refreshMutation = useResearchRefresh();
  const pipeline = useRevenueAIPipeline();

  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [requestType, setRequestType] = useState<ResearchRequestType>('full_intelligence');
  const [selectedIntelligence, setSelectedIntelligence] = useState<CompanyIntelligenceRecord | null>(null);
  const [liveStages, setLiveStages] = useState<PipelineStageStatus[]>([]);

  const handleFullAnalysis = useCallback(() => {
    if (!companyName.trim()) return;
    setSelectedCompany(companyName.trim());
    setResearchModalOpen(false);
    pipeline.mutate(
      {
        company_name: companyName.trim(),
        website: website.trim() || '',
        workspace_id: workspace?.id ?? null,
        onProgress: (stages) => setLiveStages(stages),
      },
      {
        onSuccess: () => {
          setLiveStages([]);
          navigate('/app/report');
        },
      },
    );
  }, [companyName, website, workspace, pipeline, setSelectedCompany, navigate]);

  const handleResearch = () => {
    if (!companyName.trim()) return;
    setSelectedCompany(companyName.trim());
    researchMutation.mutate({
      companyName: companyName.trim(),
      website: website.trim() || null,
      requestType,
    });
    setResearchModalOpen(false);
    setCompanyName('');
    setWebsite('');
  };

  const handleRefresh = (name: string) => refreshMutation.mutate({ companyName: name });

  const isRunning = pipeline.isPending;
  const completedCount = liveStages.filter((s) => s.status === 'completed').length;
  const failedCount = liveStages.filter((s) => s.status === 'failed').length;

  return (
    <div>
      <PageHeader
        title="Research Intelligence"
        description="Run the full AI pipeline — 14 agents analyze, score, and generate outreach in one pass."
        actions={
          <Button size="sm" onClick={() => setResearchModalOpen(true)} disabled={isRunning}>
            <Sparkles className="h-3.5 w-3.5" />
            {isRunning ? 'Analyzing...' : 'Analyze Company'}
          </Button>
        }
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Activity} label="Total Requests" value={summary ? formatNumber(summary.total_requests) : '—'} loading={summaryLoading} />
        <MetricCard icon={Clock} label="In Progress" value={summary ? formatNumber(summary.pending_requests) : '—'} loading={summaryLoading} tone={summary && summary.pending_requests > 0 ? 'warning' : 'default'} />
        <MetricCard icon={CheckCircle2} label="Completed" value={summary ? formatNumber(summary.completed_requests) : '—'} loading={summaryLoading} tone="success" />
        <MetricCard icon={AlertCircle} label="Failed" value={summary ? formatNumber(summary.failed_requests) : '—'} loading={summaryLoading} tone={summary && summary.failed_requests > 0 ? 'error' : 'default'} />
        <MetricCard icon={Database} label="Intelligence Records" value={summary ? formatNumber(summary.total_intelligence_records) : '—'} loading={summaryLoading} />
        <MetricCard icon={Target} label="Avg Confidence" value={summary ? `${Math.round(summary.average_confidence_score * 100)}%` : '—'} loading={summaryLoading} tone="brand" />
      </div>

      {/* Live pipeline progress */}
      {isRunning && liveStages.length > 0 && (
        <Card className="mb-6 border-brand-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                <CardTitle>Full Pipeline Running — {completedCount}/{liveStages.length} complete</CardTitle>
              </div>
              {failedCount > 0 && <Badge tone="error">{failedCount} failed</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {liveStages.map((stage) => {
                const Icon = ICON_MAP[stage.icon] ?? Sparkles;
                return (
                  <div key={stage.agentName} className="flex items-center gap-3 py-1.5">
                    <div className="flex h-6 w-6 items-center justify-center shrink-0">
                      {stage.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success-400" />}
                      {stage.status === 'running' && <Spinner className="h-3.5 w-3.5" />}
                      {stage.status === 'failed' && <AlertTriangle className="h-4 w-4 text-error-400" />}
                      {stage.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${stage.status === 'pending' ? 'text-ink-500' : 'text-ink-500'}`}>
                          {stage.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {stage.status === 'completed' && (
                            <>
                              <span className="text-xs text-ink-500">{formatMs(stage.durationMs)}</span>
                              {stage.tokensUsed > 0 && <span className="text-xs text-ink-500">{stage.tokensUsed} tok</span>}
                            </>
                          )}
                          {stage.status === 'running' && <span className="text-xs text-brand-400">Running...</span>}
                          {stage.status === 'failed' && <span className="text-xs text-error-400">Failed</span>}
                        </div>
                      </div>
                      {stage.status === 'running' && <p className="text-xs text-ink-500 mt-0.5">{stage.description}</p>}
                      {stage.status === 'failed' && stage.error && <p className="text-xs text-error-400/70 mt-0.5 truncate">{stage.error}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-400" />
                Company Intelligence
              </CardTitle>
              <Badge tone="neutral">{intelligenceRecords?.length ?? 0} records</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {!intelligenceRecords || intelligenceRecords.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-6 w-6" />}
                  title="No Analysis Yet"
                  description="Click 'Analyze Company' to run the full AI pipeline and generate intelligence."
                  action={<Button size="sm" onClick={() => setResearchModalOpen(true)}><Sparkles className="h-3.5 w-3.5" />Analyze Company</Button>}
                />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {intelligenceRecords.map((record) => (
                    <IntelligenceRow key={record.id} record={record} onSelect={() => setSelectedIntelligence(record)} onRefresh={() => handleRefresh(record.company_name)} isRefreshing={refreshMutation.isPending} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-ink-500" />Research History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
              ) : !history || history.length === 0 ? (
                <EmptyState icon={<Clock className="h-6 w-6" />} title="No Research History" description="Research requests will appear here once you start analyzing companies." />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {history.map((req) => <HistoryRow key={req.id} request={req} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-400" />Provider Health</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!health ? <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div> : health.map((p) => <ProviderHealthRow key={p.provider} health={p} />)}
            </CardContent>
          </Card>
          {summary && Object.keys(summary.provider_usage).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-ink-500" />Provider Usage</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.provider_usage).map(([provider, count]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="text-xs text-ink-500 capitalize">{provider}</span>
                    <Badge tone="neutral">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4 text-ink-500" />Available Providers</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {providers?.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-ink-500">{p.name}</span>
                    <span className="text-[10px] text-ink-500 ml-2">{p.capabilities.length} capabilities</span>
                  </div>
                  <Badge tone={p.status === 'active' ? 'success' : 'neutral'} dot>{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <IntelligenceDetailModal intelligence={selectedIntelligence} onClose={() => setSelectedIntelligence(null)} />

      <ResearchModal
        open={researchModalOpen}
        onClose={() => setResearchModalOpen(false)}
        companyName={companyName} setCompanyName={setCompanyName}
        website={website} setWebsite={setWebsite}
        requestType={requestType} setRequestType={setRequestType}
        onResearch={handleResearch} loading={researchMutation.isPending}
        onFullAnalysis={handleFullAnalysis} fullAnalysisLoading={pipeline.isPending}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, loading, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'brand';
}) {
  const toneClasses = { default: 'text-ink-500', success: 'text-success-400', warning: 'text-warning-500', error: 'text-error-400', brand: 'text-brand-400' };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? <Spinner className="h-4 w-4" /> : <span className={cn('text-lg font-semibold', toneClasses[tone])}>{value}</span>}
    </Card>
  );
}

function IntelligenceRow({ record, onSelect, onRefresh, isRefreshing }: {
  record: CompanyIntelligenceRecord; onSelect: () => void; onRefresh: () => void; isRefreshing: boolean;
}) {
  const confidence = record.confidence_score ? Math.round(record.confidence_score * 100) : null;
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer" onClick={onSelect}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-500 truncate">{record.company_name}</span>
          {record.industry && <Badge tone="brand">{record.industry}</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {record.website && <span className="text-xs text-ink-500 truncate flex items-center gap-1"><Globe className="h-3 w-3" />{record.website.replace(/^https?:\/\//, '')}</span>}
          <span className="text-xs text-ink-500">{timeAgo(record.last_updated)}</span>
        </div>
      </div>
      {confidence !== null && (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-card-900 overflow-hidden">
            <div className={cn('h-full rounded-full', confidence >= 80 ? 'bg-success-500' : confidence >= 50 ? 'bg-warning-500' : 'bg-error-500')} style={{ width: `${confidence}%` }} />
          </div>
          <span className={cn('text-xs font-medium', confidence >= 80 ? 'text-success-400' : confidence >= 50 ? 'text-warning-500' : 'text-error-400')}>{confidence}%</span>
        </div>
      )}
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRefresh(); }} disabled={isRefreshing} loading={isRefreshing}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function HistoryRow({ request }: { request: ResearchRequestRecord }) {
  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { completed: 'success', pending: 'warning', planning: 'warning', in_progress: 'warning', aggregating: 'warning', normalizing: 'warning', failed: 'error', cancelled: 'neutral' };
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-500 truncate">{request.company_name}</span>
          <Badge tone="neutral">{request.request_type.replace(/_/g, ' ')}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-ink-500">{timeAgo(request.created_at)}</span>
          {request.providers_used && request.providers_used.length > 0 && <span className="text-xs text-ink-500">{request.providers_used.join(', ')}</span>}
        </div>
      </div>
      <Badge tone={statusTone[request.status] ?? 'neutral'} dot>{request.status.replace(/_/g, ' ')}</Badge>
      {request.confidence_score !== null && <span className="text-xs text-ink-500">{Math.round(request.confidence_score * 100)}%</span>}
    </div>
  );
}

function ProviderHealthRow({ health }: { health: ProviderHealth }) {
  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { active: 'success', degraded: 'warning', inactive: 'neutral', error: 'error' };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-500 capitalize">{health.provider}</span>
        {health.latency_ms !== null && <span className="text-[10px] text-ink-500">{health.latency_ms}ms</span>}
      </div>
      <Badge tone={statusTone[health.status] ?? 'neutral'} dot>{health.status}</Badge>
    </div>
  );
}

function IntelligenceDetailModal({ intelligence, onClose }: { intelligence: CompanyIntelligenceRecord | null; onClose: () => void }) {
  const { data: sources } = useResearchSources(intelligence?.id ?? null);
  if (!intelligence) return null;
  return (
    <Modal open={!!intelligence} onClose={onClose} size="xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-500">{intelligence.company_name}</h2>
            {intelligence.website && <a href={intelligence.website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-1"><Globe className="h-3 w-3" />{intelligence.website.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3" /></a>}
          </div>
          {intelligence.confidence_score !== null && <Badge tone="brand" dot>{Math.round(intelligence.confidence_score * 100)}% confidence</Badge>}
        </div>
        {intelligence.summary && <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Executive Summary</h3><p className="text-sm text-ink-500 leading-relaxed">{intelligence.summary}</p></div>}
        <div className="grid grid-cols-2 gap-4">
          {intelligence.industry && <InfoBlock icon={Tag} label="Industry" value={intelligence.industry} />}
          {intelligence.sub_industry && <InfoBlock icon={Tag} label="Sub-Industry" value={intelligence.sub_industry} />}
          {intelligence.business_model && <InfoBlock icon={TrendingUp} label="Business Model" value={intelligence.business_model} />}
          {intelligence.company_size && <InfoBlock icon={Users} label="Company Size" value={intelligence.company_size} />}
        </div>
        {intelligence.locations && intelligence.locations.length > 0 && (
          <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Locations</h3><div className="flex flex-wrap gap-2">{intelligence.locations.map((loc, i) => <Badge key={i} tone="neutral"><MapPin className="h-3 w-3" />{loc}</Badge>)}</div></div>
        )}
        {intelligence.technology_stack && intelligence.technology_stack.length > 0 && (
          <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Technology Stack</h3><div className="flex flex-wrap gap-2">{intelligence.technology_stack.map((tech, i) => <Badge key={i} tone="brand"><Layers className="h-3 w-3" />{tech.name}<span className="text-[10px] text-ink-500 ml-1">{tech.category}</span></Badge>)}</div></div>
        )}
        {intelligence.services && intelligence.services.length > 0 && (
          <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Services</h3><div className="space-y-1.5">{intelligence.services.map((s, i) => <div key={i} className="flex items-start gap-2 text-sm text-ink-500"><Zap className="h-3.5 w-3.5 text-brand-400 mt-0.5 shrink-0" /><div><span className="font-medium">{s.name}</span>{s.description && <span className="text-ink-500 ml-2">{s.description}</span>}</div></div>)}</div></div>
        )}
        {intelligence.buying_signals && intelligence.buying_signals.length > 0 && (
          <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Buying Signals</h3><div className="space-y-2">{intelligence.buying_signals.map((sig, i) => <div key={i} className="rounded-lg border border-gold-500/12 bg-card-900 p-3"><div className="flex items-center justify-between mb-1"><Badge tone="warning" dot>{sig.signal_type.replace(/_/g, ' ')}</Badge><span className="text-xs text-ink-500">{Math.round(sig.confidence * 100)}% confidence</span></div><p className="text-xs text-ink-500">{sig.description}</p></div>)}</div></div>
        )}
        {sources && sources.length > 0 && (
          <div><h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Source Attribution</h3><div className="space-y-1.5">{sources.map((src, i) => <div key={i} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><Badge tone="neutral">{src.provider}</Badge>{src.source_url && <a href={src.source_url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 truncate max-w-[200px]">{src.source_url.replace(/^https?:\/\//, '')}</a>}</div><span className="text-ink-500">{Math.round(src.confidence_score * 100)}%</span></div>)}</div></div>
        )}
        <div className="text-xs text-ink-500 pt-2 border-t border-gold-500/8">Last updated: {timeAgo(intelligence.last_updated)}</div>
      </div>
    </Modal>
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center gap-1.5 mb-1"><Icon className="h-3 w-3 text-ink-500" /><span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span></div>
      <span className="text-sm text-ink-500">{value}</span>
    </div>
  );
}

function ResearchModal({ open, onClose, companyName, setCompanyName, website, setWebsite, requestType, setRequestType, onResearch, loading, onFullAnalysis, fullAnalysisLoading }: {
  open: boolean; onClose: () => void; companyName: string; setCompanyName: (v: string) => void;
  website: string; setWebsite: (v: string) => void; requestType: ResearchRequestType; setRequestType: (v: ResearchRequestType) => void;
  onResearch: () => void; loading: boolean; onFullAnalysis: () => void; fullAnalysisLoading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-400" />
          <h2 className="text-base font-semibold text-ink-500">Analyze Company</h2>
        </div>
        <div>
          <Label>Company Name</Label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Corporation" autoFocus />
        </div>
        <div>
          <Label>Website (optional)</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="e.g. acme.com" />
        </div>

        {/* Full pipeline - primary action */}
        <div className="rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-ink-500">Full AI Pipeline (Recommended)</span>
          </div>
          <p className="text-xs text-ink-500">Runs all 14 agents: research, intelligence, SEO, ICP, buying signals, decision makers, proposal, email, follow-up, meeting brief, and workflow decision.</p>
          <Button className="w-full" onClick={onFullAnalysis} loading={fullAnalysisLoading} disabled={!companyName.trim()}>
            <Sparkles className="h-3.5 w-3.5" />
            Run Full Analysis
          </Button>
        </div>

        {/* Quick research - secondary */}
        <div className="space-y-2">
          <div>
            <Label>Quick Research Type</Label>
            <Select value={requestType} onChange={(e) => setRequestType(e.target.value as ResearchRequestType)}>
              <option value="full_intelligence">Full Intelligence</option>
              <option value="company_profile">Company Profile</option>
              <option value="technology_stack">Technology Stack</option>
              <option value="seo_analysis">SEO Analysis</option>
              <option value="business_model">Business Model</option>
              <option value="buying_signals">Buying Signals</option>
              <option value="growth_signals">Growth Signals</option>
            </Select>
          </div>
          <Button variant="outline" className="w-full" onClick={onResearch} loading={loading} disabled={!companyName.trim()}>
            <Search className="h-3.5 w-3.5" />
            Quick Research Only
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="w-full">Cancel</Button>
      </div>
    </Modal>
  );
}
