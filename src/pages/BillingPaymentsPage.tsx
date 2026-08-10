// ============================================================
// BillingPaymentsPage — Billing & payments dashboard (Paddle)
// ============================================================

import { useState } from 'react';
import {
  Users, CreditCard, Receipt, TrendingUp, AlertCircle,
  DollarSign, Activity, Download, ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  useBillingDashboard, useBillingWebhookEvents,
  useCancelSubscription, usePauseSubscription, useResumeSubscription,
} from '@/hooks/useBilling';
import type { SubscriptionStatus, InvoiceStatus, TransactionStatus } from '@/types/billing';

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function subStatusTone(status: SubscriptionStatus): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'active': case 'trialing': return 'success';
    case 'past_due': return 'warning';
    case 'canceled': case 'deleted': return 'error';
    case 'paused': return 'brand';
    default: return 'default';
  }
}

function invStatusTone(status: InvoiceStatus): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'paid': return 'success';
    case 'open': case 'draft': return 'warning';
    case 'void': case 'uncollectible': return 'error';
    default: return 'default';
  }
}

function txStatusTone(status: TransactionStatus): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warning';
    case 'failed': case 'canceled': return 'error';
    case 'refunded': return 'default';
    default: return 'default';
  }
}

export function BillingPaymentsPage() {
  const dashboard = useBillingDashboard();
  const [tab, setTab] = useState<'overview' | 'subscriptions' | 'invoices' | 'transactions' | 'webhooks'>('overview');

  const data = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Billing & Payments"
        description="Manage customers, subscriptions, invoices, and transactions through your billing provider."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success-500" />
            <div>
              <p className="text-2xl font-bold text-ink-50">{data ? formatCents(data.metrics.mrr_cents) : '—'}</p>
              <p className="text-xs text-ink-500">MRR</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-500" />
            <div>
              <p className="text-2xl font-bold text-ink-50">{data ? formatCents(data.metrics.arr_cents) : '—'}</p>
              <p className="text-xs text-ink-500">ARR</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-ink-500" />
            <div>
              <p className="text-2xl font-bold text-ink-50">{data?.metrics.active_subscriptions ?? '—'}</p>
              <p className="text-xs text-ink-500">Active Subs</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-error-500" />
            <div>
              <p className="text-2xl font-bold text-ink-50">{data?.metrics.failed_payments ?? '—'}</p>
              <p className="text-xs text-ink-500">Failed Payments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-gold-500/12">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'webhooks', label: 'Webhook Events' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-brand-500 text-brand-300' : 'border-transparent text-ink-500 hover:text-ink-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {dashboard.isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : !data ? (
        <Card className="p-12 text-center text-sm text-ink-500">No billing data available.</Card>
      ) : tab === 'overview' ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-50 mb-3">Recent Customers</h3>
            {data.customers.length === 0 ? (
              <p className="text-sm text-ink-400">No customers yet.</p>
            ) : (
              <div className="space-y-2">
                {data.customers.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ink-200">{c.name || c.email}</p>
                      <p className="text-xs text-ink-400">{c.email}</p>
                    </div>
                    <Badge tone={c.status === 'active' ? 'success' : 'default'} size="sm">{c.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-50 mb-3">Recent Subscriptions</h3>
            {data.subscriptions.length === 0 ? (
              <p className="text-sm text-ink-400">No subscriptions yet.</p>
            ) : (
              <div className="space-y-2">
                {data.subscriptions.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ink-200">{s.plan_id || s.price_id || 'Subscription'}</p>
                      <p className="text-xs text-ink-400">{s.status}</p>
                    </div>
                    <Badge tone={subStatusTone(s.status)} size="sm">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : tab === 'subscriptions' ? (
        <SubscriptionsTab subscriptions={data.subscriptions} />
      ) : tab === 'invoices' ? (
        <InvoicesTab invoices={data.invoices} />
      ) : tab === 'transactions' ? (
        <TransactionsTab transactions={data.transactions} />
      ) : (
        <WebhooksTab />
      )}
    </div>
  );
}

function SubscriptionsTab({ subscriptions }: { subscriptions: ReturnType<typeof useBillingDashboard>['data'] extends infer T ? T extends null ? never : T extends { subscriptions: infer S } ? S : never : never }) {
  const cancelSub = useCancelSubscription();
  const pauseSub = usePauseSubscription();
  const resumeSub = useResumeSubscription();

  if (subscriptions.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No subscriptions yet.</Card>;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-500/12 text-xs text-ink-500">
              <th className="px-4 py-2 text-left font-medium">Plan</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Period End</th>
              <th className="px-4 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {subscriptions.map((s) => (
              <tr key={s.id} className="hover:bg-card-800">
                <td className="px-4 py-2 text-xs text-ink-200">{s.plan_id || s.price_id || '—'}</td>
                <td className="px-4 py-2"><Badge tone={subStatusTone(s.status)} size="sm">{s.status}</Badge></td>
                <td className="px-4 py-2 text-xs text-ink-400">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {s.status === 'active' && (
                      <>
                        <button onClick={() => pauseSub.mutate(s.id)} className="text-xs text-brand-300 hover:underline">Pause</button>
                        <button onClick={() => cancelSub.mutate({ subscriptionId: s.id })} className="text-xs text-error-500 hover:underline">Cancel</button>
                      </>
                    )}
                    {s.status === 'paused' && (
                      <button onClick={() => resumeSub.mutate(s.id)} className="text-xs text-success-500 hover:underline">Resume</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InvoicesTab({ invoices }: { invoices: ReturnType<typeof useBillingDashboard>['data'] extends infer T ? T extends null ? never : T extends { invoices: infer I } ? I : never : never }) {
  if (invoices.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No invoices yet.</Card>;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-500/12 text-xs text-ink-500">
              <th className="px-4 py-2 text-left font-medium">Number</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-card-800">
                <td className="px-4 py-2 text-xs text-ink-200">{inv.number || inv.provider_invoice_id.slice(0, 8)}</td>
                <td className="px-4 py-2"><Badge tone={invStatusTone(inv.status)} size="sm">{inv.status}</Badge></td>
                <td className="px-4 py-2 text-xs text-ink-200">{formatCents(inv.total_cents)} {inv.currency}</td>
                <td className="px-4 py-2 text-xs text-ink-400">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2">
                  {inv.hosted_invoice_url && (
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TransactionsTab({ transactions }: { transactions: ReturnType<typeof useBillingDashboard>['data'] extends infer T ? T extends null ? never : T extends { transactions: infer T2 } ? T2 : never : never }) {
  if (transactions.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No transactions yet.</Card>;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-500/12 text-xs text-ink-500">
              <th className="px-4 py-2 text-left font-medium">Transaction</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-card-800">
                <td className="px-4 py-2 text-xs text-ink-200">{tx.description || tx.provider_transaction_id.slice(0, 8)}</td>
                <td className="px-4 py-2"><Badge tone={txStatusTone(tx.status)} size="sm">{tx.status}</Badge></td>
                <td className="px-4 py-2 text-xs text-ink-200">{formatCents(tx.amount_cents)} {tx.currency}</td>
                <td className="px-4 py-2 text-xs text-ink-400">{new Date(tx.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function WebhooksTab() {
  const webhooks = useBillingWebhookEvents();
  const list = webhooks.data ?? [];

  if (webhooks.isLoading) return <Card className="p-12 flex justify-center"><Spinner className="h-6 w-6" /></Card>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No webhook events received yet.</Card>;

  return (
    <Card>
      <div className="divide-y divide-border-subtle">
        {list.map((w) => (
          <div key={w.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-3.5 w-3.5 text-ink-400" />
                <span className="text-sm font-medium text-ink-200">{w.event_type}</span>
                {w.processed ? <Badge tone="success" size="sm">Processed</Badge> : <Badge tone="warning" size="sm">Pending</Badge>}
              </div>
              <p className="text-xs text-ink-400">{new Date(w.created_at).toLocaleString()}</p>
              {w.error && <p className="text-xs text-error-500 mt-1">{w.error}</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
