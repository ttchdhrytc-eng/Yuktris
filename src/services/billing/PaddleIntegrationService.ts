// ============================================================
// PaddleIntegrationService — Paddle API integration
// ============================================================
//
// Integrates with Paddle's Billing API (v2).
// All API calls go through edge functions to keep secrets server-side.
// The frontend talks to this service which proxies through edge functions.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BillingCustomer, BillingSubscription, BillingInvoice,
  BillingTransaction, BillingDashboard, BillingWebhookEvent,
  PaddleCheckoutOptions,
} from '@/types/billing';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export class PaddleIntegrationService {
  private client: SupabaseClient;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }

  // ── Customer Operations ────────────────────────────────────

  async createCustomer(params: { email: string; name?: string }): Promise<BillingCustomer | null> {
    const { data, error } = await this.client
      .from('billing_customers')
      .insert({
        workspace_id: this.workspaceId,
        provider: 'paddle',
        provider_customer_id: `pending_${Date.now()}`,
        email: params.email,
        name: params.name ?? null,
        status: 'active',
      })
      .select('*')
      .maybeSingle();
    if (error) { console.error('Create customer failed:', error.message); return null; }
    return data as BillingCustomer;
  }

  async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    const { data, error } = await this.client
      .from('billing_customers')
      .select('*')
      .eq('id', customerId)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();
    if (error || !data) return null;
    return data as BillingCustomer;
  }

  async getCustomerByProviderId(providerCustomerId: string): Promise<BillingCustomer | null> {
    const { data, error } = await this.client
      .from('billing_customers')
      .select('*')
      .eq('provider_customer_id', providerCustomerId)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();
    if (error || !data) return null;
    return data as BillingCustomer;
  }

  async updateCustomer(customerId: string, updates: { email?: string; name?: string; phone?: string }): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (updates.email) updateData.email = updates.email;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    await this.client.from('billing_customers').update(updateData).eq('id', customerId);
  }

  async listCustomers(): Promise<BillingCustomer[]> {
    const { data, error } = await this.client
      .from('billing_customers')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as BillingCustomer[];
  }

  // ── Subscription Operations ────────────────────────────────

  async listSubscriptions(): Promise<BillingSubscription[]> {
    const { data, error } = await this.client
      .from('billing_subscriptions')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as BillingSubscription[];
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscription | null> {
    const { data, error } = await this.client
      .from('billing_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();
    if (error || !data) return null;
    return data as BillingSubscription;
  }

  async cancelSubscription(subscriptionId: string, cancelImmediately = false): Promise<void> {
    const updates: Record<string, unknown> = {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    };
    if (cancelImmediately) {
      updates.current_period_end = new Date().toISOString();
    } else {
      updates.cancel_at_period_end = true;
    }
    await this.client.from('billing_subscriptions').update(updates).eq('id', subscriptionId);
  }

  async pauseSubscription(subscriptionId: string): Promise<void> {
    await this.client.from('billing_subscriptions').update({ status: 'paused' }).eq('id', subscriptionId);
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.client.from('billing_subscriptions').update({ status: 'active' }).eq('id', subscriptionId);
  }

  async updateSubscription(subscriptionId: string, updates: { plan_id?: string; price_id?: string; quantity?: number }): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (updates.plan_id) updateData.plan_id = updates.plan_id;
    if (updates.price_id) updateData.price_id = updates.price_id;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    await this.client.from('billing_subscriptions').update(updateData).eq('id', subscriptionId);
  }

  // ── Invoice Operations ──────────────────────────────────────

  async listInvoices(): Promise<BillingInvoice[]> {
    const { data, error } = await this.client
      .from('billing_invoices')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as BillingInvoice[];
  }

  // ── Transaction Operations ────────────────────────────────────

  async listTransactions(): Promise<BillingTransaction[]> {
    const { data, error } = await this.client
      .from('billing_transactions')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as BillingTransaction[];
  }

  // ── Checkout ────────────────────────────────────────────────

  async createCheckout(options: PaddleCheckoutOptions): Promise<{ checkout_url: string } | null> {
    try {
      const response = await fetch(`${FUNCTION_BASE}/paddle-webhook`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          action: 'create_checkout',
          workspace_id: this.workspaceId,
          ...options,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json() as Record<string, unknown>;
      return { checkout_url: data.checkout_url as string };
    } catch {
      return null;
    }
  }

  // ── Dashboard ────────────────────────────────────────────────

  async getDashboard(): Promise<BillingDashboard | null> {
    const [customers, subscriptions, invoices, transactions] = await Promise.all([
      this.listCustomers(),
      this.listSubscriptions(),
      this.listInvoices(),
      this.listTransactions(),
    ]);

    const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing');
    const mrr = activeSubs.reduce((sum, s) => sum + (s.metadata?.amount_cents as number ?? 0), 0);
    const failedPayments = transactions.filter(t => t.status === 'failed').length;
    const refunded = transactions.filter(t => t.status === 'refunded').reduce((sum, t) => sum + t.amount_cents, 0);

    return {
      customers,
      subscriptions,
      invoices,
      transactions,
      metrics: {
        mrr_cents: mrr,
        arr_cents: mrr * 12,
        active_subscriptions: activeSubs.length,
        total_customers: customers.length,
        failed_payments: failedPayments,
        refunded_cents: refunded,
      },
    };
  }

  // ── Webhook Events ──────────────────────────────────────────

  async listWebhookEvents(limit = 50): Promise<BillingWebhookEvent[]> {
    const { data, error } = await this.client
      .from('billing_webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as BillingWebhookEvent[];
  }

  // ── Sync (called by edge function) ──────────────────────────

  async syncCustomerFromProvider(providerCustomer: {
    id: string; email: string; name?: string; status?: string;
  }): Promise<BillingCustomer | null> {
    const existing = await this.getCustomerByProviderId(providerCustomer.id);
    if (existing) {
      await this.client.from('billing_customers').update({
        email: providerCustomer.email,
        name: providerCustomer.name ?? existing.name,
        status: providerCustomer.status ?? existing.status,
      }).eq('id', existing.id);
      return { ...existing, email: providerCustomer.email };
    }

    const { data, error } = await this.client
      .from('billing_customers')
      .insert({
        workspace_id: this.workspaceId,
        provider: 'paddle',
        provider_customer_id: providerCustomer.id,
        email: providerCustomer.email,
        name: providerCustomer.name ?? null,
        status: providerCustomer.status ?? 'active',
      })
      .select('*')
      .maybeSingle();
    if (error) return null;
    return data as BillingCustomer;
  }

  async syncSubscriptionFromProvider(providerSub: {
    id: string; customer_id: string; status: string; price_id?: string;
    current_period_start?: string; current_period_end?: string; canceled_at?: string | null;
  }): Promise<void> {
    const { data: existing } = await this.client
      .from('billing_subscriptions')
      .select('id')
      .eq('provider_subscription_id', providerSub.id)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();

    const subData = {
      provider: 'paddle' as const,
      provider_customer_id: providerSub.customer_id,
      provider_subscription_id: providerSub.id,
      status: providerSub.status,
      price_id: providerSub.price_id ?? null,
      current_period_start: providerSub.current_period_start ?? null,
      current_period_end: providerSub.current_period_end ?? null,
      canceled_at: providerSub.canceled_at ?? null,
    };

    if (existing) {
      await this.client.from('billing_subscriptions').update(subData).eq('id', (existing as Record<string, string>).id);
    } else {
      await this.client.from('billing_subscriptions').insert({
        workspace_id: this.workspaceId,
        ...subData,
      });
    }
  }

  async syncTransactionFromProvider(providerTx: {
    id: string; customer_id: string; status: string; total: string; currency: string; invoice_id?: string;
  }): Promise<void> {
    const { data: existing } = await this.client
      .from('billing_transactions')
      .select('id')
      .eq('provider_transaction_id', providerTx.id)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();

    const txData = {
      provider: 'paddle' as const,
      provider_customer_id: providerTx.customer_id,
      provider_transaction_id: providerTx.id,
      amount_cents: Math.round(parseFloat(providerTx.total) * 100),
      currency: providerTx.currency,
      status: providerTx.status,
    };

    if (existing) {
      await this.client.from('billing_transactions').update(txData).eq('id', (existing as Record<string, string>).id);
    } else {
      await this.client.from('billing_transactions').insert({
        workspace_id: this.workspaceId,
        ...txData,
      });
    }

    if (providerTx.invoice_id) {
      const { data: invExisting } = await this.client
        .from('billing_invoices')
        .select('id')
        .eq('provider_invoice_id', providerTx.invoice_id)
        .eq('workspace_id', this.workspaceId)
        .maybeSingle();

      if (!invExisting) {
        await this.client.from('billing_invoices').insert({
          workspace_id: this.workspaceId,
          provider: 'paddle',
          provider_customer_id: providerTx.customer_id,
          provider_invoice_id: providerTx.invoice_id,
          status: providerTx.status === 'completed' || providerTx.status === 'paid' ? 'paid' : 'open',
          total_cents: Math.round(parseFloat(providerTx.total) * 100),
          currency: providerTx.currency,
          paid_at: providerTx.status === 'completed' || providerTx.status === 'paid' ? new Date().toISOString() : null,
        });
      }
    }
  }
}

// Singleton instance per workspace
export const paddleService = (workspaceId: string) => new PaddleIntegrationService(workspaceId);
