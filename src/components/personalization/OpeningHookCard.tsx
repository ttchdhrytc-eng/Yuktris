import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { OpeningHook, HookType } from '@/types/personalization';

type Props = {
  hooks: OpeningHook[];
};

const hookTypeLabels: Record<HookType, string> = {
  recent_company_event: 'Recent Company Event',
  technology_mention: 'Technology Mention',
  hiring_mention: 'Hiring Mention',
  expansion_mention: 'Expansion Mention',
  mutual_interest: 'Mutual Interest',
  industry_trend: 'Industry Trend',
};

export function OpeningHookCard({ hooks }: Props) {
  if (!hooks || hooks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No opening hooks available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-brand-400" />
          <CardTitle>Opening Hooks</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {hooks.map((h, i) => (
            <div key={h.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-brand-400">{hookTypeLabels[h.hook_type] ?? h.hook_type}</span>
                <span className={cn('text-xs font-semibold', h.confidence >= 85 ? 'text-success-400' : h.confidence >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                  {h.confidence}% confidence
                </span>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">{h.hook_text ?? 'N/A'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
