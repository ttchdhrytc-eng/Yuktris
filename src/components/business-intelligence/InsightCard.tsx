import { TrendingUp, TrendingDown, Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type InsightType = 'strengths' | 'weaknesses' | 'opportunities' | 'risks';

type Props = {
  type: InsightType;
  items: string[];
};

const config: Record<InsightType, { icon: React.ComponentType<{ className?: string }>; title: string; tone: string; iconTone: string }> = {
  strengths: { icon: TrendingUp, title: 'Strengths', tone: 'border-success-500/20', iconTone: 'bg-success-500/10 text-success-400' },
  weaknesses: { icon: TrendingDown, title: 'Weaknesses', tone: 'border-error-500/20', iconTone: 'bg-error-500/10 text-error-400' },
  opportunities: { icon: Lightbulb, title: 'Opportunities', tone: 'border-brand-500/20', iconTone: 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' },
  risks: { icon: AlertTriangle, title: 'Risks', tone: 'border-warning-500/20', iconTone: 'bg-warning-500/10 text-warning-500' },
};

export function InsightCard({ type, items }: Props) {
  const { icon: Icon, title, tone, iconTone } = config[type];

  return (
    <div className={cn('rounded-xl border bg-maroon-900 p-5', tone)}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconTone)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-ink-500">{title}</h3>
        <span className="text-xs text-ink-500 ml-auto">{items.length}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', iconTone.split(' ')[1].replace('text-', 'bg-'))} />
            <span className="text-xs text-ink-500 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
