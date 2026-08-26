import {
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function BillingPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Subscription and payment availability." />

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card-900 text-ink-500">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink-100">Billing is not available yet</p>
                <Badge tone="neutral">Coming soon</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                Yuktris is currently available through manual provisioning. Plan upgrades, checkout,
                payment methods, and automatic charges are disabled.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-success-500/20 bg-success-500/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success-400" />
            <div>
              <p className="text-sm font-medium text-ink-100">No payment will be taken</p>
              <p className="mt-1 text-xs text-ink-400">
                No checkout is active and no payment method can be added from this application.
                Usage limits shown elsewhere are not purchasable entitlements until billing launches.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
