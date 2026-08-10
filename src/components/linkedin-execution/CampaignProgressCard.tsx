import { CheckCircle2, Clock, XCircle, SkipForward, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ExecutionQueueItem } from '@/types/linkedin-execution';

type Props = {
  queue: ExecutionQueueItem[];
};

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; label: string }> = {
  completed: { icon: CheckCircle2, tone: 'success', label: 'Completed' },
  running: { icon: Clock, tone: 'brand', label: 'Running' },
  queued: { icon: Clock, tone: 'neutral', label: 'Queued' },
  paused: { icon: Clock, tone: 'warning', label: 'Paused' },
  failed: { icon: XCircle, tone: 'error', label: 'Failed' },
  skipped: { icon: SkipForward, tone: 'neutral', label: 'Skipped' },
  retry: { icon: AlertCircle, tone: 'warning', label: 'Retry' },
};

const actionLabels: Record<string, string> = {
  connection_request: 'Connection Request',
  connection_accepted: 'Connection Accepted',
  message_sent: 'Message Sent',
  followup_sent: 'Follow-up Sent',
  profile_visit: 'Profile Visit',
  post_engagement: 'Post Engagement',
  reply_received: 'Reply Received',
  conversation_started: 'Conversation Started',
  meeting_ready: 'Meeting Ready',
};

export function CampaignProgressCard({ queue }: Props) {
  if (!queue || queue.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No execution queue available.</p>
        </CardContent>
      </Card>
    );
  }

  const completed = queue.filter((q) => q.status === 'completed').length;
  const pending = queue.filter((q) => q.status === 'queued').length;
  const skipped = queue.filter((q) => q.status === 'skipped').length;
  const failed = queue.filter((q) => q.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-brand-400" />
          <CardTitle>Campaign Progress</CardTitle>
          <Badge tone="brand">{completed}/{queue.length} done</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatBox label="Completed" value={completed} tone="text-success-400" />
          <StatBox label="Pending" value={pending} tone="text-ink-500" />
          <StatBox label="Skipped" value={skipped} tone="text-ink-500" />
          <StatBox label="Failed" value={failed} tone="text-error-500" />
        </div>
        <div className="space-y-2">
          {queue.map((item, i) => {
            const cfg = statusConfig[item.status] ?? statusConfig.queued;
            const Icon = cfg.icon;
            return (
              <div key={item.id ?? i} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0',
                  item.status === 'completed' ? 'border-success-500 bg-success-500/10 text-success-400' :
                  item.status === 'running' ? 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' :
                  item.status === 'failed' ? 'border-error-500 bg-error-500/10 text-error-500' :
                  item.status === 'retry' ? 'border-warning-500 bg-warning-500/10 text-warning-500' :
                  'border-gold-500/12 bg-maroon-950 text-ink-500',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-ink-500">Step {item.sequence} — {actionLabels[item.action_type] ?? item.action_type}</span>
                  {item.retry_count > 0 && (
                    <span className="text-xs text-warning-500 ml-2">({item.retry_count} retries)</span>
                  )}
                </div>
                <Badge tone={cfg.tone} dot>{cfg.label}</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3 text-center">
      <p className={cn('text-lg font-bold', tone)}>{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}
