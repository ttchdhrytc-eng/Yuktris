import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { BANTQualification } from '@/types/conversation-ai';

type Props = {
  qualification: BANTQualification | null;
};

const bantConfig = {
  budget: {
    confirmed: { label: 'Confirmed', icon: CheckCircle2, tone: 'text-success-400' },
    likely: { label: 'Likely', icon: CheckCircle2, tone: 'text-brand-400' },
    unlikely: { label: 'Unlikely', icon: XCircle, tone: 'text-error-500' },
    unknown: { label: 'Unknown', icon: HelpCircle, tone: 'text-ink-500' },
    none: { label: 'None', icon: XCircle, tone: 'text-error-500' },
  },
  authority: {
    decision_maker: { label: 'Decision Maker', icon: CheckCircle2, tone: 'text-success-400' },
    influencer: { label: 'Influencer', icon: AlertCircle, tone: 'text-brand-400' },
    gatekeeper: { label: 'Gatekeeper', icon: XCircle, tone: 'text-error-500' },
    unknown: { label: 'Unknown', icon: HelpCircle, tone: 'text-ink-500' },
    none: { label: 'None', icon: XCircle, tone: 'text-error-500' },
  },
  need: {
    critical: { label: 'Critical', icon: CheckCircle2, tone: 'text-success-400' },
    high: { label: 'High', icon: CheckCircle2, tone: 'text-success-400' },
    medium: { label: 'Medium', icon: AlertCircle, tone: 'text-brand-400' },
    low: { label: 'Low', icon: AlertCircle, tone: 'text-warning-500' },
    unknown: { label: 'Unknown', icon: HelpCircle, tone: 'text-ink-500' },
    none: { label: 'None', icon: XCircle, tone: 'text-error-500' },
  },
  timeline: {
    immediate: { label: 'Immediate', icon: CheckCircle2, tone: 'text-success-400' },
    this_quarter: { label: 'This Quarter', icon: CheckCircle2, tone: 'text-brand-400' },
    next_quarter: { label: 'Next Quarter', icon: AlertCircle, tone: 'text-warning-500' },
    later: { label: 'Later', icon: AlertCircle, tone: 'text-ink-500' },
    unknown: { label: 'Unknown', icon: HelpCircle, tone: 'text-ink-500' },
    none: { label: 'None', icon: XCircle, tone: 'text-error-500' },
  },
} as const;

export function QualificationCard({ qualification }: Props) {
  if (!qualification) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No qualification data available.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Budget', value: qualification.budget, config: bantConfig.budget },
    { label: 'Authority', value: qualification.authority, config: bantConfig.authority },
    { label: 'Need', value: qualification.need, config: bantConfig.need },
    { label: 'Timeline', value: qualification.timeline, config: bantConfig.timeline },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-400" />
            <CardTitle>Lead Qualification (BANT)</CardTitle>
          </div>
          <Badge tone={qualification.qualification_score >= 75 ? 'success' : qualification.qualification_score >= 50 ? 'brand' : 'warning'}>
            {qualification.qualification_score}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {items.map((item) => {
            const cfg = (item.config as Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }>)[item.value];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={item.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <span className="text-xs text-ink-500 block mb-1.5">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('h-3.5 w-3.5', cfg.tone)} />
                  <span className={cn('text-sm font-medium', cfg.tone)}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
          <span className="text-xs text-ink-500 block mb-1">Decision Maker Status</span>
          <p className={cn(
            'text-sm font-medium capitalize',
            qualification.decision_maker_status === 'confirmed' ? 'text-success-400' :
            qualification.decision_maker_status === 'likely' ? 'text-brand-400' :
            qualification.decision_maker_status === 'unconfirmed' ? 'text-warning-500' : 'text-error-500',
          )}>
            {qualification.decision_maker_status.replace(/_/g, ' ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
