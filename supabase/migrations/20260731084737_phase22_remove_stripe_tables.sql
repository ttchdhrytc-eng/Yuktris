/*
# Phase 22 — Remove empty Stripe tables

All 5 Stripe-specific tables are empty (0 rows confirmed).
Safe to remove since no production data exists.
The provider-neutral billing_* tables replace them.
*/

DROP TABLE IF EXISTS stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS stripe_payment_intents CASCADE;
DROP TABLE IF EXISTS stripe_invoices CASCADE;
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;
DROP TABLE IF EXISTS stripe_customers CASCADE;

SELECT 'stripe_tables_removed' as result;
