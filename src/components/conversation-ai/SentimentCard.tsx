import { Smile, Frown, Meh } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Sentiment } from '@/types/conversation-ai';

type Props = {
  sentiment: Sentiment | null;
};

const sentimentConfig: Record<Sentiment, { label: string; tone: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  very_positive: { label: 'Very Positive', tone: 'text-success-400', icon: Smile, color: 'bg-success-500' },
  positive: { label: 'Positive', tone: 'text-success-400', icon: Smile, color: 'bg-success-500' },
  neutral: { label: 'Neutral', tone: 'text-ink-500', icon: Meh, color: 'bg-gray-500' },
  negative: { label: 'Negative', tone: 'text-error-500', icon: Frown, color: 'bg-error-500' },
  very_negative: { label: 'Very Negative', tone: 'text-error-500', icon: Frown, color: 'bg-error-500' },
};

export function SentimentCard({ sentiment }: Props) {
  if (!sentiment) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No sentiment data available.</p>
        </CardContent>
      </Card>
    );
  }

  const cfg = sentimentConfig[sentiment];
  const Icon = cfg.icon;
  const scoreMap: Record<Sentiment, number> = { very_negative: 10, negative: 30, neutral: 50, positive: 75, very_positive: 95 };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', cfg.tone)} />
          <CardTitle>Sentiment</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="5" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 - (scoreMap[sentiment] / 100) * 2 * Math.PI * 40} strokeLinecap="round" className={cn('transition-all duration-700', cfg.tone)} />
            </svg>
            <span className={cn('relative text-sm font-bold', cfg.tone)}>{scoreMap[sentiment]}%</span>
          </div>
          <div>
            <p className={cn('text-sm font-medium', cfg.tone)}>{cfg.label}</p>
            <p className="text-xs text-ink-500 mt-0.5">Emotional tone analysis</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
