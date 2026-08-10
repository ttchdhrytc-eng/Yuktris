import { Database, TrendingUp, DollarSign, User, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CRMUpdate } from '@/types/meeting-agent';

type Props = { crmUpdate: CRMUpdate | null };

export function CRMCard({ crmUpdate }: Props) {
  if (!crmUpdate) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No CRM synchronization data available.</p>
        </CardContent>
      </Card>
    );
  }

  const stageTone = crmUpdate.opportunity_stage === 'closed_won' ? 'success' : crmUpdate.opportunity_stage === 'closed_lost' ? 'error' : crmUpdate.opportunity_stage === 'proposal' || crmUpdate.opportunity_stage === 'negotiation' ? 'brand' : 'neutral';

  const forecastTone = crmUpdate.forecast === 'closed' ? 'success' : crmUpdate.forecast === 'commit' ? 'brand' : crmUpdate.forecast === 'best_case' ? 'warning' : 'neutral';

  const items = [
    { icon: Database, label: 'Lead Status', value: crmUpdate.lead_status.replace(/_/g, ' ') },
    { icon: TrendingUp, label: 'Opportunity Stage', value: crmUpdate.opportunity_stage.replace(/_/g, ' '), badge: true, tone: stageTone },
    { icon: DollarSign, label: 'Deal Value', value: `$${crmUpdate.deal_value.toLocaleString()}` },
    { icon: TrendingUp, label: 'Forecast', value: crmUpdate.forecast.replace(/_/g, ' '), badge: true, tone: forecastTone },
    { icon: User, label: 'Owner', value: crmUpdate.owner },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-brand-400" />
          <CardTitle>CRM Synchronization</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-1.5 mb-1 text-ink-500">
                <item.icon className="h-3 w-3" />
                <span className="text-xs">{item.label}</span>
              </div>
              {item.badge ? (
                <Badge tone={item.tone as 'success' | 'error' | 'brand' | 'warning' | 'neutral'} dot>{item.value}</Badge>
              ) : (
                <p className="text-sm text-ink-500 capitalize">{item.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowRight className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs text-brand-400">Next Action</span>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">{crmUpdate.next_action}</p>
          {crmUpdate.next_action_date && (
            <div className="flex items-center gap-1.5 mt-2">
              <Calendar className="h-3 w-3 text-ink-500" />
              <span className="text-xs text-ink-500">{new Date(crmUpdate.next_action_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
