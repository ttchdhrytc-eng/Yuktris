/*
# Phase 14 Part 1 — Finance Intelligence: Plans, Coupons, Billing (before subscriptions)
*/

-- ============================================================
-- PRICING PLANS
-- ============================================================
CREATE TABLE pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  plan_code text,
  plan_tier text DEFAULT 'standard' CHECK (plan_tier IN ('free','starter','standard','professional','enterprise','custom')),
  description text,
  base_price numeric(14,2) DEFAULT 0,
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','annual','custom')),
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  features jsonb DEFAULT '[]'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_plans_workspace ON pricing_plans(workspace_id);
CREATE INDEX idx_pricing_plans_active ON pricing_plans(is_active) WHERE is_active = true;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pricing_plans" ON pricing_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pricing_plans" ON pricing_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pricing_plans" ON pricing_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_plans.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pricing_plans" ON pricing_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_plans.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PRICING VERSIONS
-- ============================================================
CREATE TABLE pricing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  version_number integer DEFAULT 1,
  price numeric(14,2) DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_current boolean DEFAULT true,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_versions_workspace ON pricing_versions(workspace_id);
CREATE INDEX idx_pricing_versions_plan ON pricing_versions(plan_id);
ALTER TABLE pricing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pricing_versions" ON pricing_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pricing_versions" ON pricing_versions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pricing_versions" ON pricing_versions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_versions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pricing_versions" ON pricing_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_versions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PRICING RULES
-- ============================================================
CREATE TABLE pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES pricing_plans(id) ON DELETE SET NULL,
  rule_name text NOT NULL,
  rule_type text CHECK (rule_type IN ('volume_discount','commitment_discount','startup_discount','nonprofit_discount','annual_discount','custom')),
  rule_conditions jsonb DEFAULT '{}'::jsonb,
  discount_percent numeric(5,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_rules_workspace ON pricing_rules(workspace_id);
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pricing_rules" ON pricing_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pricing_rules" ON pricing_rules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pricing_rules" ON pricing_rules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_rules.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pricing_rules" ON pricing_rules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_rules.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PRICING DISCOUNTS
-- ============================================================
CREATE TABLE pricing_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  discount_name text NOT NULL,
  discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed','tiered','usage')),
  discount_value numeric(14,2) DEFAULT 0,
  min_quantity integer DEFAULT 1,
  max_quantity integer,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_discounts_workspace ON pricing_discounts(workspace_id);
ALTER TABLE pricing_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pricing_discounts" ON pricing_discounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_discounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pricing_discounts" ON pricing_discounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_discounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pricing_discounts" ON pricing_discounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_discounts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_discounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pricing_discounts" ON pricing_discounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pricing_discounts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  coupon_code text NOT NULL,
  coupon_name text,
  discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(14,2) DEFAULT 0,
  max_redemptions integer,
  redemption_count integer DEFAULT 0,
  valid_from date,
  valid_until date,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupons_workspace ON coupons(workspace_id);
CREATE INDEX idx_coupons_code ON coupons(coupon_code);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_coupons" ON coupons FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = coupons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_coupons" ON coupons FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = coupons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_coupons" ON coupons FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = coupons.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = coupons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_coupons" ON coupons FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = coupons.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROMOTIONAL CAMPAIGNS
-- ============================================================
CREATE TABLE promotional_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  campaign_description text,
  coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
  campaign_type text DEFAULT 'discount' CHECK (campaign_type IN ('discount','free_trial','upgrade','bundle','referral','seasonal')),
  start_date date,
  end_date date,
  target_segment text,
  is_active boolean DEFAULT true,
  total_revenue_impact numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promotional_campaigns_workspace ON promotional_campaigns(workspace_id);
ALTER TABLE promotional_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_promotional_campaigns" ON promotional_campaigns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = promotional_campaigns.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_promotional_campaigns" ON promotional_campaigns FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = promotional_campaigns.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_promotional_campaigns" ON promotional_campaigns FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = promotional_campaigns.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = promotional_campaigns.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_promotional_campaigns" ON promotional_campaigns FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = promotional_campaigns.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BILLING ACCOUNTS
-- ============================================================
CREATE TABLE billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  account_name text NOT NULL,
  account_number text,
  billing_email text,
  billing_type text DEFAULT 'subscription' CHECK (billing_type IN ('subscription','one_time','usage_based','hybrid')),
  currency text DEFAULT 'USD',
  payment_terms_days integer DEFAULT 30,
  tax_exempt boolean DEFAULT false,
  credit_balance numeric(14,2) DEFAULT 0,
  auto_charge boolean DEFAULT true,
  dunning_enabled boolean DEFAULT true,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_accounts_workspace ON billing_accounts(workspace_id);
CREATE INDEX idx_billing_accounts_customer ON billing_accounts(customer_account_id);
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_billing_accounts" ON billing_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_billing_accounts" ON billing_accounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_billing_accounts" ON billing_accounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_accounts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_billing_accounts" ON billing_accounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_accounts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BILLING PROFILES
-- ============================================================
CREATE TABLE billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  legal_name text,
  tax_id text,
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  preferred_language text DEFAULT 'en',
  invoice_delivery_method text DEFAULT 'email' CHECK (invoice_delivery_method IN ('email','mail','portal','api')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_profiles_workspace ON billing_profiles(workspace_id);
CREATE INDEX idx_billing_profiles_account ON billing_profiles(billing_account_id);
ALTER TABLE billing_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_billing_profiles" ON billing_profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_billing_profiles" ON billing_profiles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_billing_profiles" ON billing_profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_profiles.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_billing_profiles" ON billing_profiles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_profiles.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BILLING CONTACTS
-- ============================================================
CREATE TABLE billing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  contact_role text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_contacts_workspace ON billing_contacts(workspace_id);
CREATE INDEX idx_billing_contacts_account ON billing_contacts(billing_account_id);
ALTER TABLE billing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_billing_contacts" ON billing_contacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_billing_contacts" ON billing_contacts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_billing_contacts" ON billing_contacts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_contacts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_billing_contacts" ON billing_contacts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_contacts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BILLING ADDRESSES
-- ============================================================
CREATE TABLE billing_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  address_type text DEFAULT 'billing' CHECK (address_type IN ('billing','shipping','both')),
  line1 text,
  line2 text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'US',
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_addresses_workspace ON billing_addresses(workspace_id);
CREATE INDEX idx_billing_addresses_account ON billing_addresses(billing_account_id);
ALTER TABLE billing_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_billing_addresses" ON billing_addresses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_addresses.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_billing_addresses" ON billing_addresses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_addresses.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_billing_addresses" ON billing_addresses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_addresses.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_addresses.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_billing_addresses" ON billing_addresses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_addresses.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BILLING PREFERENCES
-- ============================================================
CREATE TABLE billing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
  invoice_format text DEFAULT 'pdf' CHECK (invoice_format IN ('pdf','html','csv','api')),
  invoice_frequency text DEFAULT 'monthly' CHECK (invoice_frequency IN ('weekly','monthly','quarterly','annual','on_demand')),
  net_terms_days integer DEFAULT 30,
  auto_renew boolean DEFAULT true,
  proration_enabled boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  portal_access boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_preferences_workspace ON billing_preferences(workspace_id);
CREATE INDEX idx_billing_preferences_account ON billing_preferences(billing_account_id);
ALTER TABLE billing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_billing_preferences" ON billing_preferences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_billing_preferences" ON billing_preferences FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_billing_preferences" ON billing_preferences FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_preferences.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_billing_preferences" ON billing_preferences FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = billing_preferences.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SEED DEFAULT PRICING PLANS
-- ============================================================
INSERT INTO pricing_plans (workspace_id, plan_name, plan_code, plan_tier, description, base_price, billing_cycle, features, limits)
SELECT w.id, 'Starter', 'STARTER', 'starter', 'Entry-level plan for small teams', 99, 'monthly',
  '["Up to 5 users","Basic analytics","Email support"]'::jsonb,
  '{"users": 5, "api_calls": 1000}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans pp WHERE pp.workspace_id = w.id AND pp.plan_code = 'STARTER');

INSERT INTO pricing_plans (workspace_id, plan_name, plan_code, plan_tier, description, base_price, billing_cycle, features, limits)
SELECT w.id, 'Professional', 'PRO', 'professional', 'For growing teams that need more power', 499, 'monthly',
  '["Up to 25 users","Advanced analytics","Priority support","Custom dashboards"]'::jsonb,
  '{"users": 25, "api_calls": 10000}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans pp WHERE pp.workspace_id = w.id AND pp.plan_code = 'PRO');

INSERT INTO pricing_plans (workspace_id, plan_name, plan_code, plan_tier, description, base_price, billing_cycle, features, limits)
SELECT w.id, 'Enterprise', 'ENT', 'enterprise', 'For large organizations with custom needs', 1999, 'monthly',
  '["Unlimited users","Full analytics","24/7 support","Custom integrations","Dedicated CSM"]'::jsonb,
  '{"users": -1, "api_calls": -1}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pricing_plans pp WHERE pp.workspace_id = w.id AND pp.plan_code = 'ENT');
