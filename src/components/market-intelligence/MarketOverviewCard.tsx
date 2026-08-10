import { TrendingUp, Target, Swords, Sparkles, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { OpportunityScore } from './OpportunityScore';
import type { MarketAnalysis } from '@/types/market-intelligence';

type Props = {
  analysis: MarketAnalysis;
};

export function MarketOverviewCard({ analysis }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Market Overview</CardTitle>
          <p className="text-xs text-ink-500 mt-0.5">AI-generated market intelligence summary</p>
        </div>
        <ConfidenceBadge score={analysis.confidence_score} label="confidence" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <OpportunityScore score={analysis.opportunity_score} size="md" />
          <div className="grid flex-1 grid-cols-2 gap-3 w-full">
            <Metric icon={DollarSign} label="Market Size" value={analysis.market_size ?? '—'} />
            <Metric icon={TrendingUp} label="Growth Score" value={`${analysis.growth_score}/100`} />
            <Metric icon={Swords} label="Competition" value={`${analysis.competition_score}/100`} />
            <Metric icon={Target} label="Opportunity" value={`${analysis.opportunity_score}/100`} />
          </div>
        </div>
        {analysis.recommended_strategy && (
          <div className="mt-4 rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-xs font-medium text-brand-400">Recommended Strategy</span>
            </div>
            <p className="text-xs text-ink-500 leading-relaxed">{analysis.recommended_strategy}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center gap-1.5 mb-1 text-ink-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm text-ink-500 font-medium">{value}</p>
    </div>
  );
}
