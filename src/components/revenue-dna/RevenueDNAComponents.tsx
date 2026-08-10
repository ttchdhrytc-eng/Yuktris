import { useState, useEffect } from 'react';
import {
  Sparkles, Building2, Target, Users, Shield, Zap, MessageSquare,
  TrendingUp, Award, AlertTriangle, CheckCircle2, Edit3, Save, X,
  Mail, Linkedin, Lightbulb, Handshake, FileText, Globe,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/utils';
import type {
  FullRevenueDNA, BuyerPersona, CompetitorIntelligence, ValueProposition,
  RevenueDNAProfile,
} from '@/types/revenue-dna';

// ============================================================
// AIGeneratedBadge
// ============================================================
export function AIGeneratedBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI Generated{confidence ? ` · ${Math.round(confidence)}%` : ''}
    </Badge>
  );
}

// ============================================================
// EditableField
// ============================================================
export function EditableField({
  label, value, onSave, multiline, isArray,
}: {
  label: string;
  value: string | string[];
  onSave: (val: string | string[]) => void;
  multiline?: boolean;
  isArray?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | string[]>(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const displayValue = Array.isArray(value) ? value.join(', ') : value;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        {!editing && (
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit3 className="h-3 w-3 text-ink-500 hover:text-ink-500" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {multiline || isArray ? (
            <textarea
              value={Array.isArray(draft) ? draft.join('\n') : draft}
              onChange={(e) => isArray ? setDraft(e.target.value.split('\n').filter(Boolean)) : setDraft(e.target.value)}
              className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none resize-y min-h-[80px]"
              autoFocus
            />
          ) : (
            <Input
              value={Array.isArray(draft) ? draft.join(', ') : draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}><Save className="h-3 w-3" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-3 w-3" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <p className={cn('text-sm text-ink-500', multiline && 'leading-relaxed')}>{displayValue || '—'}</p>
      )}
    </div>
  );
}

// ============================================================
// RevenueDNAOverview
// ============================================================
export function RevenueDNAOverview({ dna }: { dna: FullRevenueDNA }) {
  const p = dna.profile;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-ink-500">Business Identity</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Industry</span><p className="text-sm text-ink-500">{p.business_identity?.industry ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Business Model</span><p className="text-sm text-ink-500">{p.business_identity?.business_model ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Pricing</span><p className="text-sm text-ink-500">{p.business_identity?.pricing_model ?? '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-success-400" />
            <span className="text-sm font-medium text-ink-500">Target Market</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Sales Motion</span><p className="text-sm text-ink-500 capitalize">{p.sales_motion ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Company Size</span><p className="text-sm text-ink-500">{p.company_size ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Geographies</span><p className="text-sm text-ink-500">{p.geographies?.join(', ') ?? '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-warning-500" />
            <span className="text-sm font-medium text-ink-500">Intelligence Score</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Confidence</span><p className="text-sm text-ink-500">{Math.round(p.confidence_score)}%</p></div>
            <div><span className="text-xs text-ink-500">Completion</span><p className="text-sm text-ink-500">{Math.round(p.completion_percentage)}%</p></div>
            <div><span className="text-xs text-ink-500">Market Maturity</span><p className="text-sm text-ink-500 capitalize">{p.market_maturity ?? '—'}</p></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-ink-500">Core Services</span>
            <AIGeneratedBadge confidence={p.confidence_score} />
          </div>
          <div className="flex flex-wrap gap-2">
            {p.core_services?.map((s, i) => <Badge key={i} tone="neutral">{s}</Badge>)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-ink-500">Target Industries</span>
            <AIGeneratedBadge confidence={p.confidence_score} />
          </div>
          <div className="flex flex-wrap gap-2">
            {p.target_industries?.map((s, i) => <Badge key={i} tone="brand">{s}</Badge>)}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Differentiators</span>
          <AIGeneratedBadge confidence={p.confidence_score} />
        </div>
        <div className="space-y-2">
          {p.differentiators?.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <Award className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-500">{d}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-3 block">Pain Points Solved</span>
          <div className="space-y-2">
            {p.pain_points_solved?.map((pp, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{pp}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-3 block">Customer Outcomes</span>
          <div className="space-y-2">
            {p.customer_outcomes?.map((co, i) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-success-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{co}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// BuyerPersonasSection
// ============================================================
export function BuyerPersonasSection({ personas }: { personas: BuyerPersona[] }) {
  if (personas.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No buyer personas generated yet.</div>;
  }
  return (
    <div className="space-y-4">
      {personas.map((persona) => (
        <Card key={persona.id} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                <Users className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{persona.role}</p>
                <p className="text-xs text-ink-500">{persona.buying_authority ?? '—'}</p>
              </div>
            </div>
            <AIGeneratedBadge confidence={persona.confidence_score * 100} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PersonaSection title="Responsibilities" items={persona.responsibilities} icon={Shield} />
            <PersonaSection title="Goals" items={persona.goals} icon={Target} />
            <PersonaSection title="KPIs" items={persona.kpis} icon={TrendingUp} />
            <PersonaSection title="Daily Challenges" items={persona.daily_challenges} icon={AlertTriangle} />
            <PersonaSection title="Common Objections" items={persona.common_objections} icon={MessageSquare} />
            <PersonaSection title="Typical Questions" items={persona.typical_questions} icon={Lightbulb} />
          </div>

          <div className="mt-4 pt-4 border-t border-gold-500/8 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-ink-500">Preferred Communication</span>
                <p className="text-sm text-ink-500">{persona.preferred_communication_style ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs text-ink-500">Recommended Messaging</span>
                <p className="text-sm text-ink-500">{persona.recommended_messaging_style ?? '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                  <span className="text-xs text-ink-500">LinkedIn Behavior</span>
                </div>
                <p className="text-xs text-ink-500">{persona.linkedin_behavior?.activity_level ?? '—'} · {persona.linkedin_behavior?.best_outreach_style ?? '—'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Mail className="h-3.5 w-3.5 text-error-400" />
                  <span className="text-xs text-ink-500">Email Behavior</span>
                </div>
                <p className="text-xs text-ink-500">{persona.email_behavior?.response_patterns ?? '—'} · {persona.email_behavior?.best_send_times ?? '—'}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PersonaSection({ title, items, icon: Icon }: { title: string; items: string[]; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-xs font-medium text-ink-500">{title}</span>
      </div>
      <ul className="space-y-1">
        {items?.map((item, i) => (
          <li key={i} className="text-xs text-ink-500 leading-relaxed flex items-start gap-1.5">
            <span className="text-ink-500">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// CompetitorIntelligenceSection
// ============================================================
export function CompetitorIntelligenceSection({ competitors }: { competitors: CompetitorIntelligence[] }) {
  if (competitors.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No competitor intelligence generated yet.</div>;
  }
  return (
    <div className="space-y-4">
      {competitors.map((comp) => (
        <Card key={comp.id} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-error-500/10">
                <Shield className="h-4 w-4 text-error-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{comp.competitor_name}</p>
                <Badge tone={comp.competitor_type === 'direct' ? 'error' : comp.competitor_type === 'indirect' ? 'warning' : 'neutral'}>
                  {comp.competitor_type}
                </Badge>
              </div>
            </div>
            <AIGeneratedBadge confidence={comp.confidence_score * 100} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PersonaSection title="Strengths" items={comp.strengths} icon={CheckCircle2} />
            <PersonaSection title="Weaknesses" items={comp.weaknesses} icon={AlertTriangle} />
            <PersonaSection title="Key Differentiators" items={comp.key_differentiators} icon={Award} />
            <PersonaSection title="Competitive Opportunities" items={comp.competitive_opportunities} icon={Zap} />
          </div>

          {comp.pricing_positioning && (
            <div className="mt-3 pt-3 border-t border-gold-500/8">
              <span className="text-xs text-ink-500">Pricing Positioning</span>
              <p className="text-sm text-ink-500 mt-0.5">{comp.pricing_positioning}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// ValuePropositionsSection
// ============================================================
export function ValuePropositionsSection({ valueProps }: { valueProps: ValueProposition[] }) {
  if (valueProps.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No value propositions generated yet.</div>;
  }
  return (
    <div className="space-y-4">
      {valueProps.map((vp) => (
        <Card key={vp.id} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge tone={vp.proposition_type === 'primary' ? 'brand' : 'neutral'}>
                {vp.proposition_type.replace(/_/g, ' ')}
              </Badge>
              {vp.target_industry && <Badge tone="success">{vp.target_industry}</Badge>}
              {vp.target_persona && <Badge tone="warning">{vp.target_persona}</Badge>}
            </div>
            <AIGeneratedBadge confidence={vp.confidence_score * 100} />
          </div>

          <p className="text-sm text-ink-500 leading-relaxed mb-4">{vp.content}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vp.email_hooks?.length > 0 && <HookSection title="Email Hooks" items={vp.email_hooks} icon={Mail} />}
            {vp.linkedin_hooks?.length > 0 && <HookSection title="LinkedIn Hooks" items={vp.linkedin_hooks} icon={Linkedin} />}
            {vp.opening_messages?.length > 0 && <HookSection title="Opening Messages" items={vp.opening_messages} icon={MessageSquare} />}
            {vp.conversation_starters?.length > 0 && <HookSection title="Conversation Starters" items={vp.conversation_starters} icon={Lightbulb} />}
            {vp.trust_builders?.length > 0 && <HookSection title="Trust Builders" items={vp.trust_builders} icon={Handshake} />}
            {vp.social_proof_suggestions?.length > 0 && <HookSection title="Social Proof" items={vp.social_proof_suggestions} icon={Award} />}
            {vp.cta_suggestions?.length > 0 && <HookSection title="CTA Suggestions" items={vp.cta_suggestions} icon={Zap} />}
          </div>
        </Card>
      ))}
    </div>
  );
}

function HookSection({ title, items, icon: Icon }: { title: string; items: string[]; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-brand-400" />
        <span className="text-xs font-medium text-ink-500">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-ink-500 leading-relaxed">{item}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// TrustSignalsSection
// ============================================================
export function TrustSignalsSection({ profile }: { profile: RevenueDNAProfile }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Trust Signals</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.trust_signals?.map((ts, i) => <Badge key={i} tone="success">{ts}</Badge>)}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Content Assets</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.content_assets?.map((ca, i) => (
            <Badge key={i} tone="neutral" className="gap-1">
              <FileText className="h-3 w-3" />
              {ca}
            </Badge>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Buying Signals</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="space-y-2">
          {profile.buying_signals?.map((bs, i) => (
            <div key={i} className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-500">{bs}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Disqualifiers</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="space-y-2">
          {profile.disqualifiers?.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-error-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-500">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// BuyingCommitteeSection
// ============================================================
export function BuyingCommitteeSection({ profile }: { profile: RevenueDNAProfile }) {
  const committee = profile.buying_committee ?? [];
  if (committee.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No buying committee generated yet.</div>;
  }
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Buying Committee</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="space-y-2">
          {committee.map((member, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 shrink-0">
                <Users className="h-4 w-4 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-500">{member.role}</p>
                <p className="text-xs text-ink-500">{member.department}</p>
              </div>
              <Badge tone={member.influence === 'high' ? 'error' : member.influence === 'medium' ? 'warning' : 'neutral'}>
                {member.influence} influence
              </Badge>
              <Badge tone="brand">{member.involvement}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Typical Objections</span>
          <AIGeneratedBadge confidence={profile.confidence_score} />
        </div>
        <div className="space-y-2">
          {profile.typical_objections?.map((obj, i) => (
            <div key={i} className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-error-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-500">{obj}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// KnowledgeGraphSection
// ============================================================
export function KnowledgeGraphSection({ workspaceId }: { workspaceId: string }) {
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);

  useEffect(() => {
    knowledgeGraphService.getStatistics(workspaceId).then((s) => {
      setStats({ nodes: s.totalNodes ?? 0, edges: s.totalEdges ?? 0 });
    }).catch(() => setStats({ nodes: 0, edges: 0 }));
  }, [workspaceId]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-medium text-ink-500">Knowledge Graph Statistics</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-card-900/50 p-3 text-center">
            <p className="text-2xl font-bold text-ink-500">{stats?.nodes ?? '—'}</p>
            <p className="text-xs text-ink-500">Nodes</p>
          </div>
          <div className="rounded-lg bg-card-900/50 p-3 text-center">
            <p className="text-2xl font-bold text-ink-500">{stats?.edges ?? '—'}</p>
            <p className="text-xs text-ink-500">Relationships</p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-ink-500 leading-relaxed">
          The Knowledge Graph links your company, products, services, industries, pain points, buyer personas, competitors, technologies, and keywords. All future AI agents query this graph instead of repeating research.
        </p>
      </Card>
    </div>
  );
}

// ============================================================
// RevenueDNAEmpty
// ============================================================
export function RevenueDNAEmpty({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
        <Sparkles className="h-8 w-8 text-brand-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Generate Your Revenue DNA</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
          Your Revenue DNA is a deep intelligence profile of your business. It includes buyer personas, competitor intelligence, value propositions, and everything your AI SDR needs to sell effectively.
        </p>
      </div>
      <Button variant="glow" size="lg" onClick={onGenerate} loading={isGenerating}>
        <Sparkles className="h-4 w-4" />
        Generate Revenue DNA
      </Button>
    </div>
  );
}

import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';

// Need to import knowledgeGraphService for the stats
