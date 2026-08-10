import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Globe, Cpu, FileText, Search, Users, Target, Linkedin,
  Mail, Send, CalendarCheck, Database, GitBranch, Sparkles,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowRight,
  ChevronDown, ChevronUp, ExternalLink, Brain, BarChart3, Lightbulb,
  Download, Copy, Printer, FileDown, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner, PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PIPELINE_STAGES, useRevenueAIPipeline, type PipelineStageStatus } from '@/hooks/useRevenueAIPipeline';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe, Building2, Cpu, FileText, Search, Users, Target, Linkedin,
  Mail, Send, CalendarCheck, Database, GitBranch, Sparkles,
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ScoreBar({ label, value, tone = 'brand' }: { label: string; value: number; tone?: string }) {
  const pct = Math.round(value);
  const colorClass = pct >= 75 ? 'bg-success-500' : pct >= 50 ? 'bg-warning-500' : pct >= 25 ? 'bg-orange-500' : 'bg-error-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="font-medium text-ink-500">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-card-900 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReportSection({
  title, icon: Icon, children, defaultOpen = false, accent,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ?? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-ink-500" /> : <ChevronDown className="h-4 w-4 text-ink-500" />}
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

function DataList({ items, emptyMsg = 'No data available' }: { items?: { label: string; value: string | number }[]; emptyMsg?: string }) {
  if (!items || items.length === 0) return <p className="text-xs text-ink-500 italic">{emptyMsg}</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-ink-500">{item.label}</span>
          <span className="text-sm text-ink-500">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items, emptyMsg = 'No items available' }: { items?: string[]; emptyMsg?: string }) {
  if (!items || items.length === 0) return <p className="text-xs text-ink-500 italic">{emptyMsg}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-ink-500">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-300 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ObjectList({ items, fields, emptyMsg = 'No items available' }: {
  items?: Record<string, unknown>[] | null;
  fields: { key: string; label: string }[];
  emptyMsg?: string;
}) {
  if (!items || !Array.isArray(items) || items.length === 0) return <p className="text-xs text-ink-500 italic">{emptyMsg}</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-gold-500/8 bg-card-900/50 p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {fields.map((f) => {
              const val = item[f.key];
              if (val === undefined || val === null) return null;
              return (
                <div key={f.key} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wide text-ink-500">{f.label}</span>
                  <span className="text-xs text-ink-500">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RevenueReportPage() {
  const { workspace, selectedCompany, setSelectedCompany } = useWorkspace();
  const pipeline = useRevenueAIPipeline();
  const [companyName, setCompanyName] = useState(selectedCompany ?? '');
  const [website, setWebsite] = useState('');
  const [showLaunch, setShowLaunch] = useState(false);

  // Load latest pipeline results for selected company
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['revenue-report', workspace?.id, selectedCompany],
    queryFn: async () => {
      if (!workspace?.id || !selectedCompany) return null;
      const { data } = await supabase
        .from('memory_entities')
        .select('memory_type, content, created_at')
        .eq('workspace_id', workspace.id)
        .eq('memory_type', 'like', 'pipeline_%')
        .order('created_at', { ascending: false })
        .limit(50);

      return data;
    },
    enabled: !!workspace?.id && !!selectedCompany,
  });

  const agentOutputs = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {};
    if (pipelineData) {
      for (const row of pipelineData) {
        const agentName = row.memory_type.replace('pipeline_', '');
        if (agentName !== 'summary') {
          map[agentName] = row.content as Record<string, unknown>;
        }
      }
    }
    // Also include live pipeline results if available
    if (pipeline.data?.results) {
      for (const [name, result] of Object.entries(pipeline.data.results)) {
        if (result.status === 'completed') {
          map[name] = result.output as Record<string, unknown>;
        }
      }
    }
    return map;
  }, [pipelineData, pipeline.data]);

  const summary = useMemo(() => {
    if (pipelineData) {
      const summaryRow = pipelineData.find((r) => r.memory_type === 'pipeline_summary');
      if (summaryRow) return summaryRow.content as Record<string, unknown>;
    }
    if (pipeline.data?.summary) {
      return {
        lead_value: pipeline.data.summary.lead_value,
        lead_score: pipeline.data.summary.lead_score,
        recommended_action: pipeline.data.summary.recommended_action,
        summary: pipeline.data.summary.summary,
      } as Record<string, unknown>;
    }
    return null;
  }, [pipelineData, pipeline.data]);

  const handleAnalyze = () => {
    if (!companyName.trim()) return;
    setSelectedCompany(companyName.trim());
    pipeline.mutate({
      company_name: companyName.trim(),
      website: website.trim() || '',
      workspace_id: workspace?.id ?? null,
    });
    setShowLaunch(false);
  };

  const liveStages = pipeline.data?.stages ?? [];
  const isRunning = pipeline.isPending;
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildMarkdown = (): string => {
    const lines: string[] = [];
    lines.push(`# Revenue Intelligence Report`);
    lines.push(`**Company:** ${selectedCompany ?? companyName}`);
    lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
    lines.push('');
    if (summary) {
      lines.push(`## Executive Summary`);
      lines.push(String(summary['summary'] ?? ''));
      lines.push(`- **Lead Value:** ${summary['lead_value']}`);
      lines.push(`- **Lead Score:** ${summary['lead_score']}/100`);
      lines.push(`- **Next Action:** ${summary['recommended_action']}`);
      lines.push('');
    }
    for (const [agent, output] of Object.entries(agentOutputs)) {
      lines.push(`## ${agent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`);
      lines.push('```json');
      lines.push(JSON.stringify(output, null, 2));
      lines.push('```');
      lines.push('');
    }
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildMarkdown());
    setCopied(true);
    toast.success('Report copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([buildMarkdown()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-report-${(selectedCompany ?? 'company').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Markdown downloaded');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!workspace) {
    return <PageLoader label="Loading workspace..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Intelligence Report"
        description="One complete analysis — research, intelligence, proposal, outreach, and meeting prep"
        actions={
          <div className="flex items-center gap-2">
            {Object.keys(agentOutputs).length > 0 && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-gold-500/12 bg-maroon-900 shadow-xl animate-scale-in py-1 z-50">
                    <button onClick={handlePrint} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-500 hover:bg-card-800 hover:text-ink-500 transition-colors">
                      <Printer className="h-3.5 w-3.5" /> Print / PDF
                    </button>
                    <button onClick={handleDownloadMarkdown} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-500 hover:bg-card-800 hover:text-ink-500 transition-colors">
                      <FileDown className="h-3.5 w-3.5" /> Download Markdown
                    </button>
                    <button onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-500 hover:bg-card-800 hover:text-ink-500 transition-colors">
                      {copied ? <Check className="h-3.5 w-3.5 text-success-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <Button onClick={() => setShowLaunch(!showLaunch)} disabled={isRunning}>
              <Sparkles className="h-4 w-4" />
              {isRunning ? 'Analyzing...' : 'Analyze Company'}
            </Button>
          </div>
        }
      />

      {/* Launch panel */}
      {showLaunch && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1.5 block">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full h-9 px-3 rounded-lg bg-card-900 border border-gold-500/12 text-sm text-ink-500 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500 mb-1.5 block">Website (optional)</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. acme.com"
                  className="w-full h-9 px-3 rounded-lg bg-card-900 border border-gold-500/12 text-sm text-ink-500 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAnalyze} loading={isRunning} disabled={!companyName.trim()}>
                <Sparkles className="h-4 w-4" />
                Run Full Analysis
              </Button>
              <Button variant="ghost" onClick={() => setShowLaunch(false)}>Cancel</Button>
            </div>
            <p className="text-xs text-ink-500">
              Runs all 14 AI agents: website research, company intelligence, technology detection, SEO, ICP scoring, buying signals, decision makers, proposal, email, follow-up, meeting brief, and workflow decision.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Live pipeline progress */}
      {isRunning && liveStages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              <CardTitle>Pipeline Running — {liveStages.filter(s => s.status === 'completed').length}/{liveStages.length} stages complete</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {liveStages.map((stage) => {
                const Icon = ICON_MAP[stage.icon] ?? Sparkles;
                return (
                  <div key={stage.agentName} className="flex items-center gap-3 py-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0">
                      {stage.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-success-400" />}
                      {stage.status === 'running' && <Spinner className="h-4 w-4" />}
                      {stage.status === 'failed' && <AlertTriangle className="h-5 w-5 text-error-400" />}
                      {stage.status === 'pending' && <div className="h-2 w-2 rounded-full bg-gray-600" />}
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
                              {stage.tokensUsed > 0 && <span className="text-xs text-ink-500">{stage.tokensUsed} tokens</span>}
                            </>
                          )}
                          {stage.status === 'failed' && <span className="text-xs text-error-400">Failed</span>}
                        </div>
                      </div>
                      {stage.status === 'running' && (
                        <p className="text-xs text-ink-500 mt-0.5">{stage.description}</p>
                      )}
                      {stage.status === 'failed' && stage.error && (
                        <p className="text-xs text-error-400/70 mt-0.5 truncate">{stage.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!isRunning && Object.keys(agentOutputs).length === 0 && !isLoading && (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No Analysis Yet"
          description="Click 'Analyze Company' above to run the full AI pipeline and generate a complete revenue intelligence report."
        />
      )}

      {/* Loading state */}
      {isLoading && <PageLoader label="Loading report..." />}

      {/* Report sections */}
      {Object.keys(agentOutputs).length > 0 && (
        <>
          {/* Executive Summary */}
          {summary && (
            <Card className="border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/15 text-brand-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-ink-500">Executive Summary</h3>
                </div>
                <p className="text-sm text-ink-500 leading-relaxed">
                  {String(summary['summary'] ?? 'Analysis complete.')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="rounded-lg border border-gold-500/8 bg-card-900/50 p-3">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">Lead Value</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge tone={String(summary['lead_value']) === 'high' ? 'success' : String(summary['lead_value']) === 'medium' ? 'warning' : 'neutral'}>
                        {String(summary['lead_value'] ?? 'medium')}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gold-500/8 bg-card-900/50 p-3">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">Lead Score</span>
                    <p className="text-lg font-semibold text-ink-500 mt-0.5">{Number(summary['lead_score'] ?? 0)}/100</p>
                  </div>
                  <div className="rounded-lg border border-gold-500/8 bg-card-900/50 p-3">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">Next Action</span>
                    <p className="text-sm font-medium text-brand-400 mt-0.5 capitalize">{String(summary['recommended_action'] ?? 'email')}</p>
                  </div>
                  <div className="rounded-lg border border-gold-500/8 bg-card-900/50 p-3">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">Confidence</span>
                    <ScoreBar label="" value={Number(summary['confidence'] ?? 0) * 100} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Company Overview */}
            <ReportSection title="Company Overview" icon={Building2} defaultOpen>
              <DataList items={[
                { label: 'Name', value: String(agentOutputs['company_intelligence_agent']?.['description'] ?? companyName) },
                { label: 'Industry', value: String(agentOutputs['company_intelligence_agent']?.['industry'] ?? 'N/A') },
                { label: 'Headquarters', value: String(agentOutputs['company_intelligence_agent']?.['headquarters'] ?? 'N/A') },
                { label: 'Employees', value: String(agentOutputs['company_intelligence_agent']?.['employee_estimate'] ?? 'N/A') },
                { label: 'Revenue', value: String(agentOutputs['company_intelligence_agent']?.['revenue_estimate'] ?? 'N/A') },
                { label: 'Website', value: website || 'N/A' },
              ]} />
              <div>
                <span className="text-xs font-medium text-ink-500">Target Customers</span>
                <BulletList items={(agentOutputs['company_intelligence_agent']?.['target_customers'] as string[]) ?? undefined} />
              </div>
            </ReportSection>

            {/* Business Model */}
            <ReportSection title="Business Model" icon={TrendingUp} defaultOpen>
              <DataList items={[
                { label: 'Business Model', value: String(agentOutputs['executive_summary_agent']?.['business_summary'] ?? 'N/A') },
              ]} />
              <div>
                <span className="text-xs font-medium text-ink-500">Pain Points</span>
                <ObjectList
                  items={(agentOutputs['executive_summary_agent']?.['pain_points'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'point', label: 'Issue' }, { key: 'severity', label: 'Severity' }, { key: 'evidence', label: 'Evidence' }]}
                />
              </div>
            </ReportSection>

            {/* Technology Stack */}
            <ReportSection title="Technology Stack" icon={Cpu}>
              <BulletList items={(agentOutputs['technology_detection_agent']?.['technologies'] as string[]) ?? undefined} />
              {agentOutputs['technology_detection_agent']?.['categories'] && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(agentOutputs['technology_detection_agent']['categories'] as Record<string, unknown>)
                    .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0)
                    .map(([cat, tools]) => (
                      <div key={cat} className="rounded-lg border border-gold-500/8 bg-card-900/50 p-2">
                        <span className="text-[10px] uppercase tracking-wide text-ink-500 capitalize">{cat.replace('_', ' ')}</span>
                        <p className="text-xs text-ink-500 mt-0.5">{(tools as string[]).join(', ')}</p>
                      </div>
                    ))}
                </div>
              )}
            </ReportSection>

            {/* Market Position */}
            <ReportSection title="Market Position" icon={Globe}>
              <div>
                <span className="text-xs font-medium text-ink-500">Competitors</span>
                <BulletList items={(agentOutputs['company_intelligence_agent']?.['competitors'] as string[]) ?? undefined} />
              </div>
              <div>
                <span className="text-xs font-medium text-ink-500">Recent News</span>
                <BulletList items={(agentOutputs['company_intelligence_agent']?.['recent_news'] as string[]) ?? undefined} />
              </div>
            </ReportSection>

            {/* SEO Audit */}
            <ReportSection title="SEO Audit" icon={Search}>
              {agentOutputs['seo_analysis_agent']?.['technical_seo'] && (
                <DataList items={Object.entries(agentOutputs['seo_analysis_agent']['technical_seo'] as Record<string, unknown>)
                  .filter(([, v]) => typeof v !== 'object')
                  .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }))} />
              )}
              <div>
                <span className="text-xs font-medium text-ink-500">Priority Fixes</span>
                <ObjectList
                  items={(agentOutputs['seo_analysis_agent']?.['priority_fixes'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'issue', label: 'Issue' }, { key: 'impact', label: 'Impact' }, { key: 'priority', label: 'Priority' }]}
                />
              </div>
            </ReportSection>

            {/* Growth Opportunities */}
            <ReportSection title="Growth Opportunities" icon={TrendingUp} accent="bg-success-500/10 text-success-400">
              <div>
                <span className="text-xs font-medium text-ink-500">Opportunities</span>
                <ObjectList
                  items={(agentOutputs['executive_summary_agent']?.['opportunities'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'opportunity', label: 'Opportunity' }, { key: 'potential_impact', label: 'Impact' }, { key: 'time_to_value', label: 'Time to Value' }]}
                />
              </div>
              <div>
                <span className="text-xs font-medium text-ink-500">Recommended Services</span>
                <BulletList items={(agentOutputs['executive_summary_agent']?.['recommended_services'] as string[]) ?? undefined} />
              </div>
            </ReportSection>

            {/* ICP */}
            <ReportSection title="ICP Analysis" icon={Users}>
              <DataList items={[
                { label: 'ICP Score', value: String(agentOutputs['icp_scoring_agent']?.['icp_score'] ?? 'N/A') },
                { label: 'Digital Maturity', value: String(agentOutputs['icp_scoring_agent']?.['digital_maturity'] ?? 'N/A') },
                { label: 'Marketing Maturity', value: String(agentOutputs['icp_scoring_agent']?.['marketing_maturity'] ?? 'N/A') },
                { label: 'Revenue Band', value: String(agentOutputs['icp_scoring_agent']?.['revenue_band'] ?? 'N/A') },
              ]} />
              <div>
                <span className="text-xs font-medium text-ink-500">Buyer Personas</span>
                <ObjectList
                  items={(agentOutputs['icp_scoring_agent']?.['buyer_personas'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'role', label: 'Role' }, { key: 'seniority', label: 'Seniority' }, { key: 'priorities', label: 'Priorities' }]}
                />
              </div>
            </ReportSection>

            {/* Buying Signals */}
            <ReportSection title="Buying Signals" icon={Target} accent="bg-warning-500/10 text-warning-500">
              <DataList items={[
                { label: 'Urgency Score', value: String(agentOutputs['buying_signal_agent']?.['urgency_score'] ?? 'N/A') },
              ]} />
              <div>
                <span className="text-xs font-medium text-ink-500">Hiring Signals</span>
                <BulletList items={(agentOutputs['buying_signal_agent']?.['hiring_signals'] as string[]) ?? undefined} />
              </div>
              <div>
                <span className="text-xs font-medium text-ink-500">Funding & Expansion</span>
                <BulletList items={[
                  ...((agentOutputs['buying_signal_agent']?.['funding'] as string[]) ?? []),
                  ...((agentOutputs['buying_signal_agent']?.['expansion'] as string[]) ?? []),
                ]} />
              </div>
            </ReportSection>

            {/* Decision Makers */}
            <ReportSection title="Decision Makers" icon={Linkedin} accent="bg-info-500/10 text-info-600">
              <ObjectList
                items={(agentOutputs['linkedin_intelligence_agent']?.['decision_makers'] as Record<string, unknown>[]) ?? undefined}
                fields={[
                  { key: 'name', label: 'Name' },
                  { key: 'title', label: 'Title' },
                  { key: 'department', label: 'Department' },
                  { key: 'confidence', label: 'Confidence' },
                ]}
              />
              <div>
                <span className="text-xs font-medium text-ink-500">Suggested Contacts</span>
                <BulletList items={(agentOutputs['linkedin_intelligence_agent']?.['suggested_contacts'] as string[]) ?? undefined} />
              </div>
            </ReportSection>

            {/* Proposal Summary */}
            <ReportSection title="Proposal Summary" icon={FileText} defaultOpen>
              <p className="text-sm text-ink-500 leading-relaxed">
                {String(agentOutputs['proposal_generator_agent']?.['executive_summary'] ?? 'No proposal generated yet.')}
              </p>
              <div>
                <span className="text-xs font-medium text-ink-500">Key Problems</span>
                <ObjectList
                  items={(agentOutputs['proposal_generator_agent']?.['problems'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'problem', label: 'Problem' }, { key: 'impact', label: 'Impact' }]}
                />
              </div>
              <div>
                <span className="text-xs font-medium text-ink-500">Recommended Solutions</span>
                <ObjectList
                  items={(agentOutputs['proposal_generator_agent']?.['solutions'] as Record<string, unknown>[]) ?? undefined}
                  fields={[{ key: 'solution', label: 'Solution' }, { key: 'priority', label: 'Priority' }]}
                />
              </div>
            </ReportSection>

            {/* Email Preview */}
            <ReportSection title="Email Preview" icon={Mail} accent="bg-info-500/10 text-info-600" defaultOpen>
              {agentOutputs['email_writer_agent']?.['cold_email'] && (
                <div className="rounded-lg border border-gold-500/8 bg-card-900/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-ink-500">Subject</span>
                    <span className="text-sm font-medium text-ink-500">
                      {String((agentOutputs['email_writer_agent']['cold_email'] as Record<string, unknown>)['subject_line'] ?? '')}
                    </span>
                  </div>
                  <p className="text-sm text-ink-500 whitespace-pre-wrap leading-relaxed">
                    {String((agentOutputs['email_writer_agent']['cold_email'] as Record<string, unknown>)['body'] ?? '')}
                  </p>
                  <p className="text-sm text-brand-400 font-medium">
                    {String((agentOutputs['email_writer_agent']['cold_email'] as Record<string, unknown>)['cta'] ?? '')}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-ink-500">Subject Line Options</span>
                <BulletList items={(agentOutputs['email_writer_agent']?.['subject_lines'] as string[]) ?? undefined} />
              </div>
            </ReportSection>

            {/* Follow-up Sequence */}
            <ReportSection title="Follow-up Sequence" icon={Send}>
              <ObjectList
                items={(agentOutputs['follow_up_agent']?.['sequence'] as Record<string, unknown>[]) ?? undefined}
                fields={[
                  { key: 'step', label: 'Step' },
                  { key: 'subject', label: 'Subject' },
                  { key: 'timing', label: 'Timing' },
                  { key: 'delay_days', label: 'Delay (days)' },
                ]}
              />
            </ReportSection>

            {/* Meeting Preparation */}
            <ReportSection title="Meeting Preparation" icon={CalendarCheck} accent="bg-success-500/10 text-success-400">
              <p className="text-sm text-ink-500 leading-relaxed">
                {String(agentOutputs['meeting_preparation_agent']?.['meeting_brief'] ?? 'No meeting brief generated.')}
              </p>
              <div>
                <span className="text-xs font-medium text-ink-500">Discovery Questions</span>
                <BulletList items={(agentOutputs['meeting_preparation_agent']?.['discovery_questions'] as string[]) ?? undefined} />
              </div>
              <div>
                <span className="text-xs font-medium text-ink-500">Recommended Pitch</span>
                <p className="text-sm text-ink-500">{String(agentOutputs['meeting_preparation_agent']?.['recommended_pitch'] ?? 'N/A')}</p>
              </div>
            </ReportSection>

            {/* Next Best Action */}
            <ReportSection title="Next Best Action" icon={GitBranch} accent="bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400" defaultOpen>
              {summary && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 p-4">
                    <span className="text-[10px] uppercase tracking-wide text-brand-400/70">Recommended Action</span>
                    <p className="text-lg font-semibold text-brand-400 capitalize mt-1">
                      {String(summary['recommended_action'] ?? 'email')}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">{String(summary['summary'] ?? '')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreBar label="Lead Score" value={Number(summary['lead_score'] ?? 0)} />
                    <div>
                      <span className="text-xs text-ink-500">Lead Value</span>
                      <div className="mt-1">
                        <Badge tone={String(summary['lead_value']) === 'high' ? 'success' : String(summary['lead_value']) === 'medium' ? 'warning' : 'neutral'}>
                          {String(summary['lead_value'] ?? 'medium')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ReportSection>

            {/* Sources Used */}
            <ReportSection title="Sources Used" icon={Database}>
              <div className="space-y-1.5">
                {PIPELINE_STAGES.map((stage) => {
                  const output = agentOutputs[stage.name];
                  if (!output) return null;
                  return (
                    <div key={stage.name} className="flex items-center justify-between text-xs">
                      <span className="text-ink-500">{stage.label}</span>
                      <Badge tone="success" dot>Completed</Badge>
                    </div>
                  );
                })}
              </div>
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}
