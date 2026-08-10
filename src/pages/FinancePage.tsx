import { DollarSign, TrendingUp, AlertTriangle, Brain, Zap, PieChart, Percent, Wallet, Clock, CheckCircle2, Activity, Sparkles, Coins, Target, Receipt, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useFinanceDashboard } from '@/hooks/useFinance';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';

export function FinancePage() {
  const { workspace } = useWorkspace();
  const { data: fd, isLoading } = useFinanceDashboard();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  const syncCustomers = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { data: customers } = await supabase.from('customer_accounts').select('*').eq('workspace_id', workspace.id).in('account_status', ['active','onboarding','at_risk']).limit(100);
      for (const c of (customers ?? [])) {
        const { data: existing } = await supabase.from('billing_accounts').select('id').eq('customer_account_id', c.id).maybeSingle();
        if (existing) continue;
        await supabase.from('billing_accounts').insert({ workspace_id: workspace.id, customer_account_id: c.id, company_id: c.company_id, account_name: c.account_name, billing_email: c.executive_sponsor, billing_type: 'subscription', currency: 'USD', payment_terms_days: 30, ai_reasoning: 'Auto-created from customer sync.' });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finance'] }); toast.success('I synced billing accounts.'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Brain },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'subscriptions', label: 'Subscriptions', icon: TrendingUp },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'health', label: 'Health', icon: Activity },
  ] as const;

  if (isLoading) {
    return (<div><PageHeader title="Finance Intelligence" description="AI Finance Brain — billing, subscriptions, revenue recognition, and profitability." /><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></div>);
  }

  if (!fd || fd.billingAccounts.length === 0) {
    return (<div><PageHeader title="Finance Intelligence" description="AI Finance Brain — billing, subscriptions, revenue recognition, and profitability." /><Card className="p-6"><div className="flex flex-col items-center justify-center py-16 space-y-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><DollarSign className="h-8 w-8 text-brand-400" /></div><div className="text-center space-y-2"><h3 className="text-lg font-semibold text-ink-500">Finance Intelligence Engine</h3><p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI Finance Brain manages billing, subscriptions, invoices, payments, revenue recognition, collections, taxes, and profitability. Sync customers to begin.</p></div><button onClick={() => syncCustomers.mutate()} disabled={syncCustomers.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-4 w-4" />{syncCustomers.isPending ? 'Syncing...' : 'Sync Customers'}</button></div></Card></div>);
  }

  return (
    <div>
      <PageHeader title="Finance Intelligence" description="AI Finance Brain — billing, subscriptions, revenue recognition, and profitability." actions={<button onClick={() => syncCustomers.mutate()} disabled={syncCustomers.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-3.5 w-3.5" />Sync</button>} />
      <div className="flex items-start gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4"><Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" /><div className="flex-1"><p className="text-sm text-ink-500">I'm managing {fd.activeSubscriptions} active subscriptions with ${fd.totalMRR.toLocaleString()}/month MRR. {fd.totalOverdue > 0 ? `I detected ${fd.overdueInvoices} overdue invoices totaling $${fd.totalOverdue.toLocaleString()}.` : 'All invoices are current.'}</p><p className="text-xs text-ink-500 mt-0.5">ARR: ${fd.totalARR.toLocaleString()} · Gross Margin: {fd.grossMarginPercent.toFixed(1)}% · Avg LTV: ${fd.avgLTV.toLocaleString()} · Avg CAC: ${fd.avgCAC.toLocaleString()}</p></div></div>
      <Card>
        <div className="border-b border-gold-500/12 px-2"><div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">{TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500'}`}><t.icon className="h-3.5 w-3.5" />{t.label}</button>))}</div></div>
        <div className="p-4">
          {tab === 'overview' && (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[<Card key="mrr" className="p-4"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">MRR</span></div><p className="text-2xl font-bold text-ink-500">${fd.totalMRR.toLocaleString()}</p></Card>, <Card key="arr" className="p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">ARR</span></div><p className="text-2xl font-bold text-ink-500">${fd.totalARR.toLocaleString()}</p></Card>, <Card key="out" className="p-4"><div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Outstanding</span></div><p className="text-2xl font-bold text-ink-500">${fd.totalOutstanding.toLocaleString()}</p></Card>, <Card key="over" className="p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Overdue</span></div><p className="text-2xl font-bold text-ink-500">${fd.totalOverdue.toLocaleString()}</p></Card>]}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[<Card key="subs" className="p-4"><div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Active Subs</span></div><p className="text-2xl font-bold text-ink-500">{fd.activeSubscriptions}</p></Card>, <Card key="oi" className="p-4"><div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Overdue Invoices</span></div><p className="text-2xl font-bold text-ink-500">{fd.overdueInvoices}</p></Card>, <Card key="fp" className="p-4"><div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Failed Payments</span></div><p className="text-2xl font-bold text-ink-500">{fd.failedPayments}</p></Card>, <Card key="gm" className="p-4"><div className="flex items-center gap-2 mb-1"><Percent className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Gross Margin</span></div><p className="text-2xl font-bold text-ink-500">{fd.grossMarginPercent.toFixed(1)}%</p></Card>]}</div></div>)}
          {tab === 'billing' && (<div className="space-y-2">{fd.billingAccounts.map((a) => { const ac = a as Record<string, unknown>; return (<Card key={ac.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{ac.account_name as string}</p><p className="text-xs text-ink-500">{ac.billing_type as string} · {ac.currency as string}</p></div></div><Badge tone="brand">{ac.billing_type as string}</Badge></div></Card>); })}</div>)}
          {tab === 'subscriptions' && (<div className="space-y-2">{fd.subscriptions.map((s) => { const sub = s as Record<string, unknown>; return (<Card key={sub.id as string} className="p-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{sub.subscription_name as string}</p><p className="text-xs text-ink-500">MRR: ${(sub.mrr as number).toLocaleString()} · {sub.billing_cycle as string}</p></div><Badge tone={sub.status as string === 'active' ? 'success' : 'neutral'} dot>{sub.status as string}</Badge></div></Card>); })}</div>)}
          {tab === 'invoices' && (<div className="space-y-2">{fd.invoices.map((i) => { const inv = i as Record<string, unknown>; return (<Card key={inv.id as string} className="p-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{inv.invoice_number as string}</p><p className="text-xs text-ink-500">Due: {inv.due_date as string} · Total: ${(inv.total as number).toLocaleString()}</p></div><Badge tone={inv.status as string === 'paid' ? 'success' : inv.status as string === 'overdue' ? 'error' : 'brand'} dot>{inv.status as string}</Badge></div></Card>); })}</div>)}
          {tab === 'payments' && (<div className="space-y-2">{fd.paymentTransactions.map((t) => { const tx = t as Record<string, unknown>; return (<Card key={tx.id as string} className="p-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{tx.transaction_id as string}</p><p className="text-xs text-ink-500">${(tx.amount as number).toLocaleString()} · {tx.transaction_type as string}</p></div><Badge tone={tx.status as string === 'succeeded' ? 'success' : tx.status as string === 'failed' ? 'error' : 'brand'} dot>{tx.status as string}</Badge></div></Card>); })}</div>)}
          {tab === 'health' && (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[<Card key="ltv" className="p-4"><div className="flex items-center gap-2 mb-1"><Coins className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Avg LTV</span></div><p className="text-2xl font-bold text-ink-500">${fd.avgLTV.toLocaleString()}</p></Card>, <Card key="cac" className="p-4"><div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Avg CAC</span></div><p className="text-2xl font-bold text-ink-500">${fd.avgCAC.toLocaleString()}</p></Card>, <Card key="cr" className="p-4"><div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Collection Rate</span></div><p className="text-2xl font-bold text-ink-500">{(fd.collectionRate * 100).toFixed(1)}%</p></Card>]}</div></div>)}
        </div>
      </Card>
    </div>
  );
}
