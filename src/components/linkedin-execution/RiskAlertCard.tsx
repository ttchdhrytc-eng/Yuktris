import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ExecutionAIRecommendations } from '@/types/linkedin-execution';

type Props = {
  recommendations: ExecutionAIRecommendations | null;
};

export function RiskAlertCard({ recommendations }: Props) {
  if (!recommendations || recommendations.risk_alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No risk alerts.</p>
        </CardContent>
      </Card>
    );
  }

  const healthTone = recommendations.campaign_health === 'excellent' ? 'success' : recommendations.campaign_health === 'good' ? 'brand' : recommendations.campaign_health === 'warning' ? 'warning' : 'error';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning-500" />
            <CardTitle>Risk Alerts</CardTitle>
          </div>
          <Badge tone={healthTone as 'success' | 'brand' | 'warning' | 'error'} dot>
            {recommendations.campaign_health}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recommendations.risk_alerts.map((alert, i) => (
            <div key={i} className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2',
              recommendations.campaign_health === 'critical' ? 'border-error-500/30 bg-error-500/5' : 'border-warning-500/30 bg-warning-500/5',
            )}>
              <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', recommendations.campaign_health === 'critical' ? 'text-error-500' : 'text-warning-500')} />
              <span className="text-xs text-ink-500">{alert}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
