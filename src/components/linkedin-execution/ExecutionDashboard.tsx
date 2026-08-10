import { Activity, ShieldCheck, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { LinkedInCampaign, SafetyLog } from '@/types/linkedin-execution';

type Props = {
  campaign: LinkedInCampaign;
  safetyLog: SafetyLog | null;
};

export function ExecutionDashboard({ campaign, safetyLog }: Props) {
  const isRunning = campaign.status === 'running';
  const isPaused = campaign.status === 'paused';
  const isCompleted = campaign.status === 'completed';
  const isFailed = campaign.status === 'failed';

  const automationStatus = isRunning ? 'Active' : isPaused ? 'Paused' : isCompleted ? 'Completed' : isFailed ? 'Failed' : 'Idle';
  const automationTone = isRunning ? 'success' : isPaused ? 'warning' : isCompleted ? 'brand' : isFailed ? 'error' : 'neutral';

  const safetyScore = safetyLog ? Math.max(0, 100 - safetyLog.risk_score) : 100;
  const healthScore = campaign.execution_score;
  const queuePosition = campaign.queue?.findIndex((q: { status: string }) => q.status === 'running' || q.status === 'queued') ?? 0;

  const items = [
    { label: 'Campaign Progress', value: `${campaign.progress}%`, bar: true, barValue: campaign.progress, tone: 'bg-gradient-to-r from-gold-400 to-gold-300' },
    { label: 'Current Step', value: campaign.current_step ?? 'N/A' },
    { label: 'Next Action', value: isRunning ? `Queue position ${queuePosition + 1}` : isCompleted ? 'All steps completed' : 'Awaiting start' },
    { label: 'Queue Position', value: `${queuePosition + 1} / 6` },
    { label: 'Execution Health', value: `${healthScore}/100`, bar: true, barValue: healthScore, tone: healthScore >= 80 ? 'bg-success-500' : healthScore >= 60 ? 'bg-warning-500' : 'bg-error-500' },
    { label: 'Safety Score', value: `${safetyScore}/100`, bar: true, barValue: safetyScore, tone: safetyScore >= 80 ? 'bg-success-500' : safetyScore >= 60 ? 'bg-warning-500' : 'bg-error-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-400" />
            <CardTitle>Execution Dashboard</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-ink-500">
              <Cpu className="h-3 w-3" />
              <span>Automation:</span>
            </div>
            <Badge tone={automationTone as 'success' | 'warning' | 'brand' | 'error' | 'neutral'} dot>{automationStatus}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-500">{item.label}</span>
                <span className={cn('text-sm font-medium', item.label.includes('Safety') && safetyScore < 60 ? 'text-error-500' : 'text-ink-500')}>
                  {item.value}
                </span>
              </div>
              {item.bar && (
                <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', item.tone)}
                    style={{ width: `${item.barValue}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {safetyLog && safetyLog.cooldown_until && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-warning-500" />
            <span className="text-xs text-warning-500">Cooldown active until {new Date(safetyLog.cooldown_until).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
