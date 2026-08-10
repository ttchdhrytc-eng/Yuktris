import {
  Sparkles, Building2, Users, Target, Zap, TrendingUp, Radar, Activity,
  CheckCircle2, AlertTriangle, Clock, Database, Radio, Lightbulb,
  ArrowRight, Brain, Award, Layers, Gauge,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, timeAgo } from '@/lib/utils';
import type {
  DiscoveryDashboard, CompanyWithDetails, ContactWithDetails,
  DiscoveryJob, ProviderSource, ProspectList, SmartFilters,
} from '@/types/prospect-discovery-engine';

// ============================================================
// DiscoveryAIBadge
// ============================================================
export function DiscoveryAIBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI{confidence ? ` · ${Math.round(confidence)}%` : ''}
    </Badge>
  );
}

// ============================================================
// ScoreBar
// ============================================================
export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const color = score >= 70 ? 'bg-success-500' : score >= 40 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-500 w-20 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{score}</span>
    </div>
  );
}

// ============================================================
// DiscoveryDashboardSection
// ============================================================
export function DiscoveryDashboardSection({ dashboard, onRunDiscovery, isRunning }: {
  dashboard: DiscoveryDashboard;
  onRunDiscovery: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-brand-400" />
            <span className="text-xs text-ink-500">Companies</span>
          </div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalCompanies}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-success-400" />
            <span className="text-xs text-ink-500">Decision Makers</span>
          </div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalContacts}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-warning-500" />
            <span className="text-xs text-ink-500">Qualified</span>
          </div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalQualified}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-4 w-4 text-brand-400" />
            <span className="text-xs text-ink-500">Avg Score</span>
          </div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.avgScore}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
            <Radar className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-500">Discovery Pipeline</p>
            <p className="text-xs text-ink-500">
              {dashboard.activeJobs > 0 ? `${dashboard.activeJobs} active job(s) running` : 'No active jobs'}
            </p>
          </div>
        </div>
        <Button variant="glow" onClick={onRunDiscovery} loading={isRunning}>
          <Zap className="h-4 w-4" />
          Run Discovery
        </Button>
      </div>

      {dashboard.topCompanies.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-success-400" />
            <span className="text-sm font-medium text-ink-500">Top Companies</span>
          </div>
          <div className="space-y-2">
            {dashboard.topCompanies.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                    <Building2 className="h-4 w-4 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{c.name}</p>
                    <p className="text-xs text-ink-500">{c.industry ?? '—'} · {c.employee_count ?? c.size ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.signals.length > 0 && <Badge tone="warning">{c.signals.length} signals</Badge>}
                  {c.score && <span className="text-sm font-bold text-ink-500">{c.score.overall_prospect_score}</span>}
                  <DiscoveryAIBadge confidence={c.confidence_score * 100} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dashboard.topContacts.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-success-400" />
            <span className="text-sm font-medium text-ink-500">Top Decision Makers</span>
          </div>
          <div className="space-y-2">
            {dashboard.topContacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10">
                    <Users className="h-4 w-4 text-success-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{c.full_name ?? `${c.first_name} ${c.last_name}`}</p>
                    <p className="text-xs text-ink-500">{c.job_title ?? '—'} · {c.company?.name ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.score && <span className="text-sm font-bold text-ink-500">{c.score.overall_prospect_score}</span>}
                  <DiscoveryAIBadge confidence={c.confidence_score * 100} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// CompaniesSection
// ============================================================
export function CompaniesSection({ companies }: { companies: CompanyWithDetails[] }) {
  if (companies.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No companies discovered yet. Run a discovery pipeline to find prospects.</div>;
  }
  return (
    <div className="space-y-3">
      {companies.map((company) => (
        <Card key={company.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                <Building2 className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{company.name}</p>
                <p className="text-xs text-ink-500">{company.industry ?? '—'} · {company.employee_count ?? company.size ?? '—'} · {company.country ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {company.score && <span className="text-lg font-bold text-ink-500">{company.score.overall_prospect_score}</span>}
              <DiscoveryAIBadge confidence={company.confidence_score * 100} />
            </div>
          </div>

          {company.description && <p className="text-sm text-ink-500 mb-3 line-clamp-2">{company.description}</p>}

          {company.score && (
            <div className="space-y-1.5 mb-3">
              <ScoreBar score={company.score.company_score} label="Company" />
              <ScoreBar score={company.score.reply_probability * 100} label="Reply %" />
              <ScoreBar score={company.score.meeting_probability * 100} label="Meeting %" />
            </div>
          )}

          {company.signals.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-ink-500 mb-1 block">Buying Signals</span>
              <div className="flex flex-wrap gap-1.5">
                {company.signals.slice(0, 5).map((s) => (
                  <Badge key={s.id} tone="warning" className="capitalize">{s.signal_type.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            </div>
          )}

          {company.technologies.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-ink-500 mb-1 block">Technologies</span>
              <div className="flex flex-wrap gap-1.5">
                {company.technologies.slice(0, 6).map((t) => (
                  <Badge key={t.id} tone="neutral">{t.technology_name}</Badge>
                ))}
              </div>
            </div>
          )}

          {company.recommendation && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-ink-500">{company.recommendation.why_company}</p>
                  {company.recommendation.suggested_campaign && (
                    <p className="text-xs text-ink-500">Campaign: {company.recommendation.suggested_campaign} · CTA: {company.recommendation.suggested_cta ?? '—'}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// DecisionMakersSection
// ============================================================
export function DecisionMakersSection({ contacts }: { contacts: ContactWithDetails[] }) {
  if (contacts.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No decision makers discovered yet.</div>;
  }
  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <Card key={contact.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
                <Users className="h-5 w-5 text-success-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{contact.full_name ?? `${contact.first_name} ${contact.last_name}`}</p>
                <p className="text-xs text-ink-500">{contact.job_title ?? '—'} · {contact.department ?? '—'}</p>
                <p className="text-xs text-ink-500">{contact.company?.name ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {contact.score && <span className="text-lg font-bold text-ink-500">{contact.score.overall_prospect_score}</span>}
              <DiscoveryAIBadge confidence={contact.confidence_score * 100} />
            </div>
          </div>

          {contact.score && (
            <div className="space-y-1.5 mb-3">
              <ScoreBar score={contact.score.decision_maker_score} label="DM Score" />
              <ScoreBar score={contact.score.reply_probability * 100} label="Reply %" />
              <ScoreBar score={contact.score.meeting_probability * 100} label="Meeting %" />
            </div>
          )}

          {contact.profile && contact.profile.personal_summary && (
            <p className="text-sm text-ink-500 mb-3 line-clamp-2">{contact.profile.personal_summary}</p>
          )}

          {contact.skills.length > 0 && (
            <div className="mb-3">
              <span className="text-xs text-ink-500 mb-1 block">Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {contact.skills.slice(0, 6).map((s) => (
                  <Badge key={s.id} tone="brand">{s.skill_name}</Badge>
                ))}
              </div>
            </div>
          )}

          {contact.recommendation && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-ink-500">{contact.recommendation.why_person}</p>
                  {contact.recommendation.suggested_cta && <p className="text-xs text-ink-500">CTA: {contact.recommendation.suggested_cta}</p>}
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// DiscoveryJobsSection
// ============================================================
export function DiscoveryJobsSection({ jobs }: { jobs: DiscoveryJob[] }) {
  if (jobs.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No discovery jobs yet.</div>;
  }
  const statusTone = { completed: 'success', processing: 'brand', pending: 'neutral', failed: 'error', cancelled: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card key={job.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job.status === 'processing' ? <Activity className="h-4 w-4 text-brand-400 animate-pulse" /> : <Database className="h-4 w-4 text-ink-500" />}
              <span className="text-sm text-ink-500 capitalize">{job.job_type.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone[job.status]} dot>{job.status}</Badge>
              <span className="text-xs text-ink-500">{timeAgo(job.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-500">
            <span>{job.companies_found} companies</span>
            <span>{job.contacts_found} contacts</span>
            <span>{job.duplicates_merged} merged</span>
            {job.provider_used && <span className="capitalize">{job.provider_used.replace(/_/g, ' ')}</span>}
          </div>
          {job.error_message && <p className="text-xs text-error-400 mt-1">{job.error_message}</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// ProviderStatusSection
// ============================================================
export function ProviderStatusSection({ providers }: { providers: ProviderSource[] }) {
  if (providers.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No providers initialized.</div>;
  }
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Card key={p.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                <Radio className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-500">{p.provider_name}</p>
                <p className="text-xs text-ink-500 capitalize">{p.provider_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="neutral" dot>Inactive</Badge>}
              {p.api_key_configured ? <Badge tone="brand">API Key</Badge> : <Badge tone="neutral">No Key</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-500">
            <span>{p.total_requests} requests</span>
            <span>{p.successful_requests} successful</span>
            <span>{p.failed_requests} failed</span>
            {p.last_used_at && <span>Last used {timeAgo(p.last_used_at)}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// SavedListsSection
// ============================================================
export function SavedListsSection({ lists, onCreateList }: { lists: ProspectList[]; onCreateList: (name: string, description?: string) => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateList(name.trim(), desc.trim() || undefined);
    setName('');
    setDesc('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
          <Target className="h-3.5 w-3.5" />
          New List
        </Button>
      </div>
      {showCreate && (
        <Card className="p-4 space-y-3">
          <input className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button size="sm" variant="glow" onClick={handleCreate}>Create</Button>
        </Card>
      )}
      {lists.length === 0 && !showCreate && (
        <div className="text-center py-8 text-sm text-ink-500">No saved prospect lists yet.</div>
      )}
      {lists.map((list) => (
        <Card key={list.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-500">{list.list_name}</p>
              {list.description && <p className="text-xs text-ink-500">{list.description}</p>}
            </div>
            <Badge tone="brand">{list.member_count} members</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// SmartFiltersSection
// ============================================================
export function SmartFiltersSection({ filters, onChange }: {
  filters: SmartFilters;
  onChange: (filters: SmartFilters) => void;
}) {
  const update = (key: keyof SmartFilters, value: string | boolean | number | string[] | undefined) => {
    onChange({ ...filters, [key]: value || undefined });
  };
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-brand-400" />
        <span className="text-sm font-medium text-ink-500">Smart Filters</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-500">Industry</label>
          <input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="SaaS" value={filters.industry ?? ''} onChange={(e) => update('industry', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500">Company Size</label>
          <input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="50-500" value={filters.companySize ?? ''} onChange={(e) => update('companySize', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500">Country</label>
          <input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="USA" value={filters.country ?? ''} onChange={(e) => update('country', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500">Min Score</label>
          <input type="number" className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="70" value={filters.minScore ?? ''} onChange={(e) => update('minScore', e.target.value ? parseInt(e.target.value) : undefined)} />
        </div>
        <div>
          <label className="text-xs text-ink-500">Persona / Title</label>
          <input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="VP Sales" value={filters.persona ?? ''} onChange={(e) => update('persona', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500">Department</label>
          <input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-2 py-1.5 text-sm text-ink-500" placeholder="Sales" value={filters.department ?? ''} onChange={(e) => update('department', e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-ink-500 cursor-pointer">
          <input type="checkbox" checked={filters.hiring ?? false} onChange={(e) => update('hiring', e.target.checked)} className="rounded" />
          Hiring Activity
        </label>
      </div>
    </Card>
  );
}

// ============================================================
// LiveDiscoveryFeedSection
// ============================================================
export function LiveDiscoveryFeedSection({ jobs }: { jobs: DiscoveryJob[] }) {
  const recent = jobs.slice(0, 10);
  if (recent.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No discovery activity yet.</div>;
  }
  return (
    <div className="space-y-2">
      {recent.map((job) => (
        <div key={job.id} className="flex items-center gap-3 rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
          {job.status === 'processing' ? (
            <Activity className="h-4 w-4 text-brand-400 animate-pulse shrink-0" />
          ) : job.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0" />
          ) : job.status === 'failed' ? (
            <AlertTriangle className="h-4 w-4 text-error-400 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-ink-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-500 capitalize">{job.job_type.replace(/_/g, ' ')}</p>
            <p className="text-xs text-ink-500">
              {job.companies_found} companies · {job.contacts_found} contacts · {timeAgo(job.created_at)}
            </p>
          </div>
          {job.provider_used && <Badge tone="neutral" className="capitalize">{job.provider_used.replace(/_/g, ' ')}</Badge>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// RecommendationsSection
// ============================================================
export function RecommendationsSection({ companies }: { companies: CompanyWithDetails[] }) {
  const withRecs = companies.filter((c) => c.recommendation);
  if (withRecs.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No AI recommendations yet. Run discovery to generate recommendations.</div>;
  }
  return (
    <div className="space-y-3">
      {withRecs.map((company) => (
        <Card key={company.id} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-brand-400" />
            <p className="text-sm font-semibold text-ink-500">{company.name}</p>
            <DiscoveryAIBadge confidence={company.recommendation!.confidence_score * 100} />
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-ink-500 w-16 shrink-0">Why Co?</span>
              <p className="text-sm text-ink-500">{company.recommendation!.why_company}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-ink-500 w-16 shrink-0">Why Now?</span>
              <p className="text-sm text-ink-500">{company.recommendation!.why_now}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-ink-500 w-16 shrink-0">Campaign</span>
              <p className="text-sm text-ink-500">{company.recommendation!.suggested_campaign ?? '—'}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-ink-500 w-16 shrink-0">Angle</span>
              <p className="text-sm text-ink-500">{company.recommendation!.suggested_messaging_angle ?? '—'}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-ink-500 w-16 shrink-0">CTA</span>
              <p className="text-sm text-ink-500">{company.recommendation!.suggested_cta ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gold-500/8">
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink-500">Reply:</span>
              <span className="text-sm font-medium text-ink-500">{Math.round((company.recommendation!.reply_probability ?? 0) * 100)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-ink-500">Meeting:</span>
              <span className="text-sm font-medium text-ink-500">{Math.round((company.recommendation!.meeting_probability ?? 0) * 100)}%</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// DiscoveryEmpty
// ============================================================
export function DiscoveryEmpty({ onRun, isRunning }: { onRun: () => void; isRunning: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
        <Radar className="h-8 w-8 text-brand-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Start Prospect Discovery</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
          The Prospect Discovery Engine uses your Revenue Strategy to discover companies, find decision makers, evaluate buying signals, score prospects, and generate AI recommendations — all through a multi-provider pipeline.
        </p>
      </div>
      <Button variant="glow" size="lg" onClick={onRun} loading={isRunning}>
        <Radar className="h-4 w-4" />
        Run Discovery Pipeline
      </Button>
    </div>
  );
}
