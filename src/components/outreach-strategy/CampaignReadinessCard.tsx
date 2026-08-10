import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { OutreachCampaign } from '@/types/outreach-strategy';

type Props = {
  campaign: OutreachCampaign;
};

export function CampaignReadinessCard({ campaign }: Props) {
  const isReady = campaign.campaign_status === 'completed';
  const score = campaign.campaign_score;
  const success = campaign.success_probability;

  const readinessLevel = score >= 85 ? 'Highly Ready' : score >= 70 ? 'Ready' : score >= 50 ? 'Partially Ready' : 'Not Ready';
  const readinessTone = score >= 85 ? 'text-success-400' : score >= 70 ? 'text-brand-400' : score >= 50 ? 'text-warning-500' : 'text-error-500';

  const Icon = isReady ? CheckCircle2 : score >= 50 ? Clock : AlertCircle;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', readinessTone)} />
          <CardTitle>Campaign Readiness</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="5" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 - (score / 100) * 2 * Math.PI * 40} strokeLinecap="round" className={cn('transition-all duration-700', readinessTone)} />
            </svg>
            <span className="relative text-lg font-bold text-ink-500">{score}</span>
          </div>
          <div>
            <p className={cn('text-sm font-medium', readinessTone)}>{readinessLevel}</p>
            <p className="text-xs text-ink-500 mt-0.5">Campaign score</p>
            <p className="text-xs text-ink-500 mt-2">{success}% success probability</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
