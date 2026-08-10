import {
  CreditCard,
  Check,
  Zap,
  Building,
  Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    icon: Building,
    features: ['100 prospects', '1 workspace', '2 AI agents', 'Basic analytics', 'Community support'],
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$99',
    period: '/mo',
    icon: Zap,
    features: ['5,000 prospects', '3 workspaces', 'All 10 AI agents', 'Advanced analytics', 'Email support', 'API access'],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    icon: Rocket,
    features: ['Unlimited prospects', 'Unlimited workspaces', 'All AI agents', 'Custom analytics', 'Priority support', 'SSO & SAML', 'Dedicated CSM'],
  },
];

export function BillingPage() {
  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription and payment details." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              'relative flex flex-col',
              plan.highlight && 'border-brand-500/40 ring-1 ring-brand-500/20'
            )}
          >
            {plan.highlight && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <Badge tone="brand">Most Popular</Badge>
              </div>
            )}
            <CardContent className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  plan.highlight ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' : 'bg-card-900 text-ink-500'
                )}>
                  <plan.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{plan.name}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-xl font-bold text-ink-500">{plan.price}</span>
                    <span className="text-xs text-ink-500">{plan.period}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success-400 shrink-0" />
                    <span className="text-xs text-ink-500">{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <div className="px-5 pb-5">
              {plan.current ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  variant={plan.highlight ? 'primary' : 'outline'}
                  className="w-full"
                  onClick={() => toast.info('Billing integration requires Paddle setup. Configure in Settings > Integrations.')}
                >
                  {plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card-900 text-ink-500">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink-500">Payment Method</p>
            <p className="text-xs text-ink-500">No payment method on file</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info('Add payment method via billing integration.')}>
            Add Card
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
