import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, FileText, Users,
  AlertTriangle, Brain, Zap, Receipt, RefreshCw, ShieldAlert,
  Calculator, Target, PieChart, BarChart3, Percent, Wallet,
  Clock, CheckCircle2, XCircle, Activity, Sparkles, Coins,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { FinanceDashboard } from '@/types/finance';

export function FinanceKPICard({ icon: Icon, label, value, trend, confidence, explanation }: { icon: typeof DollarSign; label: string; value: string; trend?: 'up' | 'down' | 'neutral'; confidence?: number; explanation?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">{label}</span></div>{confidence !== undefined && <Badge tone="brand">{Math.round(confidence * 100)}%</Badge>}</div>
      <p className="text-2xl font-bold text-ink-500">{value}</p>
      <div className="flex items-center gap-1 mt-1">{trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success-400" />}{trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-error-400" />}{explanation && <p className="text-xs text-ink-500 truncate">{explanation}</p>}</div>
    </Card>
  );
}

function ScoreBar({ value, max = 100, label, format = 'number' }: { value: number; max?: number; label?: string; format?: 'number' | 'currency' | 'percent' }) {
  const pct = Math.min((value / max) * 100, 100); const color = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';
  const display = format === 'currency' ? `$${value.toLocaleString()}` : format === 'percent' ? `${value.toFixed(1)}%` : value.toLocaleString();
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-500 w-28 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-16 text-right">{display}</span>
    </div>
  );
}

export function ExecutiveOverviewSection({ fd, onSync, isSyncing, onInsights, onAlerts }: { fd: FinanceDashboard; onSync: () => void; isSyncing: boolean; onInsights: () => void; onAlerts: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinanceKPICard icon={DollarSign} label="Total MRR" value={`$${fd.totalMRR.toLocaleString()}`} trend="up" />
        <FinanceKPICard icon={TrendingUp} label="Total ARR" value={`$${fd.totalARR.toLocaleString()}`} trend="up" />
        <FinanceKPICard icon={Wallet} label="Outstanding" value={`$${fd.totalOutstanding.toLocaleString()}`} trend={fd.totalOutstanding > 0 ? 'down' : 'neutral'} />
        <FinanceKPICard icon={AlertTriangle} label="Overdue" value={`$${fd.totalOverdue.toLocaleString()}`} trend={fd.totalOverdue > 0 ? 'down' : 'neutral'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinanceKPICard icon={Users} label="Active Subs" value={`${fd.activeSubscriptions}`} />
        <FinanceKPICard icon={Receipt} label="Overdue Invoices" value={`${fd.overdueInvoices}`} trend={fd.overdueInvoices > 0 ? 'down' : 'neutral'} />
        <FinanceKPICard icon={ShieldAlert} label="Failed Payments" value={`${fd.failedPayments}`} trend={fd.failedPayments > 0 ? 'down' : 'neutral'} />
        <FinanceKPICard icon={Percent} label="Gross Margin" value={`${fd.grossMarginPercent.toFixed(1)}%`} trend="up" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FinanceKPICard icon={Coins} label="Avg LTV" value={`$${fd.avgLTV.toLocaleString()}`} trend="up" />
        <FinanceKPICard icon={Target} label="Avg CAC" value={`$${fd.avgCAC.toLocaleString()}`} />
        <FinanceKPICard icon={Activity} label="Collection Rate" value={`${(fd.collectionRate * 100).toFixed(1)}%`} trend={fd.collectionRate > 0.8 ? 'up' : 'down'} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-3.5 w-3.5" />{isSyncing ? 'Syncing...' : 'Sync Customers'}</button>
        <button onClick={onInsights} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><Sparkles className="h-3.5 w-3.5" />Generate Insights</button>
        <button onClick={onAlerts} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><AlertTriangle className="h-3.5 w-3.5" />Generate Alerts</button>
      </div>
      {fd.financeAlerts.length > 0 && (<div><div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-error-400" /><span className="text-sm font-medium text-ink-500">Active Alerts</span></div><div className="space-y-2">{fd.financeAlerts.slice(0, 5).map((a) => { const al = a as Record<string, unknown>; return (<Card key={al.id as string} className="p-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{al.alert_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{al.alert_description as string}</p></div><Badge tone={(al.alert_severity as string) === 'critical' ? 'error' : (al.alert_severity as string) === 'high' ? 'warning' : 'brand'}>{al.alert_severity as string}</Badge></div>{al.recommended_action && <p className="text-xs text-brand-400 mt-1">{al.recommended_action as string}</p>}</Card>); })}</div></div>)}
    </div>
  );
}

