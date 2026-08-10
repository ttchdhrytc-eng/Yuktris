import { Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ChannelStrategy, Priority } from '@/types/outreach-strategy';

type Props = {
  channels: ChannelStrategy[];
};

const priorityTones: Record<Priority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

const channelLabels: Record<string, string> = {
  linkedin_connection: 'LinkedIn Connection',
  linkedin_message: 'LinkedIn Message',
  linkedin_followup: 'LinkedIn Follow-up',
  email: 'Email',
  voice_note: 'Voice Note',
  video_message: 'Video Message',
  referral: 'Referral',
  manual_task: 'Manual Task',
};

export function ChannelStrategyCard({ channels }: Props) {
  if (!channels || channels.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No channel strategy defined.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-brand-400" />
          <CardTitle>Channel Strategy</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {channels.map((ch, i) => (
            <div key={ch.id ?? i} className="flex items-center justify-between rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
              <span className="text-sm text-ink-500">{channelLabels[ch.channel] ?? ch.channel}</span>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs font-semibold', ch.confidence >= 85 ? 'text-success-400' : ch.confidence >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                  {ch.confidence}%
                </span>
                <Badge tone={priorityTones[ch.priority]} dot>{ch.priority}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
