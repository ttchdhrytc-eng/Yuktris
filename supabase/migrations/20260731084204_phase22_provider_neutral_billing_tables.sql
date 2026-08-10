/*
# Phase 22 — Provider-neutral billing tables (Paddle migration)

## Purpose
Replaces the Stripe-specific billing tables with provider-neutral tables
that work with Paddle (or any payment provider). The `provider` column
identifies which payment provider each record belongs to.

## New Tables
1. billing_customers — Maps to Paddle customers (replaces stripe_customers)
2. billing_subscriptions — Maps to Paddle subscriptions (replaces stripe_subscriptions)
3. billing_invoices — Maps to Paddle invoices (replaces stripe_invoices)
4. billing_transactions — Maps to Paddle transactions/payments (replaces stripe_payment_intents)
5. billing_webhook_events — Idempotent webhook event log (replaces stripe_webhook_events)

## Security
- RLS enabled on all tables, scoped to authenticated users via workspace membership.
- All tables use `provider` column (default 'paddle') and `provider_*` ID columns.
*/

-- ── 1. billing_customers ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paddle',
  provider_customer_id text NOT NULL,
  email text NOT NULL,
  name text,
  phone text,
  default_payment_method text,
  currency text DEFAULT 'USD',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_customer_id)
);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_billing_customers" ON billing_customers;
CREATE POLICY "select_own_billing_customers" ON billing_customers FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_billing_customers" ON billing_customers;
CREATE POLICY "insert_own_billing_customers" ON billing_customers FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_billing_customers" ON billing_customers;
CREATE POLICY "update_own_billing_customers" ON billing_customers FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_billing_customers" ON billing_customers;
CREATE POLICY "delete_own_billing_customers" ON billing_customers FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 2. billing_subscriptions ────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paddle',
  provider_customer_id text,
  provider_subscription_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  plan_id text,
  price_id text,
  quantity int NOT NULL DEFAULT 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_billing_subscriptions" ON billing_subscriptions;
CREATE POLICY "select_own_billing_subscriptions" ON billing_subscriptions FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_billing_subscriptions" ON billing_subscriptions;
CREATE POLICY "insert_own_billing_subscriptions" ON billing_subscriptions FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_billing_subscriptions" ON billing_subscriptions;
CREATE POLICY "update_own_billing_subscriptions" ON billing_subscriptions FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_billing_subscriptions" ON billing_subscriptions;
CREATE POLICY "delete_own_billing_subscriptions" ON billing_subscriptions FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 3. billing_invoices ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paddle',
  provider_customer_id text,
  provider_invoice_id text NOT NULL,
  provider_subscription_id text,
  number text,
  status text NOT NULL DEFAULT 'draft',
  total_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date timestamptz,
  paid_at timestamptz,
  invoice_pdf text,
  hosted_invoice_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_invoice_id)
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_billing_invoices" ON billing_invoices;
CREATE POLICY "select_own_billing_invoices" ON billing_invoices FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_billing_invoices" ON billing_invoices;
CREATE POLICY "insert_own_billing_invoices" ON billing_invoices FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_billing_invoices" ON billing_invoices;
CREATE POLICY "update_own_billing_invoices" ON billing_invoices FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_billing_invoices" ON billing_invoices;
CREATE POLICY "delete_own_billing_invoices" ON billing_invoices FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 4. billing_transactions ──────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paddle',
  provider_customer_id text,
  provider_transaction_id text NOT NULL,
  amount_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  description text,
  payment_method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);

ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_billing_transactions" ON billing_transactions;
CREATE POLICY "select_own_billing_transactions" ON billing_transactions FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_billing_transactions" ON billing_transactions;
CREATE POLICY "insert_own_billing_transactions" ON billing_transactions FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_billing_transactions" ON billing_transactions;
CREATE POLICY "update_own_billing_transactions" ON billing_transactions FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_billing_transactions" ON billing_transactions;
CREATE POLICY "delete_own_billing_transactions" ON billing_transactions FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 5. billing_webhook_events ────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  provider text NOT NULL DEFAULT 'paddle',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_billing_webhook_events" ON billing_webhook_events;
CREATE POLICY "select_own_billing_webhook_events" ON billing_webhook_events FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_billing_webhook_events" ON billing_webhook_events;
CREATE POLICY "insert_own_billing_webhook_events" ON billing_webhook_events FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_billing_webhook_events" ON billing_webhook_events;
CREATE POLICY "update_own_billing_webhook_events" ON billing_webhook_events FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_billing_customers_workspace ON billing_customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_workspace ON billing_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_workspace ON billing_invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_workspace ON billing_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider ON billing_webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_type ON billing_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed ON billing_webhook_events(processed);

-- ── Triggers ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_billing_customers_updated_at ON billing_customers;
CREATE TRIGGER trg_billing_customers_updated_at BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated_at ON billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated_at BEFORE UPDATE ON billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_billing_invoices_updated_at ON billing_invoices;
CREATE TRIGGER trg_billing_invoices_updated_at BEFORE UPDATE ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_billing_transactions_updated_at ON billing_transactions;
CREATE TRIGGER trg_billing_transactions_updated_at BEFORE UPDATE ON billing_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
