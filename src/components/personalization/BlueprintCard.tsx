import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type Props = {
  personalization_score: number;
  communication_style: string | null;
  tone: string | null;
  value_proposition: string | null;
  cta_strategy: string | null;
};

export function BlueprintCard({ personalization_score, communication_style, tone, value_proposition, cta_strategy }: Props) {
  const scoreTone = personalization_score >= 85 ? 'text-success-400' : personalization_score >= 70 ? 'text-warning-500' : 'text-ink-500';
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (personalization_score / 100) * circumference;

  const items = [
    { label: 'Communication Style', value: communication_style },
    { label: 'Tone', value: tone },
    { label: 'CTA Strategy', value: cta_strategy },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand-400" />
          <CardTitle>Personalization Blueprint</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={cn('transition-all duration-700', scoreTone)} />
            </svg>
            <span className="relative text-lg font-bold text-ink-500">{personalization_score}</span>
          </div>
          <div>
            <p className={cn('text-sm font-medium', scoreTone)}>
              {personalization_score >= 85 ? 'Highly Personalized' : personalization_score >= 70 ? 'Well Personalized' : 'Basic Personalization'}
            </p>
            <p className="text-xs text-ink-500 mt-0.5">Personalization score</p>
          </div>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
              <span className="text-xs text-ink-500">{item.label}</span>
              <span className="text-sm text-ink-500 capitalize">{item.value ?? 'N/A'}</span>
            </div>
          ))}
        </div>
        {value_proposition && (
          <div className="mt-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <span className="text-xs text-ink-500 block mb-1">Value Proposition</span>
            <p className="text-sm text-ink-500 leading-relaxed">{value_proposition}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