export function BillingAccountsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.billingAccounts.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No billing accounts. Sync customers to begin.</div>;
  return (<div className="space-y-2">{fd.billingAccounts.map((a) => { const ac = a as Record<string, unknown>; return (<Card key={ac.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{ac.account_name as string}</p><p className="text-xs text-ink-500">{ac.billing_type as string} · {ac.currency as string} · Net {ac.payment_terms_days as string}</p></div></div><Badge tone="brand">{ac.billing_type as string}</Badge></div>{ac.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(ac.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function SubscriptionsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.subscriptions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No subscriptions.</div>;
  const statusTone = { active: 'success', trialing: 'brand', past_due: 'warning', canceled: 'neutral', paused: 'neutral', expired: 'neutral', pending: 'brand' } as const;
  return (<div className="space-y-2">{fd.subscriptions.map((s) => { const sub = s as Record<string, unknown>; return (<Card key={sub.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{sub.subscription_name as string}</p><p className="text-xs text-ink-500">MRR: ${(sub.mrr as number).toLocaleString()} · ARR: ${(sub.arr as number).toLocaleString()} · {sub.billing_cycle as string}</p></div><Badge tone={statusTone[sub.status as string] ?? 'neutral'} dot>{sub.status as string}</Badge></div><div className="flex items-center gap-3 text-xs"><span className="text-ink-500">Period: <span className="text-ink-500">{sub.current_period_start as string} → {sub.current_period_end as string | null ?? '—'}</span></span><span className="text-ink-500">Qty: <span className="text-ink-500">{sub.quantity as number}</span></span><span className="text-ink-500">Auto-renew: <span className="text-ink-500">{sub.auto_renew ? 'Yes' : 'No'}</span></span></div>{sub.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(sub.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function PlansSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.pricingPlans.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No pricing plans configured.</div>;
  return (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{fd.pricingPlans.map((p) => { const plan = p as Record<string, unknown>; return (<Card key={plan.id as string} className="p-4 space-y-2"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-ink-500">{plan.plan_name as string}</p><p className="text-xs text-ink-500 capitalize">{plan.plan_tier as string}</p></div>{plan.is_active && <Badge tone="success">Active</Badge>}</div><p className="text-2xl font-bold text-brand-400">${(plan.base_price as number).toLocaleString()}<span className="text-xs text-ink-500">/{plan.billing_cycle as string}</span></p>{plan.description && <p className="text-xs text-ink-500">{plan.description as string}</p>}{plan.features && (<div className="space-y-1">{((plan.features as string[]) ?? []).slice(0, 4).map((f, i) => (<div key={i} className="flex items-center gap-1.5 text-xs text-ink-500"><CheckCircle2 className="h-3 w-3 text-success-400" />{f}</div>))}</div>)}</Card>); })}</div>);
}

export function InvoicesSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.invoices.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No invoices generated.</div>;
  const statusTone = { draft: 'neutral', sent: 'brand', paid: 'success', partial: 'warning', overdue: 'error', void: 'neutral', uncollectible: 'error' } as const;
  return (<div className="space-y-2">{fd.invoices.map((i) => { const inv = i as Record<string, unknown>; return (<Card key={inv.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{inv.invoice_number as string}</p><p className="text-xs text-ink-500">Due: {inv.due_date as string} · Total: ${(inv.total as number).toLocaleString()}</p></div></div><Badge tone={statusTone[inv.status as string] ?? 'neutral'} dot>{inv.status as string}</Badge></div><div className="flex items-center gap-3 text-xs"><span className="text-ink-500">Subtotal: <span className="text-ink-500">${(inv.subtotal as number).toLocaleString()}</span></span><span className="text-ink-500">Paid: <span className="text-success-400">${(inv.amount_paid as number).toLocaleString()}</span></span><span className="text-ink-500">Due: <span className="text-error-400">${(inv.amount_due as number).toLocaleString()}</span></span></div>{inv.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(inv.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function PaymentsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.paymentTransactions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No payment transactions.</div>;
  const statusTone = { pending: 'neutral', succeeded: 'success', failed: 'error', refunded: 'warning', partially_refunded: 'warning', disputed: 'error' } as const;
  return (<div className="space-y-2">{fd.paymentTransactions.map((t) => { const tx = t as Record<string, unknown>; return (<Card key={tx.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{tx.transaction_id as string}</p><p className="text-xs text-ink-500">${(tx.amount as number).toLocaleString()} · {tx.transaction_type as string}</p></div></div><Badge tone={statusTone[tx.status as string] ?? 'neutral'} dot>{tx.status as string}</Badge></div>{tx.failure_reason && <p className="text-xs text-error-400 mt-1">{tx.failure_reason as string}</p>}{tx.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(tx.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function FailedPaymentsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.paymentFailures.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No unresolved payment failures.</div>;
  return (<div className="space-y-2">{fd.paymentFailures.map((f) => { const fail = f as Record<string, unknown>; return (<Card key={fail.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-error-400" /><div><p className="text-sm font-medium text-ink-500">{fail.failure_type as string | null ?? 'Payment Failure'}</p><p className="text-xs text-ink-500">{fail.failure_message as string | null ?? ''}</p></div></div><Badge tone="error">Unresolved</Badge></div>{fail.retry_scheduled_at && <p className="text-xs text-ink-500 mt-1">Retry scheduled: {timeAgo(fail.retry_scheduled_at as string)}</p>}</Card>); })}</div>);
}

export function RevenueRecognitionSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.recognizedRevenue.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No recognized revenue.</div>;
  return (<div className="space-y-2">{fd.recognizedRevenue.map((r) => { const rev = r as Record<string, unknown>; return (<Card key={rev.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success-400" /><div><p className="text-sm font-medium text-ink-500">{rev.recognition_period as string}</p><p className="text-xs text-ink-500">${(rev.recognized_amount as number).toLocaleString()} · {rev.revenue_type as string}</p></div></div><Badge tone="success">Recognized</Badge></div>{rev.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(rev.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function DeferredRevenueSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.deferredRevenue.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No deferred revenue.</div>;
  return (<div className="space-y-2">{fd.deferredRevenue.map((d) => { const dr = d as Record<string, unknown>; return (<Card key={dr.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">Deferred: {dr.deferral_date as string}</p><p className="text-xs text-ink-500">Total: ${(dr.total_deferred_amount as number).toLocaleString()}</p></div><Badge tone="brand">Deferred</Badge></div><ScoreBar value={dr.remaining_amount as number} max={dr.total_deferred_amount as number} label="Remaining" format="currency" /><div className="flex items-center gap-3 text-xs"><span className="text-ink-500">Recognized: <span className="text-success-400">${(dr.recognized_amount as number).toLocaleString()}</span></span><span className="text-ink-500">Remaining: <span className="text-warning-400">${(dr.remaining_amount as number).toLocaleString()}</span></span></div></Card>); })}</div>);
}

export function ReceivablesSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.accountsReceivable.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No accounts receivable.</div>;
  const bucketTone = { current: 'success', '1_30': 'brand', '31_60': 'warning', '61_90': 'warning', '90_plus': 'error' } as const;
  return (<div className="space-y-2">{fd.accountsReceivable.map((a) => { const ar = a as Record<string, unknown>; return (<Card key={ar.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">${(ar.amount_due as number).toLocaleString()} due</p><p className="text-xs text-ink-500">{ar.days_overdue as number} days overdue · {ar.collection_status as string}</p></div></div><Badge tone={bucketTone[ar.aging_bucket as string] ?? 'neutral'} dot>{ar.aging_bucket as string}</Badge></div>{ar.is_overdue && <p className="text-xs text-error-400 mt-1">Overdue — collection action recommended</p>}</Card>); })}</div>);
}

export function CollectionsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.collections.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No collection activities.</div>;
  const resultTone = { pending: 'neutral', contacted: 'brand', promised: 'warning', paid: 'success', disputed: 'error', no_response: 'neutral', escalated: 'error' } as const;
  return (<div className="space-y-2">{fd.collections.map((c) => { const col = c as Record<string, unknown>; return (<Card key={col.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500 capitalize">{col.collection_type as string}</p><p className="text-xs text-ink-500">{timeAgo(col.collection_date as string)}</p></div></div><Badge tone={resultTone[col.collection_result as string] ?? 'neutral'}>{col.collection_result as string}</Badge></div>{col.collection_message && <p className="text-xs text-ink-500 mt-1">{col.collection_message as string}</p>}{col.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(col.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function TaxesSection({ fd }: { fd: FinanceDashboard }) {
  return (<div className="space-y-4"><div><div className="flex items-center gap-2 mb-2"><Calculator className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Tax Rates</span></div>{fd.taxRates.length === 0 ? <p className="text-xs text-ink-500">No tax rates configured.</p> : (<div className="space-y-1">{fd.taxRates.map((t) => { const tr = t as Record<string, unknown>; return (<Card key={tr.id as string} className="p-2 flex items-center justify-between"><div><p className="text-sm text-ink-500">{tr.jurisdiction as string} · {tr.jurisdiction_type as string}</p><p className="text-xs text-ink-500">{tr.tax_name as string | null ?? 'Tax'}</p></div><Badge tone="brand">{((tr.tax_rate as number) * 100).toFixed(2)}%</Badge></Card>); })}</div>)}</div><div><div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Tax Reports</span></div>{fd.taxReports.length === 0 ? <p className="text-xs text-ink-500">No tax reports generated.</p> : (<div className="space-y-1">{fd.taxReports.map((r) => { const rep = r as Record<string, unknown>; return (<Card key={rep.id as string} className="p-2"><div className="flex items-center justify-between"><p className="text-sm text-ink-500">{rep.report_period as string}</p><Badge tone={rep.report_status as string === 'filed' ? 'success' : 'brand'}>{rep.report_status as string}</Badge></div><p className="text-xs text-ink-500 mt-0.5">Taxable: ${(rep.total_taxable_revenue as number).toLocaleString()} · Collected: ${(rep.total_tax_collected as number).toLocaleString()}</p></Card>); })}</div>)}</div></div>);
}

export function ProfitabilitySection({ fd }: { fd: FinanceDashboard }) {
  if (fd.profitability.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No profitability data. Run calculation.</div>;
  return (<div className="space-y-2">{fd.profitability.map((p) => { const prof = p as Record<string, unknown>; return (<Card key={prof.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">{prof.period as string}</p></div><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((prof.ai_confidence as number) * 100)}%</Badge></div><div className="space-y-1"><ScoreBar value={prof.revenue as number} max={prof.revenue as number} label="Revenue" format="currency" /><ScoreBar value={prof.gross_profit as number} max={prof.revenue as number} label="Gross Profit" format="currency" /><ScoreBar value={prof.net_profit as number} max={prof.revenue as number} label="Net Profit" format="currency" /></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Gross Margin</span><p className="text-success-400 font-medium">{(prof.gross_margin as number).toFixed(1)}%</p></div><div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Net Margin</span><p className="text-success-400 font-medium">{(prof.net_margin as number).toFixed(1)}%</p></div></div>{prof.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(prof.ai_reasoning as string).slice(0, 150)}</span></div>}</Card>); })}</div>);
}

export function CustomerLTVSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.customerLTVs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No LTV data. Run LTV calculation.</div>;
  return (<div className="space-y-2">{fd.customerLTVs.map((l) => { const ltv = l as Record<string, unknown>; return (<Card key={ltv.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">LTV: ${(ltv.ai_predicted_ltv as number).toLocaleString()}</p><p className="text-xs text-ink-500">Calculated: ${(ltv.calculated_ltv as number).toLocaleString()} · Lifespan: {ltv.estimated_lifespan_months as number}mo</p></div></div><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((ltv.ai_confidence as number) * 100)}%</Badge></div><div className="space-y-1"><ScoreBar value={ltv.retention_rate as number} label="Retention" format="percent" /><ScoreBar value={ltv.churn_rate as number} label="Churn" format="percent" /><ScoreBar value={ltv.expansion_rate as number} label="Expansion" format="percent" /></div>{ltv.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(ltv.ai_reasoning as string).slice(0, 150)}</span></div>}</Card>); })}</div>);
}

export function CACSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.customerCACs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No CAC data. Run CAC calculation.</div>;
  return (<div className="space-y-2">{fd.customerCACs.map((c) => { const cac = c as Record<string, unknown>; return (<Card key={cac.id as string} className="p-3 space-y-2"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">CAC: ${(cac.cac_per_customer as number).toLocaleString()}</p><p className="text-xs text-ink-500">Customers: {cac.customers_acquired as number} · Total cost: ${(cac.total_acquisition_cost as number).toLocaleString()}</p></div></div><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((cac.ai_confidence as number) * 100)}%</Badge></div><div className="grid grid-cols-3 gap-2 text-xs"><div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">LTV:CAC</span><p className="text-success-400 font-medium">{(cac.ltv_cac_ratio as number).toFixed(1)}x</p></div><div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">ROI</span><p className="text-success-400 font-medium">{(cac.roi as number).toFixed(0)}%</p></div><div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Payback</span><p className="text-ink-500 font-medium">{cac.payback_period_months as number}mo</p></div></div>{cac.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(cac.ai_reasoning as string).slice(0, 150)}</span></div>}</Card>); })}</div>);
}

export function FinanceInsightsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.financeInsights.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No finance insights. Generate insights.</div>;
  const severityTone = { info: 'brand', low: 'brand', medium: 'warning', high: 'warning', critical: 'error' } as const;
  return (<div className="space-y-2">{fd.financeInsights.map((i) => { const ins = i as Record<string, unknown>; return (<Card key={ins.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{ins.insight_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{ins.insight_text as string}</p></div></div><Badge tone={severityTone[ins.severity as string] ?? 'neutral'}>{ins.severity as string}</Badge></div><div className="flex items-center gap-2 mt-1"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((ins.confidence as number) * 100)}%</Badge><span className="text-xs text-ink-500">{timeAgo(ins.created_at as string)}</span></div></Card>); })}</div>);
}

export function FinanceAlertsSection({ fd }: { fd: FinanceDashboard }) {
  if (fd.financeAlerts.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No active finance alerts.</div>;
  const severityTone = { low: 'brand', medium: 'warning', high: 'warning', critical: 'error' } as const;
  return (<div className="space-y-2">{fd.financeAlerts.map((a) => { const al = a as Record<string, unknown>; return (<Card key={al.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-error-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{al.alert_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{al.alert_description as string}</p></div></div><Badge tone={severityTone[al.alert_severity as string] ?? 'neutral'} dot>{al.alert_severity as string}</Badge></div>{(al.amount_impacted as number) > 0 && <p className="text-xs text-error-400 mt-1">Amount impacted: ${(al.amount_impacted as number).toLocaleString()}</p>}{al.recommended_action && <p className="text-xs text-brand-400 mt-1">Recommended: {al.recommended_action as string}</p>}{al.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(al.ai_reasoning as string).slice(0, 120)}</span></div>}</Card>); })}</div>);
}

export function RevenueTrendsSection({ fd }: { fd: FinanceDashboard }) {
  return (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><FinanceKPICard icon={DollarSign} label="Total MRR" value={`$${fd.totalMRR.toLocaleString()}`} trend="up" /><FinanceKPICard icon={TrendingUp} label="Total ARR" value={`$${fd.totalARR.toLocaleString()}`} trend="up" /><FinanceKPICard icon={CheckCircle2} label="Recognized" value={`$${fd.totalRecognized.toLocaleString()}`} trend="up" /><FinanceKPICard icon={Clock} label="Deferred" value={`$${fd.totalDeferred.toLocaleString()}`} /></div>{fd.recognizedRevenue.length > 0 && (<Card className="p-4"><p className="text-sm font-medium text-ink-500 mb-2">Recognized Revenue by Period</p><div className="space-y-1">{fd.recognizedRevenue.slice(0, 10).map((r) => { const rev = r as Record<string, unknown>; return <ScoreBar key={rev.id as string} value={rev.recognized_amount as number} max={fd.totalRecognized || 1} label={rev.recognition_period as string} format="currency" />; })}</div></Card>)}</div>);
}

export function FinanceEmptyState({ onSync, isSyncing }: { onSync: () => void; isSyncing: boolean }) {
  return (<div className="flex flex-col items-center justify-center py-16 space-y-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><DollarSign className="h-8 w-8 text-brand-400" /></div><div className="text-center space-y-2"><h3 className="text-lg font-semibold text-ink-500">Finance Intelligence Engine</h3><p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI Finance Brain manages billing, subscriptions, invoices, payments, revenue recognition, collections, taxes, and profitability. Sync customers from Customer Success to begin.</p></div><button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-4 w-4" />{isSyncing ? 'Syncing...' : 'Sync Customers'}</button></div>);
}
