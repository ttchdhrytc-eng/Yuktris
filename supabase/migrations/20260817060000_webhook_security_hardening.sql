/*
# Webhook Security Hardening

## Purpose
Support signature-verified, idempotent inbound/outbound webhook processing for
`provider-webhook` (inbound, third-party providers) and `webhook-receiver`
(internal business-event fan-out).

## Changes
1. `provider_webhooks.external_event_id` — provider-supplied event/message id used to
   detect and short-circuit duplicate/retried deliveries per connection.
2. Unique partial index on `provider_webhooks(connection_id, external_event_id)` so a
   provider retry cannot create a second processed row for the same event.
3. Unique partial index on `webhook_deliveries(subscription_id, event_id)` so a
   retried `webhook-receiver` call cannot fan out duplicate deliveries.
*/

ALTER TABLE public.provider_webhooks
  ADD COLUMN IF NOT EXISTS external_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_webhooks_connection_event
  ON public.provider_webhooks (connection_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_deliveries_subscription_event
  ON public.webhook_deliveries (subscription_id, event_id)
  WHERE event_id IS NOT NULL;
