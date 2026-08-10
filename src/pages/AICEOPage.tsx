import { useState } from 'react';
import { Brain, Zap, ShieldAlert, Rocket, Target, Lightbulb, Award, TrendingUp, Users, DollarSign, BarChart3, Activity, PieChart, FileText, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import { useCEOCommandCenter, useAnalyzeCompany, useGenerateExecutiveBrief, useGenerateRecommendations, useDetectRisks, useDetectGrowth } from '@/hooks/useAICEO';

const TABS = [
  { id: 'dashboard', label: 'CEO Dashboard', icon: Brain },
  { id: 'brief', label: 'Executive Brief', icon: FileText },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'risks', label: 'Risks', icon: ShieldAlert },
  { id: 'opportunities', label: 'Opportunities', icon: Rocket },
  { id: 'decisions', label: 'AI Decisions', icon: Award },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AICEOPage() {
  const { data: cc, isLoading } = useCEOCommandCenter();
  const analyzeCompany = useAnalyzeCompany();
  const generateBrief = useGenerateExecutiveBrief();
  const generateRecs = useGenerateRecommendations();
  const detectRisks = useDetectRisks();
  const detectGrowth = useDetectGrowth();
  const [tab, setTab] = useState<TabId>('dashboard');

  const runFullAnalysis = () => {
    analyzeCompany.mutate();
    setTimeout(() => detectRisks.mutate(), 500);
    setTimeout(() => detectGrowth.mutate(), 1000);
    setTimeout(() => generateBrief.mutate(), 1500);
    setTimeout(() => generateRecs.mutate(), 2000);
  };

  if (isLoading) {
    return (<div><PageHeader title="AI CEO" description="Autonomous company operations and strategic decision engine." /><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></div>);
  }

  if (!cc || !cc.state) {
    return (<div><PageHeader title="AI CEO" description="Autonomous company operations and strategic decision engine." /><Card className="p-6"><div className="flex flex-col items-center justify-center py-16 space-y-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Brain className="h-8 w-8 text-brand-400" /></div><div className="text-center space-y-2"><h3 className="text-lg font-semibold text-ink-500">AI CEO — Autonomous Company Operations</h3><p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">I am your AI CEO. I analyze every department to generate strategic recommendations and autonomous decisions. Start by analyzing the company.</p></div><button onClick={() => analyzeCompany.mutate()} disabled={analyzeCompany.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-4 w-4" />{analyzeCompany.isPending ? 'Analyzing...' : 'Analyze Company'}</button></div></Card></div>);
  }

  const state = cc.state as Record<string, unknown>;
  const score = state.overall_company_score as number ?? 70;

  return (
    <div>
      <PageHeader title="AI CEO" description="Autonomous company operations and strategic decision engine." actions={<button onClick={runFullAnalysis} disabled={analyzeCompany.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-3.5 w-3.5" />Run Full Analysis</button>} />
      <div className="flex items-start gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4"><Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" /><div className="flex-1"><p className="text-sm text-ink-500">I analyzed every department. The company scores {score.toFixed(0)}/100 overall. {cc.risks.length > 0 ? `I found ${cc.risks.length} major risks requiring attention. ` : ''}{cc.opportunities.length > 0 ? `I identified ${cc.opportunities.length} strategic opportunities. ` : ''}{cc.recommendations.length > 0 ? `I have ${cc.recommendations.length} recommendations ready. ` : ''}</p><p className="text-xs text-ink-500 mt-0.5">MRR: ${cc.totalMRR.toLocaleString()} · ARR: ${cc.totalARR.toLocaleString()} · Customers: {cc.activeCustomers} · Margin: {cc.grossMargin.toFixed(1)}%</p></div></div>
      <Card>
        <div className="border-b border-gold-500/12 px-2"><div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">{TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}><t.icon className="h-3.5 w-3.5" />{t.label}</button>))}</div></div>
        <div className="p-4">
          {tab === 'dashboard' && (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[<Card key="s1" className="p-4"><div className="flex items-center gap-2 mb-1"><Brain className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Overall</span></div><p className="text-2xl font-bold text-ink-500">{score.toFixed(0)}</p></Card>, <Card key="s2" className="p-4"><div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Health</span></div><p className="text-2xl font-bold text-ink-500">{(state.health_score as number ?? 70).toFixed(0)}</p></Card>, <Card key="s3" className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Growth</span></div><p className="text-2xl font-bold text-ink-500">{(state.growth_score as number ?? 65).toFixed(0)}</p></Card>, <Card key="s4" className="p-4"><div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Risk</span></div><p className="text-2xl font-bold text-ink-500">{(state.risk_score as number ?? 35).toFixed(0)}</p></Card>]}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[<Card key="mrr" className="p-4"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">MRR</span></div><p className="text-xl font-bold text-ink-500">${cc.totalMRR.toLocaleString()}</p></Card>, <Card key="arr" className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">ARR</span></div><p className="text-xl font-bold text-ink-500">${cc.totalARR.toLocaleString()}</p></Card>, <Card key="cust" className="p-4"><div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Customers</span></div><p className="text-xl font-bold text-ink-500">{cc.activeCustomers}</p></Card>, <Card key="margin" className="p-4"><div className="flex items-center gap-2 mb-1"><PieChart className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Margin</span></div><p className="text-xl font-bold text-ink-500">{cc.grossMargin.toFixed(1)}%</p></Card>]}</div></div>)}
          {tab === 'brief' && (cc.executiveBriefs.length > 0 ? (<div className="space-y-3">{cc.executiveBriefs.slice(0, 1).map((b) => { const br = b as Record<string, unknown>; return (<Card key={br.id as string} className="p-3 space-y-2"><div className="flex items-center gap-2"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((br.ai_confidence as number) * 100)}%</Badge><span className="text-xs text-ink-500">{br.brief_date as string}</span></div><p className="text-sm text-ink-500">{br.executive_summary as string}</p>{br.wins && <p className="text-xs text-success-400">Wins: {br.wins as string}</p>}{br.losses && <p className="text-xs text-error-400">Losses: {br.losses as string}</p>}{br.risks && <p className="text-xs text-warning-400">Risks: {br.risks as string}</p>}</Card>); })}</div>) : <div className="text-center py-8 text-sm text-ink-500">No executive briefs. Generate a brief.</div>)}
          {tab === 'recommendations' && (cc.recommendations.length > 0 ? (<div className="space-y-2">{cc.recommendations.map((r) => { const rec = r as Record<string, unknown>; return (<Card key={rec.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{rec.recommendation_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{rec.recommendation_description as string}</p></div></div><Badge tone={rec.priority as string === 'critical' ? 'error' : rec.priority as string === 'high' ? 'warning' : 'brand'}>{rec.priority as string}</Badge></div></Card>); })}</div>) : <div className="text-center py-8 text-sm text-ink-500">No recommendations. Generate recommendations.</div>)}
          {tab === 'risks' && (cc.risks.length > 0 ? (<div className="space-y-2">{cc.risks.map((r) => { const risk = r as Record<string, unknown>; return (<Card key={risk.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><ShieldAlert className="h-4 w-4 text-error-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{risk.risk_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{risk.risk_description as string}</p></div></div><Badge tone={risk.risk_level as string === 'critical' ? 'error' : risk.risk_level as string === 'high' ? 'warning' : 'brand'} dot>{risk.risk_level as string}</Badge></div>{risk.mitigation_strategy && <p className="text-xs text-brand-400 mt-1">Mitigation: {risk.mitigation_strategy as string}</p>}</Card>); })}</div>) : <div className="text-center py-8 text-sm text-ink-500">No risks detected. Run risk detection.</div>)}
          {tab === 'opportunities' && (cc.opportunities.length > 0 ? (<div className="space-y-2">{cc.opportunities.map((o) => { const opp = o as Record<string, unknown>; return (<Card key={opp.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><Rocket className="h-4 w-4 text-success-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{opp.opportunity_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{opp.opportunity_description as string}</p></div></div><Badge tone="success">{opp.opportunity_type as string}</Badge></div><p className="text-xs text-success-400 mt-1">Value: ${(opp.estimated_value as number).toLocaleString()}</p></Card>); })}</div>) : <div className="text-center py-8 text-sm text-ink-500">No opportunities detected. Run growth detection.</div>)}
          {tab === 'decisions' && (cc.decisions.length > 0 ? (<div className="space-y-2">{cc.decisions.map((d) => { const dec = d as Record<string, unknown>; return (<Card key={dec.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><Award className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{dec.decision_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{dec.decision_description as string}</p></div></div><Badge tone={dec.decision_status as string === 'completed' ? 'success' : dec.decision_status as string === 'rejected' ? 'error' : 'brand'} dot>{dec.decision_status as string}</Badge></div></Card>); })}</div>) : <div className="text-center py-8 text-sm text-ink-500">No AI decisions yet.</div>)}
        </div>
      </Card>
    </div>
  );
}
