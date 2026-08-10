import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { OutreachCampaign } from '@/types/outreach-strategy';

type Props = {
  campaign: OutreachCampaign;
};

const typeLabels: Record<string, string> = {
  multi_touch: 'Multi-Touch',
  single_touch: 'Single-Touch',
  sequence: 'Sequence',
  drip: 'Drip Campaign',
  ab_test: 'A/B Test',
};

export function CampaignOverviewCard({ campaign }: Props) {
  const items = [
    { label: 'Campaign Name', value: campaign.campaign_name },
    { label: 'Campaign Type', value: typeLabels[campaign.campaign_type] ?? campaign.campaign_type },
    { label: 'Campaign Status', value: campaign.campaign_status, badge: true },
    { label: 'Campaign Score', value: `${campaign.campaign_score}/100` },
    { label: 'Success Probability', value: `${campaign.success_probability}%` },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand-400" />
          <CardTitle>Campaign Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
              <span className="text-xs text-ink-500">{item.label}</span>
              {item.badge ? (
                <Badge tone={campaign.campaign_status === 'completed' ? 'success' : 'neutral'} dot>
                  {item.value}
                </Badge>
              ) : (
                <span className="text-sm text-ink-500">{item.value}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
