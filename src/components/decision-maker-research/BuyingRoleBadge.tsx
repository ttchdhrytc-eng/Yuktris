import { Badge } from '@/components/ui/Badge';
import type { BuyingRole } from '@/types/decision-maker-research';

type Props = {
  role: BuyingRole;
};

const roleConfig: Record<BuyingRole, { label: string; tone: 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  economic_buyer: { label: 'Economic Buyer', tone: 'success' },
  technical_buyer: { label: 'Technical Buyer', tone: 'brand' },
  champion: { label: 'Champion', tone: 'warning' },
  influencer: { label: 'Influencer', tone: 'neutral' },
  evaluator: { label: 'Evaluator', tone: 'brand' },
  blocker: { label: 'Blocker', tone: 'error' },
  procurement: { label: 'Procurement', tone: 'neutral' },
  end_user: { label: 'End User', tone: 'neutral' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

export function BuyingRoleBadge({ role }: Props) {
  const config = roleConfig[role] ?? roleConfig.unknown;
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}
