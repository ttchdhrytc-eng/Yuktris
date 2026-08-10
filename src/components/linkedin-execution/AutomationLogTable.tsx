import { ScrollText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LinkedInAction } from '@/types/linkedin-execution';

type Props = {
  actions: LinkedInAction[];
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

const resultTones: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  success: 'success',
  failed: 'error',
  pending: 'neutral',
  rate_limited: 'warning',
  daily_limit_reached: 'warning',
  skipped: 'neutral',
  blocked: 'error',
};

export function AutomationLogTable({ actions }: Props) {
  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No automation logs available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-brand-400" />
          <CardTitle>Automation Logs</CardTitle>
          <Badge tone="brand">{actions.length} entries</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-500/12">
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Timestamp</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Action</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Result</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-ink-500">Status</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-ink-500">Duration</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-ink-500">Retries</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action, i) => (
                <tr key={action.id ?? i} className="border-b border-gold-500/8 hover:bg-card-900 transition-colors">
                  <td className="py-2 px-2 text-ink-500 text-xs">
                    {new Date(action.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-2 text-ink-500">{actionLabels[action.action_type] ?? action.action_type}</td>
                  <td className="py-2 px-2 text-ink-500 text-xs">{action.result ?? '—'}</td>
                  <td className="py-2 px-2">
                    <Badge tone={resultTones[action.result ?? 'pending'] ?? 'neutral'} dot>
                      {action.result === 'success' ? 'Success' : action.result === 'failed' ? 'Failed' : action.result ?? 'Pending'}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-right text-ink-500 text-xs">{action.duration ? `${action.duration}ms` : '—'}</td>
                  <td className="py-2 px-2 text-right text-ink-500">{action.error_message ? '1' : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {actions.some((a) => a.error_message) && (
          <div className="mt-3 space-y-1">
            {actions.filter((a) => a.error_message).slice(0, 3).map((a, i) => (
              <div key={i} className="rounded-lg border border-error-500/20 bg-error-500/5 px-3 py-1.5">
                <span className="text-xs text-error-500">{a.error_message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
