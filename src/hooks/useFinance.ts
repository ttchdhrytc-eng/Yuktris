import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { FinanceDashboard } from '@/types/finance';

export const financeKeys = {
  all: ['finance'] as const,
  dashboard: (wsId: string) => ['finance', 'dashboard', wsId] as const,
};

export function useFinanceDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: financeKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [billingAccounts, subscriptions, invoices, paymentTransactions, paymentFailures, recognizedRevenue, deferredRevenue, accountsReceivable, profitability, customerLTVs, customerCACs] = await Promise.all([
        supabase.from('billing_accounts').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('workspace_id', workspace.id).order('invoice_date', { ascending: false }).limit(50),
        supabase.from('payment_transactions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('payment_failures').select('*').eq('workspace_id', workspace.id).eq('is_resolved', false).limit(20),
        supabase.from('recognized_revenue').select('*').eq('workspace_id', workspace.id).order('recognition_date', { ascending: false }).limit(50),
        supabase.from('deferred_revenue').select('*').eq('workspace_id', workspace.id).order('deferral_date', { ascending: false }).limit(20),
        supabase.from('accounts_receivable').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('profitability').select('*').eq('workspace_id', workspace.id).order('period', { ascending: false }).limit(12),
        supabase.from('customer_ltv').select('*').eq('workspace_id', workspace.id).order('calculation_date', { ascending: false }).limit(20),
        supabase.from('customer_cac').select('*').eq('workspace_id', workspace.id).order('calculation_date', { ascending: false }).limit(10),
      ]);
      const allSubs = (subscriptions.data ?? []) as Array<Record<string, unknown>>;
      const activeSubs = allSubs.filter((s) => s.status === 'active');
      const totalMRR = activeSubs.reduce((s, sub) => s + (sub.mrr as number), 0);
      const totalARR = activeSubs.reduce((s, sub) => s + (sub.arr as number), 0);
      const allInvoices = (invoices.data ?? []) as Array<Record<string, unknown>>;
      const totalOutstanding = allInvoices.filter((i) => ['sent','partial','overdue'].includes(i.status as string)).reduce((s, i) => s + (i.amount_due as number), 0);
      const allAR = (accountsReceivable.data ?? []) as Array<Record<string, unknown>>;
      const totalOverdue = allAR.filter((a) => a.is_overdue as boolean).reduce((s, a) => s + (a.amount_due as number), 0);
      const allDeferred = (deferredRevenue.data ?? []) as Array<Record<string, unknown>>;
      const totalDeferred = allDeferred.reduce((s, d) => s + (d.remaining_amount as number), 0);
      const allRecognized = (recognizedRevenue.data ?? []) as Array<Record<string, unknown>>;
      const totalRecognized = allRecognized.reduce((s, r) => s + (r.recognized_amount as number), 0);
      const overdueInvoices = allInvoices.filter((i) => i.status === 'overdue').length;
      const failedPayments = (paymentFailures.data ?? []).length;
      const allLTVs = (customerLTVs.data ?? []) as Array<Record<string, unknown>>;
      const avgLTV = allLTVs.length > 0 ? allLTVs.reduce((s, l) => s + (l.ai_predicted_ltv as number), 0) / allLTVs.length : 0;
      const allCACs = (customerCACs.data ?? []) as Array<Record<string, unknown>>;
      const avgCAC = allCACs.length > 0 ? allCACs[0].cac_per_customer as number : 0;
      const allProfit = (profitability.data ?? []) as Array<Record<string, unknown>>;
      const grossMarginPercent = allProfit.length > 0 ? allProfit[0].gross_margin as number : 0;
      const collectionRate = totalOutstanding > 0 ? (totalOutstanding - totalOverdue) / totalOutstanding : 1;
      return {
        billingAccounts: (billingAccounts.data ?? []) as never[],
        subscriptions: allSubs as never[], subscriptionItems: [], subscriptionChanges: [], pricingPlans: [],
        invoices: allInvoices as never[], invoiceItems: [],
        paymentTransactions: (paymentTransactions.data ?? []) as never[],
        paymentFailures: (paymentFailures.data ?? []) as never[],
        paymentRetries: [], paymentMethods: [],
        recognizedRevenue: allRecognized as never[],
        deferredRevenue: allDeferred as never[],
        accountsReceivable: allAR as never[],
        collections: [], overdueAccounts: [], taxRates: [], taxReports: [],
        profitability: allProfit as never[], grossMargins: [],
        customerLTVs: allLTVs as never[], customerCACs: allCACs as never[],
        financeInsights: [], financeAlerts: [], coupons: [],
        totalMRR, totalARR, totalRevenue: totalRecognized,
        totalOutstanding, totalOverdue, totalDeferred, totalRecognized,
        activeSubscriptions: activeSubs.length, overdueInvoices, failedPayments,
        avgLTV, avgCAC, avgMargin: grossMarginPercent,
        grossMarginPercent, netMarginPercent: 0, collectionRate,
      } as FinanceDashboard;
    },
    refetchInterval: 15000,
  });
}
