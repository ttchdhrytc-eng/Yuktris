import { TrendingUp, Users, Building2, Handshake, MapPin, Package, UserCog, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { GrowthSignal, GrowthSignalType, SignalPriority } from '@/types/company-research';

type Props = {
  signals: GrowthSignal[];
};

const signalIcons: Record<GrowthSignalType, React.ComponentType<{ className?: string }>> = {
  funding: DollarSign,
  hiring: Users,
  expansion: MapPin,
  acquisition: Building2,
  partnership: Handshake,
  new_office: Building2,
  new_product: Package,
  leadership_change: UserCog,
};

const signalLabels: Record<GrowthSignalType, string> = {
  funding: 'Funding',
  hiring: 'Hiring',
  expansion: 'Expansion',
  acquisition: 'Acquisition',
  partnership: 'Partnership',
  new_office: 'New Office',
  new_product: 'New Product',
  leadership_change: 'Leadership Change',
};

const priorityTones: Record<SignalPriority, 'success' | 'warning' | 'error' | 'brand'> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warning',
  critical: 'error',
} as Record<SignalPriority, 'success' | 'warning' | 'error' | 'brand'>;

export function GrowthSignalCard({ signals }: Props) {
  if (signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No growth signals detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success-400" />
          <CardTitle>Growth Signals</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signals.map((signal) => {
            const Icon = signalIcons[signal.signal_type] ?? TrendingUp;
            return (
              <div key={signal.id} className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                  signal.priority === 'critical' ? 'bg-error-500/10 text-error-400' :
                  signal.priority === 'high' ? 'bg-warning-500/10 text-warning-500' :
                  signal.priority === 'medium' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' :
                  'bg-maroon-950 text-ink-500'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-ink-500">{signalLabels[signal.signal_type]}</span>
                    <Badge tone={priorityTones[signal.priority]}>{signal.priority}</Badge>
                    <span className="text-[10px] text-ink-500">{signal.confidence}% confidence</span>
                  </div>
                  <p className="text-xs text-ink-500 leading-relaxed">{signal.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
