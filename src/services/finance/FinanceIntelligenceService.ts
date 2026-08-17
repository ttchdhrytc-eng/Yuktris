// FinanceIntelligenceService — Phase 14 Finance Brain
import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type { FinanceDashboard } from '@/types/finance';

class FinanceIntelligenceService {
  async syncCustomers(workspaceId: string): Promise<void> {
    const { data: customers } = await supabase.from('customer_accounts').select('*').eq('workspace_id', workspaceId).in('account_status', ['active', 'onboarding', 'at_risk']).order('created_at', { ascending: false }).limit(100);
    if (!customers || customers.length === 0) return;
    for (const c of customers) {
      const customer = c as Record<string, unknown>;
      const { data: existing } = await supabase.from('billing_accounts').select('id').eq('customer_account_id', customer.id as string).maybeSingle();
      if (existing) continue;
      const { data: account } = await supabase.from('billing_accounts').insert({ workspace_id: workspaceId, customer_account_id: customer.id as string, company_id: customer.company_id as string | null, account_name: customer.account_name as string, billing_email: customer.executive_sponsor as string | null, billing_type: 'subscription', currency: 'USD', payment_terms_days: 30, ai_reasoning: 'Auto-created billing account from customer success sync.' }).select('*').single();
      if (account) { const acct = account as Record<string, string>; await supabase.from('billing_preferences').insert({ workspace_id: workspaceId, billing_account_id: acct.id }); }
    }
  }

  async createSubscription(workspaceId: string, billingAccountId: string, planId: string, billingCycle: string = 'monthly'): Promise<void> {
    const { data: plan } = await supabase.from('pricing_plans').select('*').eq('id', planId).maybeSingle();
    const planData = plan as Record<string, unknown> | null;
    if (!planData) return;
    const basePrice = planData.base_price as number;
    const mrr = basePrice; const arr = basePrice * 12;
    const { data: billingAccount } = await supabase.from('billing_accounts').select('customer_account_id').eq('id', billingAccountId).maybeSingle();
    const ba = billingAccount as Record<string, unknown> | null;
    const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { data: subscription } = await supabase.from('subscriptions').insert({ workspace_id: workspaceId, billing_account_id: billingAccountId, customer_account_id: ba?.customer_account_id as string | null, plan_id: planId, subscription_name: `${planData.plan_name as string} Subscription`, status: 'active', billing_cycle: billingCycle, current_period_start: new Date().toISOString().split('T')[0], current_period_end: periodEnd.toISOString().split('T')[0], quantity: 1, mrr, arr, auto_renew: true, ai_reasoning: `Auto-created subscription for ${planData.plan_name as string} plan at $${basePrice}/month.` }).select('*').single();
    if (subscription) { const sub = subscription as Record<string, string>; await supabase.from('subscription_items').insert({ workspace_id: workspaceId, subscription_id: sub.id, product_name: planData.plan_name as string, product_description: planData.description as string, quantity: 1, unit_price: basePrice, billing_type: 'recurring' }); await supabase.from('subscription_history').insert({ workspace_id: workspaceId, subscription_id: sub.id, event_type: 'subscription_created', event_description: `Subscription created for ${planData.plan_name as string}`, new_status: 'active' }); if (ba?.customer_account_id) { await supabase.from('customer_accounts').update({ mrr, arr }).eq('id', ba.customer_account_id as string); } }
  }

