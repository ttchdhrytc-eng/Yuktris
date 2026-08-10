import { Users, DollarSign, Cpu, Trophy, AlertTriangle, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { BuyingCommittee } from '@/types/decision-maker-research';

type Props = {
  committee: BuyingCommittee | null;
};

const roles = [
  { key: 'economic_buyer' as const, label: 'Economic Buyer', icon: DollarSign, tone: 'border-success-500/20 bg-success-500/5 text-success-400' },
  { key: 'technical_buyer' as const, label: 'Technical Buyer', icon: Cpu, tone: 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 text-brand-400' },
  { key: 'champion' as const, label: 'Champion', icon: Trophy, tone: 'border-warning-500/20 bg-warning-500/5 text-warning-500' },
  { key: 'influencer' as const, label: 'Influencer', icon: Users, tone: 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 text-brand-400' },
  { key: 'evaluator' as const, label: 'Evaluator', icon: ShieldCheck, tone: 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 text-brand-400' },
  { key: 'blocker' as const, label: 'Blocker', icon: AlertTriangle, tone: 'border-error-500/20 bg-error-500/5 text-error-400' },
  { key: 'procurement' as const, label: 'Procurement', icon: ShoppingCart, tone: 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 text-brand-400' },
];

export function BuyingCommitteeCard({ committee }: Props) {
  if (!committee) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No buying committee data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <CardTitle>Buying Committee</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((role) => {
            const value = committee[role.key];
            return (
              <div key={role.key} className={cn('rounded-lg border p-3', role.tone)}>
                <div className="flex items-center gap-2 mb-2">
                  <role.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{role.label}</span>
                </div>
                {value ? (
                  <p className="text-xs text-ink-500 leading-relaxed">{value}</p>
                ) : (
                  <p className="text-xs text-ink-500 italic">Not identified</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
