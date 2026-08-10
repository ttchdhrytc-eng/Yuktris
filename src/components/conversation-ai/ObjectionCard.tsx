import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ConversationObjection, ObjectionType, ObjectionSeverity } from '@/types/conversation-ai';

type Props = {
  objections: ConversationObjection[];
};

const objectionLabels: Record<ObjectionType, string> = {
  price: 'Price',
  timing: 'Timing',
  competition: 'Competition',
  authority: 'Authority',
  need: 'Need',
  internal_process: 'Internal Process',
  trust: 'Trust',
  complexity: 'Complexity',
};

const severityTones: Record<ObjectionSeverity, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function ObjectionCard({ objections }: Props) {
  if (!objections || objections.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No objections detected in this conversation.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning-500" />
          <CardTitle>Objection Intelligence</CardTitle>
          <Badge tone="warning">{objections.length} detected</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {objections.map((obj, i) => (
            <div key={obj.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink-500">{objectionLabels[obj.objection_type] ?? obj.objection_type}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={severityTones[obj.severity]} dot>{obj.severity}</Badge>
                  <span className={cn('text-xs font-semibold', obj.confidence >= 80 ? 'text-success-400' : 'text-warning-500')}>
                    {obj.confidence}%
                  </span>
                </div>
              </div>
              {obj.recommended_response && (
                <div className="rounded-lg border border-gold-500/8 bg-maroon-950 px-3 py-2">
                  <span className="text-xs text-ink-500">Recommended Handling: </span>
                  <span className="text-xs text-ink-500">{obj.recommended_response}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
