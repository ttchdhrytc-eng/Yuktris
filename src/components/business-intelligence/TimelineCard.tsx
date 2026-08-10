import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/types/business-intelligence';

type Props = {
  events: TimelineEvent[];
};

export function TimelineCard({ events }: Props) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-5">
      <h3 className="text-sm font-semibold text-ink-500 mb-4">Analysis Timeline</h3>
      <div className="space-y-1">
        {events.map((event, i) => (
          <div key={event.id} className="flex gap-3">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-colors',
                  event.completed
                    ? 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400'
                    : 'border-gold-500/12 bg-card-900 text-ink-500'
                )}
              >
                {event.completed ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
              </div>
              {i < events.length - 1 && (
                <div className={cn('w-0.5 flex-1 min-h-[24px]', event.completed ? 'bg-gradient-to-r from-gold-400 to-gold-300/40' : 'bg-border')} />
              )}
            </div>
            {/* Content */}
            <div className="pb-4 flex-1">
              <p className={cn('text-sm font-medium', event.completed ? 'text-ink-500' : 'text-ink-500')}>
                {event.label}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">{event.description}</p>
              {event.timestamp && (
                <p className="text-[10px] text-ink-500 mt-1">
                  {new Date(event.timestamp).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
