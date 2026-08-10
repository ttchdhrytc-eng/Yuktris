import { Target, MapPin, Building, Briefcase, MessageSquare, Sparkles } from 'lucide-react';
import type { StrategyResult } from '@/types/market-intelligence';

type Props = {
  strategy: StrategyResult;
};

export function RecommendationCard({ strategy }: Props) {
  return (
    <div className="space-y-4">
      {/* Recommended Industries */}
      <RecSection icon={Target} title="Recommended Industries" items={strategy.recommendedIndustries} tone="brand" />

      {/* Recommended Countries */}
      <RecSection icon={MapPin} title="Recommended Countries" items={strategy.recommendedCountries} tone="success" />

      {/* Company Sizes */}
      <RecSection icon={Building} title="Target Company Sizes" items={strategy.recommendedCompanySizes} tone="warning" />

      {/* Sales Strategy */}
      <StrategyBlock icon={Briefcase} title="Sales Strategy" content={strategy.recommendedSalesStrategy} />

      {/* Positioning */}
      <StrategyBlock icon={Sparkles} title="Positioning" content={strategy.recommendedPositioning} />

      {/* Messaging */}
      <StrategyBlock icon={MessageSquare} title="Messaging" content={strategy.recommendedMessaging} />
    </div>
  );
}

function RecSection({ icon: Icon, title, items, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  tone: 'brand' | 'success' | 'warning';
}) {
  const toneClass = {
    brand: 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 text-brand-400',
    success: 'border-success-500/20 bg-success-500/5 text-success-400',
    warning: 'border-warning-500/20 bg-warning-500/5 text-warning-500',
  }[tone];

  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h4 className="text-sm font-semibold text-ink-500">{title}</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium ${toneClass}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StrategyBlock({ icon: Icon, title, content }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
          <Icon className="h-4 w-4" />
        </div>
        <h4 className="text-sm font-semibold text-ink-500">{title}</h4>
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">{content}</p>
    </div>
  );
}