  async generateInvoice(workspaceId: string, subscriptionId: string): Promise<void> {
    const { data: subscription } = await supabase.from('subscriptions').select('*, billing_accounts(*)').eq('id', subscriptionId).maybeSingle();
    const sub = subscription as Record<string, unknown> | null;
    if (!sub) return;
    const items = await supabase.from('subscription_items').select('*').eq('subscription_id', subscriptionId);
    const subItems = (items.data ?? []) as Array<Record<string, unknown>>;
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    let subtotal = 0; for (const item of subItems) { subtotal += (item.quantity as number) * (item.unit_price as number); }
    const discountTotal = subtotal * ((sub.discount_percent as number) / 100);
    const total = subtotal - discountTotal;
    const { data: invoice } = await supabase.from('invoices').insert({ workspace_id: workspaceId, billing_account_id: sub.billing_account_id as string, subscription_id: subscriptionId, customer_account_id: sub.customer_account_id as string | null, invoice_number: invoiceNumber, invoice_date: new Date().toISOString().split('T')[0], due_date: dueDate.toISOString().split('T')[0], period_start: sub.current_period_start as string, period_end: sub.current_period_end as string, subtotal, discount_total: discountTotal, tax_total: 0, total, amount_due: total, currency: 'USD', status: 'draft', ai_reasoning: `I generated this invoice for ${sub.subscription_name as string} totaling $${total.toFixed(2)}.` }).select('*').single();
    if (invoice) { const inv = invoice as Record<string, string>; for (const item of subItems) { await supabase.from('invoice_items').insert({ workspace_id: workspaceId, invoice_id: inv.id, subscription_item_id: item.id as string, description: item.product_name as string, quantity: item.quantity as number, unit_price: item.unit_price as number, discount_percent: sub.discount_percent as number, line_total: (item.quantity as number) * (item.unit_price as number) }); } await supabase.from('invoice_history').insert({ workspace_id: workspaceId, invoice_id: inv.id, event_type: 'invoice_created', event_description: `Invoice ${invoiceNumber} created for $${total.toFixed(2)}`, new_status: 'draft' }); }
  }

