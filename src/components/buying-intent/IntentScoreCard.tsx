import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { IntentLevel } from '@/types/buying-intent';

type Props = {
  intent_score: number;
  intent_level: IntentLevel;
};

const levelTones: Record<IntentLevel, { color: string; bg: string; label: string }> = {
  very_low: { color: 'text-ink-500', bg: 'stroke-gray-500', label: 'Very Low' },
  low: { color: 'text-ink-500', bg: 'stroke-gray-400', label: 'Low' },
  medium: { color: 'text-warning-500', bg: 'stroke-warning-500', label: 'Medium' },
  high: { color: 'text-success-400', bg: 'stroke-success-500', label: 'High' },
  very_high: { color: 'text-success-400', bg: 'stroke-success-500', label: 'Very High' },
};

export function IntentScoreCard({ intent_score, intent_level }: Props) {
  const tone = levelTones[intent_level];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (intent_score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-400" />
          <CardTitle>Intent Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-2">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
              <circle
                cx="60" cy="60" r={radius} fill="none"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={cn('transition-all duration-1000', tone.bg)}
              />
            </svg>
            <div className="text-center">
              <span className="text-3xl font-bold text-ink-500">{intent_score}</span>
              <span className="text-sm text-ink-500">/100</span>
            </div>
          </div>
          <p className={cn('text-sm font-medium mt-3', tone.color)}>{tone.label} Intent</p>
        </div>
      </CardContent>
    </Card>
  );
}
