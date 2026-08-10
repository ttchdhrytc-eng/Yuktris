// ============================================================
// useBilling — React Query hooks for billing (Paddle)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type {
  BillingCustomer, BillingSubscription, BillingInvoice,
  BillingTransaction, BillingWebhookEvent,
} from '@/types/billing';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ── Customers ────────────────────────────────────────────────

export function useBillingCustomers() {
  const { workspace } = useWorkspace();
  return useQuery<BillingCustomer[]>({
    queryKey: ['billing-customers', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('billing_customers')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingCustomer[];
    },
    enabled: !!workspace,
  });
}

export function useCreateBillingCustomer() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { email: string; name?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase
        .from('billing_customers')
        .insert({
          workspace_id: workspace.id,
          provider: 'paddle',
          provider_customer_id: `pending_${Date.now()}`,
          email: params.email,
          name: params.name ?? null,
          status: 'active',
        })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-customers'] }),
  });
}

// ── Subscriptions ──────────────────────────────────────────────

export function useBillingSubscriptions() {
  const { workspace } = useWorkspace();
  return useQuery<BillingSubscription[]>({
    queryKey: ['billing-subscriptions', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingSubscription[];
    },
    enabled: !!workspace,
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { subscriptionId: string; immediately?: boolean }) => {
      const updates: Record<string, unknown> = {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      };
      if (params.immediately) {
        updates.current_period_end = new Date().toISOString();
      } else {
        updates.cancel_at_period_end = true;
      }
      const { error } = await supabase
        .from('billing_subscriptions')
        .update(updates)
        .eq('id', params.subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
  });
}

export function usePauseSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('billing_subscriptions')
        .update({ status: 'paused' })
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('billing_subscriptions')
        .update({ status: 'active' })
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] }),
  });
}

// ── Invoices ──────────────────────────────────────────────────

export function useBillingInvoices() {
  const { workspace } = useWorkspace();
  return useQuery<BillingInvoice[]>({
    queryKey: ['billing-invoices', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingInvoice[];
    },
    enabled: !!workspace,
  });
}

// ── Transactions ──────────────────────────────────────────────

export function useBillingTransactions() {
  const { workspace } = useWorkspace();
  return useQuery<BillingTransaction[]>({
    queryKey: ['billing-transactions', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('billing_transactions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingTransaction[];
    },
    enabled: !!workspace,
  });
}

// ── Webhook Events ────────────────────────────────────────────

export function useBillingWebhookEvents(limit = 50) {
  const { workspace } = useWorkspace();
  return useQuery<BillingWebhookEvent[]>({
    queryKey: ['billing-webhook-events', workspace?.id, limit],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('billing_webhook_events')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BillingWebhookEvent[];
    },
    enabled: !!workspace,
  });
}

// ── Checkout ────────────────────────────────────────────────

export function useCreateCheckout() {
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (params: { items: Array<{ price_id: string; quantity: number }>; customerEmail?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const response = await fetch(`${FUNCTION_BASE}/paddle-webhook`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          action: 'create_checkout',
          workspace_id: workspace.id,
          items: params.items,
          customer: params.customerEmail ? { email: params.customerEmail } : undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Checkout failed' }));
        throw new Error((err as Record<string, string>).error ?? `Failed (${response.status})`);
      }
      return response.json();
    },
  });
}

// ── Dashboard ────────────────────────────────────────────────

export function useBillingDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['billing-dashboard', workspace?.id],
    queryFn: async () => {
      if (!workspace) return null;
      const [customers, subscriptions, invoices, transactions] = await Promise.all([
        supabase.from('billing_customers').select('*').eq('workspace_id', workspace.id),
        supabase.from('billing_subscriptions').select('*').eq('workspace_id', workspace.id),
        supabase.from('billing_invoices').select('*').eq('workspace_id', workspace.id),
        supabase.from('billing_transactions').select('*').eq('workspace_id', workspace.id),
      ]);

      const subs = (subscriptions.data ?? []) as BillingSubscription[];
      const txns = (transactions.data ?? []) as BillingTransaction[];
      const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
      const mrr = activeSubs.reduce((sum, s) => sum + ((s.metadata as Record<string, number>)?.amount_cents ?? 0), 0);

      return {
        customers: (customers.data ?? []) as BillingCustomer[],
        subscriptions: subs,
        invoices: (invoices.data ?? []) as BillingInvoice[],
        transactions: txns,
        metrics: {
          mrr_cents: mrr,
          arr_cents: mrr * 12,
          active_subscriptions: activeSubs.length,
          total_customers: (customers.data ?? []).length,
          failed_payments: txns.filter(t => t.status === 'failed').length,
          refunded_cents: txns.filter(t => t.status === 'refunded').reduce((sum, t) => sum + t.amount_cents, 0),
        },
      };
    },
    enabled: !!workspace,
  });
}
