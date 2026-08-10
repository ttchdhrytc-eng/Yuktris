import { useState } from 'react';
import { Brain, Zap, Target, Clock, Radio, MessageSquare, Shield, Coffee, Lightbulb } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
  useOutreachDashboard, useOutreachProspects, useCTALibrary,
  useIcebreakerLibrary, useTrustSignalLibrary, useOutreachReasoning,
  useGenerateOutreachIntelligence,
} from '@/hooks/useOutreachIntelligence';
import {
  OutreachDashboardSection, DecisionsSection, PersonalizationSection,
  TimingSection, ChannelSection, MessageStrategySection,
  CTALibrarySection, IcebreakerLibrarySection, TrustSignalLibrarySection,
  ReasoningSection, OutreachIntelligenceEmpty,
} from '@/components/outreach-intelligence';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Brain },
  { id: 'decisions', label: 'Outreach Decisions', icon: Zap },
  { id: 'personalization', label: 'Personalization', icon: Lightbulb },
  { id: 'timing', label: 'Timing', icon: Clock },
  { id: 'channels', label: 'Channel Strategies', icon: Radio },
  { id: 'messages', label: 'Message Strategy', icon: MessageSquare },
  { id: 'cta', label: 'CTA Library', icon: Target },
  { id: 'icebreakers', label: 'Icebreakers', icon: Coffee },
  { id: 'trust', label: 'Trust Signals', icon: Shield },
  { id: 'reasoning', label: 'AI Reasoning', icon: Brain },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function OutreachIntelligencePage() {
  const { data: dashboard, isLoading } = useOutreachDashboard();
  const { data: prospects } = useOutreachProspects();
  const { data: ctaEntries } = useCTALibrary();
  const { data: icebreakerEntries } = useIcebreakerLibrary();
  const { data: trustSignalEntries } = useTrustSignalLibrary();
  const { data: reasoning } = useOutreachReasoning();
  const generate = useGenerateOutreachIntelligence();

  const [tab, setTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Outreach Intelligence" description="AI-powered outreach decision engine for every prospect." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || dashboard.totalProspects === 0) {
    return (
      <div>
        <PageHeader title="Outreach Intelligence" description="AI-powered outreach decision engine for every prospect." />
        <Card className="p-6">
          <OutreachIntelligenceEmpty onGenerate={() => generate.mutate()} isGenerating={generate.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Outreach Intelligence"
        description="AI-powered outreach decision engine for every prospect."
        actions={
          <button onClick={() => generate.mutate()} disabled={generate.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />
            {generate.isPending ? 'Generating...' : 'Generate'}
          </button>
        }
      />

      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Brain className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalProspects}</span> prospects analyzed
            {' · '}<span className="font-semibold text-ink-500">{dashboard.contactImmediately}</span> contact now
            {' · '}Avg score: <span className="font-semibold text-ink-500">{dashboard.avgOutreachScore}</span>
            {' · '}Avg reply: <span className="font-semibold text-ink-500">{Math.round(dashboard.avgReplyProbability * 100)}%</span>
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'dashboard' && <OutreachDashboardSection dashboard={dashboard} onGenerate={() => generate.mutate()} isGenerating={generate.isPending} />}
          {tab === 'decisions' && <DecisionsSection prospects={prospects ?? []} />}
          {tab === 'personalization' && <PersonalizationSection prospects={prospects ?? []} />}
          {tab === 'timing' && <TimingSection prospects={prospects ?? []} />}
          {tab === 'channels' && <ChannelSection prospects={prospects ?? []} />}
          {tab === 'messages' && <MessageStrategySection prospects={prospects ?? []} />}
          {tab === 'cta' && <CTALibrarySection entries={ctaEntries ?? []} />}
          {tab === 'icebreakers' && <IcebreakerLibrarySection entries={icebreakerEntries ?? []} />}
          {tab === 'trust' && <TrustSignalLibrarySection entries={trustSignalEntries ?? []} />}
          {tab === 'reasoning' && <ReasoningSection reasoning={reasoning ?? []} />}
        </div>
      </Card>
    </div>
  );
}
