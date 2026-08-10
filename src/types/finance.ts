export type BillingAccount = {
  id: string; workspace_id: string; customer_account_id: string | null; company_id: string | null;
  account_name: string; billing_email: string | null; billing_type: string; currency: string;
  payment_terms_days: number; created_at: string; updated_at: string;
};
export type Subscription = {
  id: string; workspace_id: string; billing_account_id: string; customer_account_id: string | null;
  subscription_name: string; status: string; billing_cycle: string; mrr: number; arr: number;
  start_date: string; end_date: string | null; created_at: string; updated_at: string;
};
export type Invoice = {
  id: string; workspace_id: string; billing_account_id: string; subscription_id: string | null;
  invoice_number: string; invoice_date: string; due_date: string; status: string;
  subtotal: number; tax_amount: number; total: number; amount_paid: number; amount_due: number;
  created_at: string; updated_at: string;
};
export type PaymentTransaction = {
  id: string; workspace_id: string; billing_account_id: string; invoice_id: string | null;
  transaction_id: string; transaction_type: string; amount: number; currency: string;
  status: string; payment_method: string | null; created_at: string;
};
export type PaymentFailure = {
  id: string; workspace_id: string; billing_account_id: string; invoice_id: string | null;
  failure_reason: string; failure_code: string | null; amount: number; is_resolved: boolean;
  retry_count: number; created_at: string;
};
export type RecognizedRevenue = {
  id: string; workspace_id: string; billing_account_id: string; subscription_id: string | null;
  invoice_id: string | null; recognition_date: string; recognized_amount: number;
  recognition_type: string; created_at: string;
};
export type DeferredRevenue = {
  id: string; workspace_id: string; billing_account_id: string; subscription_id: string | null;
  deferral_date: string; deferred_amount: number; remaining_amount: number;
  recognition_schedule: string; created_at: string;
};
export type AccountsReceivable = {
  id: string; workspace_id: string; billing_account_id: string; invoice_id: string | null;
  amount_due: number; amount_paid: number; days_outstanding: number;
  is_overdue: boolean; created_at: string;
};
export type Profitability = {
  id: string; workspace_id: string; period: string; revenue: number; cogs: number;
  gross_profit: number; gross_margin: number; operating_expenses: number; net_profit: number;
  net_margin: number; created_at: string;
};
export type CustomerLTV = {
  id: string; workspace_id: string; customer_account_id: string; calculation_date: string;
  total_revenue: number; ai_predicted_ltv: number; ltv_cac_ratio: number;
  ai_reasoning: string | null; created_at: string;
};
export type CustomerCAC = {
  id: string; workspace_id: string; cac_per_customer: number; total_cac: number;
  calculation_date: string; ai_reasoning: string | null; created_at: string;
};
export type FinanceDashboard = {
  billingAccounts: BillingAccount[]; subscriptions: Subscription[]; subscriptionItems: unknown[];
  subscriptionChanges: unknown[]; pricingPlans: unknown[]; invoices: Invoice[]; invoiceItems: unknown[];
  paymentTransactions: PaymentTransaction[]; paymentFailures: PaymentFailure[];
  paymentRetries: unknown[]; paymentMethods: unknown[]; recognizedRevenue: RecognizedRevenue[];
  deferredRevenue: DeferredRevenue[]; accountsReceivable: AccountsReceivable[];
  collections: unknown[]; overdueAccounts: unknown[]; taxRates: unknown[]; taxReports: unknown[];
  profitability: Profitability[]; grossMargins: unknown[]; customerLTVs: CustomerLTV[];
  customerCACs: CustomerCAC[]; financeInsights: unknown[]; financeAlerts: unknown[]; coupons: unknown[];
  totalMRR: number; totalARR: number; totalRevenue: number; totalOutstanding: number;
  totalOverdue: number; totalDeferred: number; totalRecognized: number;
  activeSubscriptions: number; overdueInvoices: number; failedPayments: number;
  avgLTV: number; avgCAC: number; avgMargin: number; grossMarginPercent: number;
  netMarginPercent: number; collectionRate: number;
};
