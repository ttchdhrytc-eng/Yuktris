import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type Props = {
  opportunity_score: number;
};

export function OpportunityCard({ opportunity_score }: Props) {
  const tone = opportunity_score >= 80 ? 'text-success-400' : opportunity_score >= 60 ? 'text-warning-500' : 'text-ink-500';
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (opportunity_score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-400" />
          <CardTitle>Opportunity Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={cn('transition-all duration-700', tone)} />
            </svg>
            <span className="relative text-lg font-bold text-ink-500">{opportunity_score}</span>
          </div>
          <div>
            <p className={cn('text-sm font-medium', tone)}>
              {opportunity_score >= 80 ? 'High Opportunity' : opportunity_score >= 60 ? 'Medium Opportunity' : 'Low Opportunity'}
            </p>
            <p className="text-xs text-ink-500 mt-0.5">Based on ICP fit, signals, and stakeholder engagement</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