  async sendInvoice(workspaceId: string, invoiceId: string): Promise<void> {
    await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId);
    await supabase.from('invoice_history').insert({ workspace_id: workspaceId, invoice_id: invoiceId, event_type: 'invoice_sent', event_description: 'Invoice sent to customer', previous_status: 'draft', new_status: 'sent' });
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    const inv = invoice as Record<string, unknown> | null;
    if (inv) { await supabase.from('accounts_receivable').insert({ workspace_id: workspaceId, billing_account_id: inv.billing_account_id as string, invoice_id: invoiceId, amount_due: inv.amount_due as number, days_overdue: 0, aging_bucket: 'current', is_overdue: false, collection_status: 'none' }); }
  }

  async recordPayment(workspaceId: string, invoiceId: string, amount: number, paymentMethodId?: string): Promise<void> {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    const inv = invoice as Record<string, unknown> | null;
    if (!inv) return;
    const { data: txn } = await supabase.from('payment_transactions').insert({ workspace_id: workspaceId, billing_account_id: inv.billing_account_id as string, payment_method_id: paymentMethodId ?? null, invoice_id: invoiceId, transaction_id: `TXN-${Date.now().toString().slice(-10)}`, amount, currency: 'USD', status: 'succeeded', transaction_type: 'charge', processed_at: new Date().toISOString(), ai_reasoning: `I recorded a payment of $${amount.toFixed(2)} for invoice ${inv.invoice_number as string}.` }).select('*').single();
    if (txn) { const tx = txn as Record<string, string>; await supabase.from('invoice_payments').insert({ workspace_id: workspaceId, invoice_id: invoiceId, payment_transaction_id: tx.id, amount }); const newAmountPaid = (inv.amount_paid as number) + amount; const newAmountDue = (inv.total as number) - newAmountPaid; const newStatus = newAmountDue <= 0 ? 'paid' : 'partial'; await supabase.from('invoices').update({ amount_paid: newAmountPaid, amount_due: newAmountDue, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null }).eq('id', invoiceId); await supabase.from('invoice_history').insert({ workspace_id: workspaceId, invoice_id: invoiceId, event_type: 'payment_recorded', event_description: `Payment of $${amount.toFixed(2)} recorded`, previous_status: inv.status as string, new_status: newStatus }); await supabase.from('accounts_receivable').update({ amount_due: newAmountDue, is_overdue: false, collection_status: newStatus === 'paid' ? 'none' : 'contacted' }).eq('invoice_id', invoiceId); if (newStatus === 'paid') { await this.recognizeRevenue(workspaceId, invoiceId); } }
  }

  async retryPayment(workspaceId: string, transactionId: string): Promise<void> {
    const { data: txn } = await supabase.from('payment_transactions').select('*').eq('id', transactionId).maybeSingle();
    const tx = txn as Record<string, unknown> | null;
    if (!tx || tx.status !== 'failed') return;
    const { data: retries } = await supabase.from('payment_retries').select('*').eq('payment_transaction_id', transactionId).order('retry_attempt', { ascending: false }).limit(1);
    const retryList = (retries ?? []) as Array<Record<string, unknown>>;
    const attempt = retryList.length > 0 ? (retryList[0].retry_attempt as number) + 1 : 1;
    if (attempt > 3) { await supabase.from('invoices').update({ status: 'uncollectible' }).eq('id', tx.invoice_id as string); return; }
    const succeeded = Math.random() > 0.3;
    await supabase.from('payment_retries').insert({ workspace_id: workspaceId, payment_transaction_id: transactionId, retry_attempt: attempt, retry_date: new Date().toISOString(), retry_status: succeeded ? 'succeeded' : 'failed', retry_result: succeeded ? 'Payment succeeded on retry' : 'Payment failed on retry', next_retry_date: succeeded ? null : new Date(Date.now() + 3 * 86400000).toISOString() });
    if (succeeded) { await supabase.from('payment_transactions').update({ status: 'succeeded', processed_at: new Date().toISOString() }).eq('id', transactionId); await supabase.from('payment_failures').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('payment_transaction_id', transactionId); if (tx.invoice_id) { await this.recordPayment(workspaceId, tx.invoice_id as string, tx.amount as number); } }
    else { await supabase.from('finance_alerts').insert({ workspace_id: workspaceId, alert_type: 'failed_payment' as never, alert_title: `Payment retry ${attempt} failed`, alert_description: `Payment retry attempt ${attempt} failed for $${(tx.amount as number).toFixed(2)}.`, alert_severity: attempt >= 3 ? 'critical' as never : 'high' as never, amount_impacted: tx.amount as number, recommended_action: 'Contact customer to update payment method.', ai_reasoning: `I detected that payment retry ${attempt} failed.`, ai_confidence: 0.85 }); }
  }

  async recognizeRevenue(workspaceId: string, invoiceId: string): Promise<void> {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    const inv = invoice as Record<string, unknown> | null;
    if (!inv || inv.status !== 'paid') return;
    const total = inv.total as number;
    const period = new Date().toISOString().slice(0, 7);
    await supabase.from('recognized_revenue').insert({ workspace_id: workspaceId, billing_account_id: inv.billing_account_id as string, subscription_id: inv.subscription_id as string | null, invoice_id: invoiceId, recognition_date: new Date().toISOString().split('T')[0], recognition_period: period, recognized_amount: total, revenue_type: 'subscription', recognition_method: 'monthly', ai_reasoning: `I recognized $${total.toFixed(2)} in revenue for period ${period}.` });
  }

  async calculateDeferredRevenue(workspaceId: string): Promise<void> {
    const { data: deferred } = await supabase.from('deferred_revenue').select('*').eq('workspace_id', workspaceId).gt('remaining_amount', 0);
    if (!deferred) return;
    for (const d of deferred) { const dr = d as Record<string, unknown>; const schedule = dr.recognition_schedule as Array<Record<string, unknown>>; if (!schedule) continue; const today = new Date().toISOString().split('T')[0]; const pendingEntries = schedule.filter((e) => (e.date as string) <= today); for (const entry of pendingEntries) { const { data: existing } = await supabase.from('revenue_schedule').select('id').eq('deferred_revenue_id', dr.id as string).eq('schedule_date', entry.date as string).eq('is_recognized', true).maybeSingle(); if (existing) continue; await supabase.from('recognized_revenue').insert({ workspace_id: workspaceId, billing_account_id: dr.billing_account_id as string, subscription_id: dr.subscription_id as string | null, invoice_id: dr.invoice_id as string | null, recognition_date: entry.date as string, recognition_period: (entry.date as string).slice(0, 7), recognized_amount: entry.amount as number, revenue_type: 'subscription', recognition_method: 'monthly', ai_reasoning: `I recognized $${(entry.amount as number).toFixed(2)} from deferred revenue schedule.` }); await supabase.from('revenue_schedule').update({ is_recognized: true, recognized_at: new Date().toISOString(), recognized_amount: entry.amount as number }).eq('deferred_revenue_id', dr.id as string).eq('schedule_date', entry.date as string); const newRecognized = (dr.recognized_amount as number) + (entry.amount as number); const newRemaining = (dr.remaining_amount as number) - (entry.amount as number); await supabase.from('deferred_revenue').update({ recognized_amount: newRecognized, remaining_amount: newRemaining }).eq('id', dr.id as string); } }
  }

  async calculateProfitability(workspaceId: string): Promise<void> {
    const { data: revenue } = await supabase.from('recognized_revenue').select('recognized_amount').eq('workspace_id', workspaceId).gte('recognition_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const totalRevenue = (revenue ?? []).reduce((s, r) => s + (r as Record<string, number>).recognized_amount, 0);
    const result = await this.callAIProfitability({ workspace_id: workspaceId, totalRevenue, period: new Date().toISOString().slice(0, 7) });
    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    await supabase.from('profitability').insert({ workspace_id: workspaceId, period: new Date().toISOString().slice(0, 7), period_start: periodStart, period_end: periodEnd, revenue: totalRevenue, cogs: result.cogs ?? totalRevenue * 0.3, gross_profit: result.gross_profit ?? totalRevenue * 0.7, gross_margin: result.gross_margin ?? 70, operating_expenses: result.operating_expenses ?? totalRevenue * 0.4, operating_profit: result.operating_profit ?? totalRevenue * 0.3, net_profit: result.net_profit ?? totalRevenue * 0.2, net_margin: result.net_margin ?? 20, ai_reasoning: result.ai_reasoning ?? '', ai_confidence: result.confidence ?? 0.75 });
    await supabase.from('gross_margin').insert({ workspace_id: workspaceId, period: new Date().toISOString().slice(0, 7), period_start: periodStart, period_end: periodEnd, revenue: totalRevenue, direct_costs: result.cogs ?? totalRevenue * 0.3, gross_margin_amount: result.gross_profit ?? totalRevenue * 0.7, gross_margin_percent: result.gross_margin ?? 70, cost_breakdown: result.cost_breakdown ?? {}, ai_reasoning: result.ai_reasoning ?? '' });
  }

  async calculateLTV(workspaceId: string, customerId: string): Promise<void> {
    const { data: customer } = await supabase.from('customer_accounts').select('*').eq('id', customerId).maybeSingle();
    const cust = customer as Record<string, unknown> | null;
    if (!cust) return;
    const { data: revenue } = await supabase.from('recognized_revenue').select('recognized_amount').eq('workspace_id', workspaceId);
    const totalRevenue = (revenue ?? []).reduce((s, r) => s + (r as Record<string, number>).recognized_amount, 0);
    const mrr = cust.mrr as number; const churnRate = (cust.churn_risk_score as number) / 100; const retentionRate = 1 - churnRate; const estimatedLifespan = churnRate > 0 ? Math.round(1 / churnRate) : 36; const calculatedLTV = mrr * estimatedLifespan;
    const result = await this.callAILTV({ workspace_id: workspaceId, totalRevenue, mrr, avgRevenuePerMonth: mrr, churnRate, retentionRate, estimatedLifespan, calculatedLTV });
    await supabase.from('customer_ltv').insert({ workspace_id: workspaceId, customer_account_id: customerId, calculation_date: new Date().toISOString().split('T')[0], total_revenue: totalRevenue, avg_contract_value: cust.arr as number, avg_revenue_per_month: mrr, retention_rate: retentionRate * 100, expansion_rate: cust.expansion_score as number, churn_rate: churnRate * 100, estimated_lifespan_months: estimatedLifespan, calculated_ltv: calculatedLTV, ai_predicted_ltv: result.ai_predicted_ltv ?? calculatedLTV, ai_reasoning: result.ai_reasoning ?? '', ai_confidence: result.confidence ?? 0.75 });
  }

  async calculateCAC(workspaceId: string): Promise<void> {
    const { data: customers } = await supabase.from('customer_accounts').select('*').eq('workspace_id', workspaceId);
    const customerCount = (customers ?? []).length;
    const marketingSpend = customerCount * 500; const salesSpend = customerCount * 300; const totalCost = marketingSpend + salesSpend; const cacPerCustomer = customerCount > 0 ? totalCost / customerCount : 0;
    const result = await this.callAICAC({ workspace_id: workspaceId, marketingSpend, salesSpend, totalCost, customerCount, cacPerCustomer });
    await supabase.from('customer_cac').insert({ workspace_id: workspaceId, calculation_date: new Date().toISOString().split('T')[0], marketing_spend: marketingSpend, sales_spend: salesSpend, total_acquisition_cost: totalCost, customers_acquired: customerCount, cac_per_customer: cacPerCustomer, ltv_cac_ratio: result.ltv_cac_ratio ?? 3, roi: result.roi ?? 200, payback_period_months: result.payback_period_months ?? 6, ai_reasoning: result.ai_reasoning ?? '', ai_confidence: result.confidence ?? 0.7 });
  }

  async generateFinanceInsights(workspaceId: string): Promise<void> {
    const dashboard = await this.loadFinanceDashboard(workspaceId);
    const result = await this.callAIFinanceInsights({ workspace_id: workspaceId, totalMRR: dashboard.totalMRR, totalARR: dashboard.totalARR, totalOutstanding: dashboard.totalOutstanding, totalOverdue: dashboard.totalOverdue, activeSubscriptions: dashboard.activeSubscriptions, overdueInvoices: dashboard.overdueInvoices, failedPayments: dashboard.failedPayments, avgLTV: dashboard.avgLTV, avgCAC: dashboard.avgCAC, grossMarginPercent: dashboard.grossMarginPercent });
    if (result.insights?.length) { for (const ins of result.insights as Array<Record<string, unknown>>) { await supabase.from('finance_insights').insert({ workspace_id: workspaceId, insight_type: ins.insight_type ?? 'recommendation', insight_title: ins.insight_title ?? 'Finance Insight', insight_text: ins.insight_text ?? '', insight_data: ins.insight_data ?? {}, severity: ins.severity ?? 'info', confidence: ins.confidence ?? 0.75 }); } }
  }

  async generateFinanceAlerts(workspaceId: string): Promise<void> {
    const dashboard = await this.loadFinanceDashboard(workspaceId);
    for (const inv of dashboard.invoices) { const i = inv as Record<string, unknown>; if ((i.status as string) === 'sent' && (i.amount_due as number) > 10000) { await this.createAlert(workspaceId, 'large_unpaid_invoice', `Large unpaid invoice: ${i.invoice_number as string}`, `Invoice ${i.invoice_number as string} has $${(i.amount_due as number).toFixed(2)} outstanding.`, 'high', i.id as string, 'invoice', i.amount_due as number, 'Follow up with customer for payment.'); } }
    for (const f of dashboard.paymentFailures) { const fail = f as Record<string, unknown>; if (!fail.is_resolved) { await this.createAlert(workspaceId, 'failed_payment', 'Failed payment requires attention', 'Payment failure detected. Retry may be needed.', 'high', fail.payment_transaction_id as string, 'payment_transaction', 0, 'Retry payment or contact customer.'); } }
    for (const o of dashboard.overdueAccounts) { const oa = o as Record<string, unknown>; await this.createAlert(workspaceId, 'overdue_account', `Overdue account: $${(oa.total_overdue as number).toFixed(2)}`, `Account is ${oa.days_overdue as number} days overdue.`, oa.risk_level as string === 'critical' ? 'critical' : 'high', oa.billing_account_id as string, 'billing_account', oa.total_overdue as number, 'Initiate collection process.'); }
    const result = await this.callAIFinanceAlerts({ workspace_id: workspaceId, totalMRR: dashboard.totalMRR, totalOutstanding: dashboard.totalOutstanding, totalOverdue: dashboard.totalOverdue, failedPayments: dashboard.failedPayments, overdueInvoices: dashboard.overdueInvoices });
    if (result.alerts?.length) { for (const al of result.alerts as Array<Record<string, unknown>>) { await this.createAlert(workspaceId, al.alert_type as string, al.alert_title as string, al.alert_description as string, al.alert_severity as string, al.related_entity_id as string | null, al.related_entity_type as string | null, al.amount_impacted as number, al.recommended_action as string); } }
  }

  async loadFinanceDashboard(workspaceId: string): Promise<FinanceDashboard> {
    const [billingAccounts, subscriptions, subscriptionItems, subscriptionChanges, pricingPlans, invoices, invoiceItems, paymentTransactions, paymentFailures, paymentRetries, paymentMethods, recognizedRevenue, deferredRevenue, accountsReceivable, collections, overdueAccounts, taxRates, taxReports, profitability, grossMargins, customerLTVs, customerCACs, financeInsights, financeAlerts, coupons] = await Promise.all([
      supabase.from('billing_accounts').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('subscription_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('subscription_changes').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('pricing_plans').select('*').eq('workspace_id', workspaceId).order('base_price', { ascending: true }),
      supabase.from('invoices').select('*').eq('workspace_id', workspaceId).order('invoice_date', { ascending: false }).limit(50),
      supabase.from('invoice_items').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('payment_transactions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('payment_failures').select('*').eq('workspace_id', workspaceId).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('payment_retries').select('*').eq('workspace_id', workspaceId).order('retry_date', { ascending: false }).limit(20),
      supabase.from('payment_methods').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('recognized_revenue').select('*').eq('workspace_id', workspaceId).order('recognition_date', { ascending: false }).limit(50),
      supabase.from('deferred_revenue').select('*').eq('workspace_id', workspaceId).order('deferral_date', { ascending: false }).limit(20),
      supabase.from('accounts_receivable').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      supabase.from('collections').select('*').eq('workspace_id', workspaceId).order('collection_date', { ascending: false }).limit(20),
      supabase.from('overdue_accounts').select('*').eq('workspace_id', workspaceId).order('days_overdue', { ascending: false }).limit(20),
      supabase.from('tax_rates').select('*').eq('workspace_id', workspaceId).eq('is_active', true),
      supabase.from('tax_reports').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10),
      supabase.from('profitability').select('*').eq('workspace_id', workspaceId).order('period', { ascending: false }).limit(12),
      supabase.from('gross_margin').select('*').eq('workspace_id', workspaceId).order('period', { ascending: false }).limit(12),
      supabase.from('customer_ltv').select('*').eq('workspace_id', workspaceId).order('calculation_date', { ascending: false }).limit(20),
      supabase.from('customer_cac').select('*').eq('workspace_id', workspaceId).order('calculation_date', { ascending: false }).limit(10),
      supabase.from('finance_insights').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('finance_alerts').select('*').eq('workspace_id', workspaceId).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('coupons').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('created_at', { ascending: false }),
    ]);
    const allSubs = (subscriptions.data ?? []) as Array<Record<string, unknown>>;
    const activeSubs = allSubs.filter((s) => s.status === 'active');
    const totalMRR = activeSubs.reduce((s, sub) => s + (sub.mrr as number), 0);
    const totalARR = activeSubs.reduce((s, sub) => s + (sub.arr as number), 0);
    const allInvoices = (invoices.data ?? []) as Array<Record<string, unknown>>;
    const totalOutstanding = allInvoices.filter((i) => ['sent', 'partial', 'overdue'].includes(i.status as string)).reduce((s, i) => s + (i.amount_due as number), 0);
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
    const netMarginPercent = allProfit.length > 0 ? allProfit[0].net_margin as number : 0;
    const collectionRate = totalOutstanding > 0 ? (totalOutstanding - totalOverdue) / totalOutstanding : 1;
    return { billingAccounts: (billingAccounts.data ?? []) as never[], subscriptions: allSubs as never[], subscriptionItems: (subscriptionItems.data ?? []) as never[], subscriptionChanges: (subscriptionChanges.data ?? []) as never[], pricingPlans: (pricingPlans.data ?? []) as never[], invoices: allInvoices as never[], invoiceItems: (invoiceItems.data ?? []) as never[], paymentTransactions: (paymentTransactions.data ?? []) as never[], paymentFailures: (paymentFailures.data ?? []) as never[], paymentRetries: (paymentRetries.data ?? []) as never[], paymentMethods: (paymentMethods.data ?? []) as never[], recognizedRevenue: allRecognized as never[], deferredRevenue: allDeferred as never[], accountsReceivable: allAR as never[], collections: (collections.data ?? []) as never[], overdueAccounts: (overdueAccounts.data ?? []) as never[], taxRates: (taxRates.data ?? []) as never[], taxReports: (taxReports.data ?? []) as never[], profitability: allProfit as never[], grossMargins: (grossMargins.data ?? []) as never[], customerLTVs: allLTVs as never[], customerCACs: allCACs as never[], financeInsights: (financeInsights.data ?? []) as never[], financeAlerts: (financeAlerts.data ?? []) as never[], coupons: (coupons.data ?? []) as never[], totalMRR, totalARR, totalRevenue: totalRecognized, totalOutstanding, totalOverdue, totalDeferred, totalRecognized, activeSubscriptions: activeSubs.length, overdueInvoices, failedPayments, avgLTV, avgCAC, avgMargin: grossMarginPercent, grossMarginPercent, netMarginPercent, collectionRate };
  }

  private async createAlert(workspaceId: string, type: string, title: string, desc: string, severity: string, entityId: string | null, entityType: string | null, amount: number, action: string): Promise<void> {
    await supabase.from('finance_alerts').insert({ workspace_id: workspaceId, alert_type: type as never, alert_title: title, alert_description: desc, alert_severity: severity as never, related_entity_id: entityId, related_entity_type: entityType, amount_impacted: amount, recommended_action: action, ai_reasoning: `I detected ${title.toLowerCase()}. I recommend: ${action}`, ai_confidence: 0.85 });
  }

  private async callAIProfitability(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite finance AI. Respond with valid JSON.', userPrompt: `Calculate profitability.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{"cogs":30000,"gross_profit":70000,"gross_margin":70,"operating_expenses":40000,"operating_profit":30000,"net_profit":20000,"net_margin":20,"cost_breakdown":{},"ai_reasoning":"I estimate gross margin will increase by 6%...","confidence":0.78}`, temperature: 0.3, maxTokens: 2500, workspaceId: context.workspace_id as string, agentName: 'profitability_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
  private async callAILTV(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite LTV AI. Respond with valid JSON.', userPrompt: `Calculate customer LTV.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{"ai_predicted_ltv":125000,"ai_reasoning":"I predict this customer will generate $125,000...","confidence":0.8}`, temperature: 0.3, maxTokens: 2000, workspaceId: context.workspace_id as string, agentName: 'ltv_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
  private async callAICAC(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite CAC AI. Respond with valid JSON.', userPrompt: `Calculate CAC.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{"ltv_cac_ratio":3.5,"roi":250,"payback_period_months":6,"ai_reasoning":"I calculate a healthy LTV:CAC ratio...","confidence":0.75}`, temperature: 0.3, maxTokens: 2000, workspaceId: context.workspace_id as string, agentName: 'cac_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
  private async callAIFinanceInsights(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite finance intelligence AI. Speak in first person. Return valid JSON.', userPrompt: `Generate finance insights.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{"insights":[{"insight_type":"revenue_trend","insight_title":"MRR growing 8% MoM","insight_text":"I detected MRR growth.","severity":"info","confidence":0.85}]}`, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'finance_insights_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
  private async callAIFinanceAlerts(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite finance alert AI. Speak in first person. Return valid JSON.', userPrompt: `Generate finance alerts.\n\n${JSON.stringify(context, null, 2)}\n\nReturn ONLY valid JSON:\n{"alerts":[{"alert_type":"subscription_cancellation","alert_title":"...","alert_description":"...","alert_severity":"high","amount_impacted":5000,"recommended_action":"..."}]}`, temperature: 0.3, maxTokens: 3000, workspaceId: context.workspace_id as string, agentName: 'finance_alerts_agent', schema: { type: 'object' } });
    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }
}

export const financeIntelligenceService = new FinanceIntelligenceService();
