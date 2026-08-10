import { TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/decision-maker-research';

type Props = {
  contact: Contact | null;
};

export function InfluenceCard({ contact }: Props) {
  if (!contact) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No influence data available.</p>
        </CardContent>
      </Card>
    );
  }

  const score = contact.influence_score;
  const tone = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : '#ef4444';
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-400" />
          <CardTitle>Influence Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative flex h-28 w-28 items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={radius} fill="none" stroke="#27272a" strokeWidth="7" />
              <circle cx="65" cy="65" r={radius} fill="none" stroke={tone} strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-ink-500">{score}</span>
              <span className="text-[10px] text-ink-500">/ 100</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className={cn('h-4 w-4', score >= 85 ? 'text-success-400' : score >= 70 ? 'text-warning-500' : 'text-error-400')} />
              <span className="text-sm text-ink-500 font-medium">
                {score >= 85 ? 'Highly Influential' : score >= 70 ? 'Moderately Influential' : 'Low Influence'}
              </span>
            </div>
            <div className="space-y-2">
              <Metric label="Decision Power" value={contact.decision_power} />
              <Metric label="Outreach Readiness" value={contact.outreach_readiness} />
              <Metric label="Activity Score" value={contact.activity_score} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const tone = value >= 85 ? 'bg-success-500' : value >= 70 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-ink-500">{label}</span>
        <span className="text-xs font-semibold text-ink-500">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
