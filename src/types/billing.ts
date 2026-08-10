// ============================================================
// Billing Types — Provider-neutral payment types
// ============================================================

export type BillingProvider = 'paddle';

export type CustomerStatus = 'active' | 'inactive' | 'deleted';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'deleted';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'refunded';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'canceled';

export interface BillingCustomer {
  id: string;
  workspace_id: string;
  provider: BillingProvider;
  provider_customer_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  default_payment_method: string | null;
  currency: string;
  address: Record<string, unknown>;
  status: CustomerStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingSubscription {
  id: string;
  workspace_id: string;
  provider: BillingProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  status: SubscriptionStatus;
  plan_id: string | null;
  price_id: string | null;
  quantity: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoice {
  id: string;
  workspace_id: string;
  provider: BillingProvider;
  provider_customer_id: string | null;
  provider_invoice_id: string;
  provider_subscription_id: string | null;
  number: string | null;
  status: InvoiceStatus;
  total_cents: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingTransaction {
  id: string;
  workspace_id: string;
  provider: BillingProvider;
  provider_customer_id: string | null;
  provider_transaction_id: string;
  amount_cents: number;
  currency: string;
  status: TransactionStatus;
  description: string | null;
  payment_method: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillingWebhookEvent {
  id: string;
  workspace_id: string | null;
  provider: BillingProvider;
  provider_event_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface BillingDashboard {
  customers: BillingCustomer[];
  subscriptions: BillingSubscription[];
  invoices: BillingInvoice[];
  transactions: BillingTransaction[];
  metrics: {
    mrr_cents: number;
    arr_cents: number;
    active_subscriptions: number;
    total_customers: number;
    failed_payments: number;
    refunded_cents: number;
  };
}

// Paddle-specific API types

export interface PaddleCustomer {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'inactive' | 'deleted';
  custom_data?: Record<string, unknown>;
}

export interface PaddleSubscription {
  id: string;
  customer_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused';
  items: Array<{
    price: { id: string };
    quantity: number;
  }>;
  current_billing_period?: {
    starts_at: string;
    ends_at: string;
  };
  canceled_at?: string | null;
  trial?: { ends_at?: string } | null;
}

export interface PaddleTransaction {
  id: string;
  customer_id: string;
  status: 'draft' | 'ready' | 'billed' | 'paid' | 'completed' | 'canceled' | 'failed';
  total: string;
  currency_code: string;
  details?: {
    totals?: { total: string; subtotal: string; tax: string };
  };
  items?: Array<{
    price?: { id: string; name?: string };
    quantity?: number;
  }>;
  invoice_id?: string;
}

export interface PaddleCheckoutOptions {
  items: Array<{ price_id: string; quantity: number }>;
  customer_id?: string;
  customer?: { email: string; name?: string };
  success_url?: string;
  discount_id?: string;
  custom_data?: Record<string, unknown>;
}
