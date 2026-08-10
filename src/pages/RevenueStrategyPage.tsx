import { useState } from 'react';
import {
  Brain, Target, Rocket, MessageSquare, Radio, Award, FileCheck, Sparkles, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useRevenueStrategy, useGenerateRevenueStrategy,
  useApproveCampaign, useDuplicateCampaign, useSaveAsTemplate,
} from '@/hooks/useRevenueStrategy';
import {
  StrategyOverview, CampaignStrategiesSection, MessagingLibrarySection,
  ChannelRecommendationsSection, CampaignGoalsSection, ApprovalCenterSection,
  StrategyEmpty,
} from '@/components/revenue-strategy';

const TABS = [
  { id: 'overview', label: 'Strategy Overview', icon: Brain },
  { id: 'campaigns', label: 'Campaign Strategies', icon: Rocket },
  { id: 'messaging', label: 'Messaging Library', icon: MessageSquare },
  { id: 'channels', label: 'Channel Recommendations', icon: Radio },
  { id: 'goals', label: 'Campaign Goals', icon: Target },
  { id: 'approvals', label: 'Approval Center', icon: FileCheck },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function RevenueStrategyPage() {
  const { data: strategy, isLoading } = useRevenueStrategy();
  const generateMutation = useGenerateRevenueStrategy();
  const approveMutation = useApproveCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const saveTemplateMutation = useSaveAsTemplate();

  const [tab, setTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Revenue Strategy" description="AI-designed campaign strategies before any outreach begins." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div>
        <PageHeader title="Revenue Strategy" description="AI-designed campaign strategies before any outreach begins." />
        <Card className="p-6">
          <StrategyEmpty onGenerate={() => generateMutation.mutate()} isGenerating={generateMutation.isPending} />
        </Card>
      </div>
    );
  }

  const handleApprove = (campaignId: string) => approveMutation.mutate({ campaignId });
  const handleDuplicate = (campaignId: string) => duplicateMutation.mutate({ campaignId, strategyId: strategy.strategy.id });
  const handleSaveTemplate = (campaignId: string) => saveTemplateMutation.mutate(campaignId);

  return (
    <div>
      <PageHeader
        title="Revenue Strategy"
        description="AI-designed campaign strategies before any outreach begins."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        }
      />

      {/* Confidence banner */}
      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Sparkles className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            Strategy confidence: <span className="font-semibold text-ink-500">{Math.round(strategy.strategy.confidence_score)}%</span>
            {' · '}{strategy.campaigns.length} campaign strategies
            {' · '}{strategy.messageLibrary.length} messaging assets
            {' · '}{strategy.channels.length} channel recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 rounded-full bg-card-900 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ width: `${strategy.strategy.confidence_score}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-ink-500 hover:text-ink-500',
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'overview' && <StrategyOverview strategy={strategy} />}
          {tab === 'campaigns' && (
            <CampaignStrategiesSection
              campaigns={strategy.campaigns}
              sequences={strategy.sequences}
              onApprove={handleApprove}
              onDuplicate={handleDuplicate}
              onSaveTemplate={handleSaveTemplate}
            />
          )}
          {tab === 'messaging' && <MessagingLibrarySection assets={strategy.messageLibrary} />}
          {tab === 'channels' && <ChannelRecommendationsSection channels={strategy.channels} />}
          {tab === 'goals' && <CampaignGoalsSection goals={strategy.goals} />}
          {tab === 'approvals' && <ApprovalCenterSection approvals={strategy.approvals} />}
        </div>
      </Card>
    </div>
  );
}
