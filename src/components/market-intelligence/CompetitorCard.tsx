import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { CompetitorAnalysis } from '@/types/market-intelligence';

type Props = {
  competitor: CompetitorAnalysis;
};

export function CompetitorCard({ competitor }: Props) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-5 transition-colors hover:border-gold-500/25">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-500">{competitor.competitor}</h4>
          {competitor.website && (
            <a
              href={competitor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-0.5"
            >
              {competitor.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {competitor.market_share && (
          <Badge tone="neutral">{competitor.market_share}</Badge>
        )}
      </div>

      {/* Position */}
      {competitor.market_position && (
        <p className="text-xs text-ink-500 mb-3 leading-relaxed">{competitor.market_position}</p>
      )}

      {/* Pricing */}
      {competitor.pricing_model && (
        <div className="rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2 mb-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Pricing</span>
          <p className="text-xs text-ink-500 mt-0.5">{competitor.pricing_model}</p>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-success-400" />
            <span className="text-xs font-medium text-success-400">Strengths</span>
          </div>
          <ul className="space-y-1.5">
            {competitor.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-success-500 shrink-0" />
                <span className="text-xs text-ink-500 leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="h-3.5 w-3.5 text-error-400" />
            <span className="text-xs font-medium text-error-400">Weaknesses</span>
          </div>
          <ul className="space-y-1.5">
            {competitor.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-error-500 shrink-0" />
                <span className="text-xs text-ink-500 leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
