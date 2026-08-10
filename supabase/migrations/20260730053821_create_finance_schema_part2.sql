/*
# Phase 14 Part 2 — Subscriptions, Invoices, Payments, Revenue Recognition, Receivables, Taxes, Finance Intelligence
*/

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES pricing_plans(id) ON DELETE SET NULL,
  subscription_name text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','canceled','paused','expired','pending')),
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','annual','custom')),
  current_period_start date NOT NULL DEFAULT CURRENT_DATE,
  current_period_end date,
  canceled_at timestamptz,
  cancellation_reason text,
  quantity integer DEFAULT 1,
  mrr numeric(14,2) DEFAULT 0,
  arr numeric(14,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
  auto_renew boolean DEFAULT true,
  trial_end date,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_billing ON subscriptions(billing_account_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_account_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscriptions" ON subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscriptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscriptions" ON subscriptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscriptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscriptions" ON subscriptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscriptions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscriptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscriptions" ON subscriptions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscriptions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION ITEMS
-- ============================================================
CREATE TABLE subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_description text,
  quantity integer DEFAULT 1,
  unit_price numeric(14,2) DEFAULT 0,
  billing_type text DEFAULT 'recurring' CHECK (billing_type IN ('recurring','one_time','usage')),
  usage_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_items_workspace ON subscription_items(workspace_id);
CREATE INDEX idx_subscription_items_sub ON subscription_items(subscription_id);
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_items" ON subscription_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_items" ON subscription_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_items" ON subscription_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_items.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_items" ON subscription_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_items.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION CHANGES
-- ============================================================
CREATE TABLE subscription_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('upgrade','downgrade','add_seat','remove_seat','plan_change','cancel','reactivate','pause','resume','price_change')),
  previous_value jsonb,
  new_value jsonb,
  change_reason text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  mrr_delta numeric(14,2) DEFAULT 0,
  arr_delta numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_changes_workspace ON subscription_changes(workspace_id);
CREATE INDEX idx_subscription_changes_sub ON subscription_changes(subscription_id);
ALTER TABLE subscription_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_changes" ON subscription_changes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_changes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_changes" ON subscription_changes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_changes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_changes" ON subscription_changes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_changes.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_changes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_changes" ON subscription_changes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_changes.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION HISTORY
-- ============================================================
CREATE TABLE subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_description text,
  event_data jsonb DEFAULT '{}'::jsonb,
  previous_status text,
  new_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_history_workspace ON subscription_history(workspace_id);
CREATE INDEX idx_subscription_history_sub ON subscription_history(subscription_id);
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_history" ON subscription_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_history" ON subscription_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_history" ON subscription_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_history" ON subscription_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION USAGE
-- ============================================================
CREATE TABLE subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  usage_metric text NOT NULL,
  usage_value numeric(14,2) DEFAULT 0,
  usage_unit text,
  overage_amount numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_usage_workspace ON subscription_usage(workspace_id);
CREATE INDEX idx_subscription_usage_sub ON subscription_usage(subscription_id);
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_usage" ON subscription_usage FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_usage" ON subscription_usage FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_usage" ON subscription_usage FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_usage.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_usage" ON subscription_usage FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_usage.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION LIMITS
-- ============================================================
CREATE TABLE subscription_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  limit_type text NOT NULL,
  limit_value integer DEFAULT 0,
  current_usage integer DEFAULT 0,
  is_soft_limit boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_limits_workspace ON subscription_limits(workspace_id);
CREATE INDEX idx_subscription_limits_sub ON subscription_limits(subscription_id);
ALTER TABLE subscription_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_limits" ON subscription_limits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_limits" ON subscription_limits FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_limits" ON subscription_limits FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_limits.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_limits" ON subscription_limits FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_limits.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTION TRIALS
-- ============================================================
CREATE TABLE subscription_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  trial_start date NOT NULL DEFAULT CURRENT_DATE,
  trial_end date NOT NULL,
  trial_days integer DEFAULT 14,
  converted_to_paid boolean DEFAULT false,
  converted_at timestamptz,
  trial_feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_trials_workspace ON subscription_trials(workspace_id);
CREATE INDEX idx_subscription_trials_sub ON subscription_trials(subscription_id);
ALTER TABLE subscription_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_subscription_trials" ON subscription_trials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_trials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_subscription_trials" ON subscription_trials FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_trials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_subscription_trials" ON subscription_trials FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_trials.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_trials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_subscription_trials" ON subscription_trials FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = subscription_trials.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  period_start date,
  period_end date,
  subtotal numeric(14,2) DEFAULT 0,
  discount_total numeric(14,2) DEFAULT 0,
  tax_total numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  amount_paid numeric(14,2) DEFAULT 0,
  amount_due numeric(14,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial','overdue','void','uncollectible')),
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX idx_invoices_billing ON invoices(billing_account_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoices" ON invoices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoices.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoices.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoices" ON invoices FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoices.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoices.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoices" ON invoices FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoices.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_item_id uuid REFERENCES subscription_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric(14,2) DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  line_total numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_items_workspace ON invoice_items(workspace_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoice_items" ON invoice_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoice_items" ON invoice_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoice_items" ON invoice_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_items.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoice_items" ON invoice_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_items.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICE TEMPLATES
-- ============================================================
CREATE TABLE invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text DEFAULT 'standard' CHECK (template_type IN ('standard','detailed','simple','custom')),
  template_content text,
  template_html text,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_templates_workspace ON invoice_templates(workspace_id);
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoice_templates" ON invoice_templates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoice_templates" ON invoice_templates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoice_templates" ON invoice_templates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_templates.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoice_templates" ON invoice_templates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_templates.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PAYMENT METHODS
-- ============================================================
CREATE TABLE payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  payment_type text DEFAULT 'card' CHECK (payment_type IN ('card','ach','wire','paypal','check','other')),
  last_four text,
  brand text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  billing_address_id uuid REFERENCES billing_addresses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_methods_workspace ON payment_methods(workspace_id);
CREATE INDEX idx_payment_methods_account ON payment_methods(billing_account_id);
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_payment_methods" ON payment_methods FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_methods.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_payment_methods" ON payment_methods FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_methods.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_payment_methods" ON payment_methods FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_methods.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_methods.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_payment_methods" ON payment_methods FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_methods.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PAYMENT TRANSACTIONS
-- ============================================================
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  transaction_id text,
  amount numeric(14,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded','partially_refunded','disputed')),
  transaction_type text DEFAULT 'charge' CHECK (transaction_type IN ('charge','refund','dispute','adjustment')),
  processed_at timestamptz,
  failure_reason text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_transactions_workspace ON payment_transactions(workspace_id);
CREATE INDEX idx_payment_transactions_billing ON payment_transactions(billing_account_id);
CREATE INDEX idx_payment_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_payment_transactions" ON payment_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_transactions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_payment_transactions" ON payment_transactions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_transactions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_payment_transactions" ON payment_transactions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_transactions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_transactions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_payment_transactions" ON payment_transactions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_transactions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICE PAYMENTS
-- ============================================================
CREATE TABLE invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  amount numeric(14,2) DEFAULT 0,
  payment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_payments_workspace ON invoice_payments(workspace_id);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoice_payments" ON invoice_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_payments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoice_payments" ON invoice_payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_payments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoice_payments" ON invoice_payments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_payments.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_payments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoice_payments" ON invoice_payments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_payments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICE HISTORY
-- ============================================================
CREATE TABLE invoice_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_description text,
  previous_status text,
  new_status text,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_history_workspace ON invoice_history(workspace_id);
CREATE INDEX idx_invoice_history_invoice ON invoice_history(invoice_id);
ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoice_history" ON invoice_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoice_history" ON invoice_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoice_history" ON invoice_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoice_history" ON invoice_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVOICE ADJUSTMENTS
-- ============================================================
CREATE TABLE invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('credit','debit','refund','write_off','correction','tax_adjustment')),
  adjustment_amount numeric(14,2) DEFAULT 0,
  adjustment_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_adjustments_workspace ON invoice_adjustments(workspace_id);
CREATE INDEX idx_invoice_adjustments_invoice ON invoice_adjustments(invoice_id);
ALTER TABLE invoice_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_invoice_adjustments" ON invoice_adjustments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_invoice_adjustments" ON invoice_adjustments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_invoice_adjustments" ON invoice_adjustments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_adjustments.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_invoice_adjustments" ON invoice_adjustments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = invoice_adjustments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PAYMENT FAILURES
-- ============================================================
CREATE TABLE payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  failure_code text,
  failure_message text,
  failure_type text CHECK (failure_type IN ('insufficient_funds','expired_card','invalid_card','declined','network_error','fraud','other')),
  retry_scheduled_at timestamptz,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_failures_workspace ON payment_failures(workspace_id);
CREATE INDEX idx_payment_failures_txn ON payment_failures(payment_transaction_id);
CREATE INDEX idx_payment_failures_unresolved ON payment_failures(is_resolved) WHERE is_resolved = false;
ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_payment_failures" ON payment_failures FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_payment_failures" ON payment_failures FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_payment_failures" ON payment_failures FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_failures.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_payment_failures" ON payment_failures FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_failures.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PAYMENT REFUNDS
-- ============================================================
CREATE TABLE payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  refund_amount numeric(14,2) DEFAULT 0,
  refund_reason text,
  refund_type text DEFAULT 'full' CHECK (refund_type IN ('full','partial')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_refunds_workspace ON payment_refunds(workspace_id);
CREATE INDEX idx_payment_refunds_txn ON payment_refunds(payment_transaction_id);
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_payment_refunds" ON payment_refunds FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_refunds.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_payment_refunds" ON payment_refunds FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_refunds.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_payment_refunds" ON payment_refunds FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_refunds.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_refunds.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_payment_refunds" ON payment_refunds FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_refunds.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PAYMENT RETRIES
-- ============================================================
CREATE TABLE payment_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  retry_attempt integer DEFAULT 1,
  retry_date timestamptz NOT NULL DEFAULT now(),
  retry_status text DEFAULT 'scheduled' CHECK (retry_status IN ('scheduled','succeeded','failed','cancelled')),
  retry_result text,
  next_retry_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_retries_workspace ON payment_retries(workspace_id);
CREATE INDEX idx_payment_retries_txn ON payment_retries(payment_transaction_id);
ALTER TABLE payment_retries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_payment_retries" ON payment_retries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_payment_retries" ON payment_retries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_payment_retries" ON payment_retries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_retries.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_payment_retries" ON payment_retries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = payment_retries.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RECOGNIZED REVENUE
-- ============================================================
CREATE TABLE recognized_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  recognition_date date NOT NULL DEFAULT CURRENT_DATE,
  recognition_period text NOT NULL,
  recognized_amount numeric(14,2) DEFAULT 0,
  revenue_type text DEFAULT 'subscription' CHECK (revenue_type IN ('subscription','one_time','usage','professional_services','overage')),
  recognition_method text DEFAULT 'monthly' CHECK (recognition_method IN ('monthly','daily','milestone','point_of_sale')),
  is_reversed boolean DEFAULT false,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recognized_revenue_workspace ON recognized_revenue(workspace_id);
CREATE INDEX idx_recognized_revenue_billing ON recognized_revenue(billing_account_id);
CREATE INDEX idx_recognized_revenue_date ON recognized_revenue(recognition_date DESC);
CREATE INDEX idx_recognized_revenue_period ON recognized_revenue(recognition_period);
ALTER TABLE recognized_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_recognized_revenue" ON recognized_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recognized_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_recognized_revenue" ON recognized_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recognized_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_recognized_revenue" ON recognized_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recognized_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recognized_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_recognized_revenue" ON recognized_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recognized_revenue.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- DEFERRED REVENUE
-- ============================================================
CREATE TABLE deferred_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  deferral_date date NOT NULL DEFAULT CURRENT_DATE,
  total_deferred_amount numeric(14,2) DEFAULT 0,
  recognized_amount numeric(14,2) DEFAULT 0,
  remaining_amount numeric(14,2) DEFAULT 0,
  recognition_start_date date,
  recognition_end_date date,
  recognition_schedule jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deferred_revenue_workspace ON deferred_revenue(workspace_id);
CREATE INDEX idx_deferred_revenue_billing ON deferred_revenue(billing_account_id);
ALTER TABLE deferred_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_deferred_revenue" ON deferred_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = deferred_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_deferred_revenue" ON deferred_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = deferred_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_deferred_revenue" ON deferred_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = deferred_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = deferred_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_deferred_revenue" ON deferred_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = deferred_revenue.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE SCHEDULE
-- ============================================================
CREATE TABLE revenue_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deferred_revenue_id uuid REFERENCES deferred_revenue(id) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  scheduled_amount numeric(14,2) DEFAULT 0,
  recognized_amount numeric(14,2) DEFAULT 0,
  is_recognized boolean DEFAULT false,
  recognized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_schedule_workspace ON revenue_schedule(workspace_id);
CREATE INDEX idx_revenue_schedule_deferred ON revenue_schedule(deferred_revenue_id);
CREATE INDEX idx_revenue_schedule_date ON revenue_schedule(schedule_date);
ALTER TABLE revenue_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_schedule" ON revenue_schedule FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_schedule.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_schedule" ON revenue_schedule FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_schedule.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_schedule" ON revenue_schedule FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_schedule.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_schedule.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_schedule" ON revenue_schedule FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_schedule.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE ADJUSTMENTS
-- ============================================================
CREATE TABLE revenue_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recognized_revenue_id uuid REFERENCES recognized_revenue(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('correction','reversal','reallocation','refund','write_off','true_up')),
  adjustment_amount numeric(14,2) DEFAULT 0,
  adjustment_reason text,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_adjustments_workspace ON revenue_adjustments(workspace_id);
ALTER TABLE revenue_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_adjustments" ON revenue_adjustments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_adjustments" ON revenue_adjustments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_adjustments" ON revenue_adjustments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_adjustments.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_adjustments" ON revenue_adjustments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_adjustments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE ALLOCATIONS
-- ============================================================
CREATE TABLE revenue_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  allocation_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(14,2) DEFAULT 0,
  allocations jsonb DEFAULT '[]'::jsonb,
  allocation_method text DEFAULT 'standalone' CHECK (allocation_method IN ('standalone','residual','relative','custom')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_allocations_workspace ON revenue_allocations(workspace_id);
ALTER TABLE revenue_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_allocations" ON revenue_allocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_allocations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_allocations" ON revenue_allocations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_allocations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_allocations" ON revenue_allocations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_allocations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_allocations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_allocations" ON revenue_allocations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_allocations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ACCOUNTS RECEIVABLE
-- ============================================================
CREATE TABLE accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  amount_due numeric(14,2) DEFAULT 0,
  days_overdue integer DEFAULT 0,
  aging_bucket text DEFAULT 'current' CHECK (aging_bucket IN ('current','1_30','31_60','61_90','90_plus')),
  is_overdue boolean DEFAULT false,
  last_payment_attempt timestamptz,
  collection_status text DEFAULT 'none' CHECK (collection_status IN ('none','contacted','promised','disputed','escalated','legal','written_off')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_receivable_workspace ON accounts_receivable(workspace_id);
CREATE INDEX idx_accounts_receivable_billing ON accounts_receivable(billing_account_id);
CREATE INDEX idx_accounts_receivable_overdue ON accounts_receivable(is_overdue) WHERE is_overdue = true;
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_accounts_receivable" ON accounts_receivable FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = accounts_receivable.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_accounts_receivable" ON accounts_receivable FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = accounts_receivable.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_accounts_receivable" ON accounts_receivable FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = accounts_receivable.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = accounts_receivable.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_accounts_receivable" ON accounts_receivable FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = accounts_receivable.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COLLECTIONS
-- ============================================================
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  accounts_receivable_id uuid NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  collection_type text DEFAULT 'email' CHECK (collection_type IN ('email','call','letter','sms','escalation','legal')),
  collection_date timestamptz NOT NULL DEFAULT now(),
  collection_message text,
  collection_result text DEFAULT 'pending' CHECK (collection_result IN ('pending','contacted','promised','paid','disputed','no_response','escalated')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collections_workspace ON collections(workspace_id);
CREATE INDEX idx_collections_ar ON collections(accounts_receivable_id);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_collections" ON collections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_collections" ON collections FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_collections" ON collections FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collections.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_collections" ON collections FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collections.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COLLECTION ATTEMPTS
-- ============================================================
CREATE TABLE collection_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  attempt_number integer DEFAULT 1,
  attempt_date timestamptz NOT NULL DEFAULT now(),
  attempt_method text,
  attempt_result text,
  contact_person text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_attempts_workspace ON collection_attempts(workspace_id);
CREATE INDEX idx_collection_attempts_collection ON collection_attempts(collection_id);
ALTER TABLE collection_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_collection_attempts" ON collection_attempts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collection_attempts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_collection_attempts" ON collection_attempts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collection_attempts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_collection_attempts" ON collection_attempts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collection_attempts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collection_attempts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_collection_attempts" ON collection_attempts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = collection_attempts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- OVERDUE ACCOUNTS
-- ============================================================
CREATE TABLE overdue_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  total_overdue numeric(14,2) DEFAULT 0,
  days_overdue integer DEFAULT 0,
  overdue_invoice_count integer DEFAULT 0,
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  last_contact_date timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_overdue_accounts_workspace ON overdue_accounts(workspace_id);
CREATE INDEX idx_overdue_accounts_billing ON overdue_accounts(billing_account_id);
ALTER TABLE overdue_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_overdue_accounts" ON overdue_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = overdue_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_overdue_accounts" ON overdue_accounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = overdue_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_overdue_accounts" ON overdue_accounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = overdue_accounts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = overdue_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_overdue_accounts" ON overdue_accounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = overdue_accounts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TAX PROFILES
-- ============================================================
CREATE TABLE tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE CASCADE,
  tax_id_number text,
  tax_jurisdiction text DEFAULT 'US',
  tax_exempt boolean DEFAULT false,
  tax_exemption_certificate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_profiles_workspace ON tax_profiles(workspace_id);
CREATE INDEX idx_tax_profiles_account ON tax_profiles(billing_account_id);
ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tax_profiles" ON tax_profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_tax_profiles" ON tax_profiles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_tax_profiles" ON tax_profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_profiles.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_tax_profiles" ON tax_profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_profiles.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TAX RATES
-- ============================================================
CREATE TABLE tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  jurisdiction_type text DEFAULT 'state' CHECK (jurisdiction_type IN ('federal','state','county','city','country','vat','gst')),
  tax_rate numeric(5,4) DEFAULT 0,
  tax_name text,
  is_active boolean DEFAULT true,
  effective_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_rates_workspace ON tax_rates(workspace_id);
CREATE INDEX idx_tax_rates_jurisdiction ON tax_rates(jurisdiction);
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tax_rates" ON tax_rates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_rates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_tax_rates" ON tax_rates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_rates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_tax_rates" ON tax_rates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_rates.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_rates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_tax_rates" ON tax_rates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_rates.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TAX CALCULATIONS
-- ============================================================
CREATE TABLE tax_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  tax_rate_id uuid REFERENCES tax_rates(id) ON DELETE SET NULL,
  taxable_amount numeric(14,2) DEFAULT 0,
  tax_amount numeric(14,2) DEFAULT 0,
  jurisdiction text,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_calculations_workspace ON tax_calculations(workspace_id);
CREATE INDEX idx_tax_calculations_invoice ON tax_calculations(invoice_id);
ALTER TABLE tax_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tax_calculations" ON tax_calculations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_calculations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_tax_calculations" ON tax_calculations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_calculations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_tax_calculations" ON tax_calculations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_calculations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_calculations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_tax_calculations" ON tax_calculations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_calculations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TAX REPORTS
-- ============================================================
CREATE TABLE tax_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  report_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_taxable_revenue numeric(14,2) DEFAULT 0,
  total_tax_collected numeric(14,2) DEFAULT 0,
  jurisdiction_breakdown jsonb DEFAULT '{}'::jsonb,
  report_status text DEFAULT 'generated' CHECK (report_status IN ('generated','filed','paid','amended')),
  filing_deadline date,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_reports_workspace ON tax_reports(workspace_id);
ALTER TABLE tax_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tax_reports" ON tax_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_tax_reports" ON tax_reports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_tax_reports" ON tax_reports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_reports.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_tax_reports" ON tax_reports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = tax_reports.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROFITABILITY
-- ============================================================
CREATE TABLE profitability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue numeric(14,2) DEFAULT 0,
  cogs numeric(14,2) DEFAULT 0,
  gross_profit numeric(14,2) DEFAULT 0,
  gross_margin numeric(5,2) DEFAULT 0,
  operating_expenses numeric(14,2) DEFAULT 0,
  operating_profit numeric(14,2) DEFAULT 0,
  net_profit numeric(14,2) DEFAULT 0,
  net_margin numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profitability_workspace ON profitability(workspace_id);
CREATE INDEX idx_profitability_period ON profitability(period);
ALTER TABLE profitability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_profitability" ON profitability FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = profitability.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_profitability" ON profitability FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = profitability.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_profitability" ON profitability FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = profitability.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = profitability.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_profitability" ON profitability FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = profitability.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- GROSS MARGIN
-- ============================================================
CREATE TABLE gross_margin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue numeric(14,2) DEFAULT 0,
  direct_costs numeric(14,2) DEFAULT 0,
  gross_margin_amount numeric(14,2) DEFAULT 0,
  gross_margin_percent numeric(5,2) DEFAULT 0,
  cost_breakdown jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gross_margin_workspace ON gross_margin(workspace_id);
CREATE INDEX idx_gross_margin_period ON gross_margin(period);
ALTER TABLE gross_margin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_gross_margin" ON gross_margin FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = gross_margin.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_gross_margin" ON gross_margin FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = gross_margin.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_gross_margin" ON gross_margin FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = gross_margin.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = gross_margin.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_gross_margin" ON gross_margin FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = gross_margin.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER LTV
-- ============================================================
CREATE TABLE customer_ltv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  billing_account_id uuid REFERENCES billing_accounts(id) ON DELETE SET NULL,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  total_revenue numeric(14,2) DEFAULT 0,
  avg_contract_value numeric(14,2) DEFAULT 0,
  avg_revenue_per_month numeric(14,2) DEFAULT 0,
  retention_rate numeric(5,2) DEFAULT 0,
  expansion_rate numeric(5,2) DEFAULT 0,
  churn_rate numeric(5,2) DEFAULT 0,
  estimated_lifespan_months integer DEFAULT 12,
  calculated_ltv numeric(14,2) DEFAULT 0,
  ai_predicted_ltv numeric(14,2) DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_ltv_workspace ON customer_ltv(workspace_id);
CREATE INDEX idx_customer_ltv_customer ON customer_ltv(customer_account_id);
ALTER TABLE customer_ltv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_ltv" ON customer_ltv FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_ltv.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_ltv" ON customer_ltv FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_ltv.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_ltv" ON customer_ltv FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_ltv.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_ltv.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_ltv" ON customer_ltv FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_ltv.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER CAC
-- ============================================================
CREATE TABLE customer_cac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  marketing_spend numeric(14,2) DEFAULT 0,
  sales_spend numeric(14,2) DEFAULT 0,
  total_acquisition_cost numeric(14,2) DEFAULT 0,
  customers_acquired integer DEFAULT 1,
  cac_per_customer numeric(14,2) DEFAULT 0,
  ltv_cac_ratio numeric(5,2) DEFAULT 0,
  roi numeric(5,2) DEFAULT 0,
  payback_period_months integer DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_cac_workspace ON customer_cac(workspace_id);
CREATE INDEX idx_customer_cac_customer ON customer_cac(customer_account_id);
ALTER TABLE customer_cac ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_cac" ON customer_cac FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_cac.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_cac" ON customer_cac FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_cac.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_cac" ON customer_cac FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_cac.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_cac.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_cac" ON customer_cac FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_cac.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FINANCE INSIGHTS
-- ============================================================
CREATE TABLE finance_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN ('revenue_trend','cash_flow','collection_risk','subscription_risk','profitability','ltv','cac','margin','recommendation','alert','forecast')),
  insight_title text NOT NULL,
  insight_text text,
  insight_data jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  confidence numeric DEFAULT 0.7,
  is_actioned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_insights_workspace ON finance_insights(workspace_id);
CREATE INDEX idx_finance_insights_type ON finance_insights(insight_type);
ALTER TABLE finance_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_finance_insights" ON finance_insights FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_finance_insights" ON finance_insights FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_finance_insights" ON finance_insights FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_insights.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_finance_insights" ON finance_insights FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_insights.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FINANCE ALERTS
-- ============================================================
CREATE TABLE finance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('large_unpaid_invoice','failed_payment','subscription_cancellation','revenue_decline','cashflow_issue','margin_decline','collection_risk','tax_deadline','overdue_account','dunning_failure')),
  alert_title text NOT NULL,
  alert_description text,
  alert_severity text DEFAULT 'medium' CHECK (alert_severity IN ('low','medium','high','critical')),
  related_entity_id uuid,
  related_entity_type text,
  amount_impacted numeric(14,2) DEFAULT 0,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  recommended_action text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_alerts_workspace ON finance_alerts(workspace_id);
CREATE INDEX idx_finance_alerts_unresolved ON finance_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_finance_alerts_severity ON finance_alerts(alert_severity);
ALTER TABLE finance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_finance_alerts" ON finance_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_finance_alerts" ON finance_alerts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_finance_alerts" ON finance_alerts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_alerts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_finance_alerts" ON finance_alerts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = finance_alerts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_fin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pricing_plans','pricing_versions','pricing_rules','pricing_discounts','coupons','promotional_campaigns',
    'billing_accounts','billing_profiles','billing_contacts','billing_addresses','billing_preferences',
    'subscriptions','subscription_items','subscription_limits','subscription_trials',
    'invoices','invoice_items','invoice_templates',
    'payment_methods','payment_transactions',
    'deferred_revenue',
    'accounts_receivable','collections','overdue_accounts',
    'tax_profiles','tax_rates',
    'customer_ltv','customer_cac','finance_insights','finance_alerts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_fin_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_fin_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_fin_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DEFAULT TAX RATES & INVOICE TEMPLATE
-- ============================================================
INSERT INTO tax_rates (workspace_id, jurisdiction, jurisdiction_type, tax_rate, tax_name)
SELECT w.id, 'US', 'federal', 0, 'US Federal'
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM tax_rates tr WHERE tr.workspace_id = w.id AND tr.jurisdiction = 'US');

INSERT INTO invoice_templates (workspace_id, template_name, template_type, is_default)
SELECT w.id, 'Standard Invoice', 'standard', true
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM invoice_templates it WHERE it.workspace_id = w.id AND it.is_default = true);
