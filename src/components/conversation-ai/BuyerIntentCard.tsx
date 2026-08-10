import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { BuyerIntent } from '@/types/conversation-ai';

type Props = {
  buyerIntent: BuyerIntent | null;
};

const intentConfig: Record<BuyerIntent, { label: string; tone: 'success' | 'brand' | 'warning' | 'error' | 'neutral'; score: number; icon: React.ComponentType<{ className?: string }> }> = {
  very_high: { label: 'Very High', tone: 'success', score: 95, icon: TrendingUp },
  high: { label: 'High', tone: 'success', score: 80, icon: TrendingUp },
  medium: { label: 'Medium', tone: 'brand', score: 55, icon: Minus },
  low: { label: 'Low', tone: 'warning', score: 30, icon: TrendingDown },
  none: { label: 'None', tone: 'neutral', score: 0, icon: Minus },
};

export function BuyerIntentCard({ buyerIntent }: Props) {
  if (!buyerIntent) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No buyer intent data available.</p>
        </CardContent>
      </Card>
    );
  }

  const cfg = intentConfig[buyerIntent];
  const Icon = cfg.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-brand-400" />
            <CardTitle>Buyer Intent</CardTitle>
          </div>
          <Badge tone={cfg.tone} dot>{cfg.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-ink-500">Intent Score</span>
            <span className="text-sm font-semibold text-ink-500">{cfg.score}/100</span>
          </div>
          <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', cfg.tone === 'success' ? 'bg-success-500' : cfg.tone === 'brand' ? 'bg-gradient-to-r from-gold-400 to-gold-300' : cfg.tone === 'warning' ? 'bg-warning-500' : 'bg-gray-500')} style={{ width: `${cfg.score}%` }} />
          </div>
        </div>
        <p className="text-xs text-ink-500">Based on conversation signals, engagement level, and response patterns.</p>
      </CardContent>
    </Card>
  );
}
