import { ListOrdered } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ExecutionQueueItem } from '@/types/linkedin-execution';

type Props = {
  queue: ExecutionQueueItem[];
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

const statusTones: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'brand'> = {
  completed: 'success',
  running: 'brand',
  queued: 'neutral',
  paused: 'warning',
  failed: 'error',
  skipped: 'neutral',
  retry: 'warning',
};

export function ExecutionQueueTable({ queue }: Props) {
  if (!queue || queue.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No execution queue available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-brand-400" />
          <CardTitle>Execution Queue</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-500/12">
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Seq</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Action</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Scheduled</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Executed</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Status</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-ink-500">Retries</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, i) => (
                <tr key={item.id ?? i} className="border-b border-gold-500/8 hover:bg-card-900 transition-colors">
                  <td className="py-2 px-2 text-ink-500">{item.sequence}</td>
                  <td className="py-2 px-2 text-ink-500">{actionLabels[item.action_type] ?? item.action_type}</td>
                  <td className="py-2 px-2 text-ink-500 text-xs">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                  <td className="py-2 px-2 text-ink-500 text-xs">{item.executed_at ? new Date(item.executed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                  <td className="py-2 px-2"><Badge tone={statusTones[item.status] ?? 'neutral'} dot>{item.status}</Badge></td>
                  <td className="py-2 px-2 text-right text-ink-500">{item.retry_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
