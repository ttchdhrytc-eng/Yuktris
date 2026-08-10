// ============================================================
// ProviderWebhookService — Webhook registration and processing
// ============================================================

import { supabase } from '@/lib/supabase';
import { providerRegistry } from './ProviderRegistry';
import type {
  ProviderWebhookRecord,
  WebhookStatus,
  WebhookRegistration,
  WebhookProcessResult,
  ProviderContext,
} from '@/types/communication-providers';

class ProviderWebhookService {
  async registerWebhook(params: {
    connectionId: string;
    providerId: string;
    workspaceId: string;
    webhookUrl: string;
    webhookSecret: string;
    subscribedEvents: string[];
  }): Promise<WebhookRegistration> {
    const { data, error } = await supabase
      .from('provider_webhooks')
      .insert({
        connection_id: params.connectionId,
        provider_id: params.providerId,
        workspace_id: params.workspaceId,
        webhook_url: params.webhookUrl,
        webhook_secret: params.webhookSecret,
        subscribed_events: params.subscribedEvents,
        webhook_status: 'active',
      })
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to register webhook: ${error.message}`);

    const record = data as ProviderWebhookRecord;
    return {
      webhook_id: record.id,
      webhook_url: record.webhook_url ?? params.webhookUrl,
      subscribed_events: record.subscribed_events,
      status: record.webhook_status as WebhookStatus,
    };
  }

  async unregisterWebhook(webhookId: string): Promise<void> {
    const { error } = await supabase
      .from('provider_webhooks')
      .update({ webhook_status: 'inactive' })
      .eq('id', webhookId);
    if (error) throw new Error(`Failed to unregister webhook: ${error.message}`);
  }

  async listWebhooks(workspaceId: string): Promise<ProviderWebhookRecord[]> {
    const { data, error } = await supabase
      .from('provider_webhooks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load webhooks: ${error.message}`);
    return (data ?? []) as ProviderWebhookRecord[];
  }

  async listWebhooksByConnection(connectionId: string): Promise<ProviderWebhookRecord[]> {
    const { data, error } = await supabase
      .from('provider_webhooks')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load webhooks: ${error.message}`);
    return (data ?? []) as ProviderWebhookRecord[];
  }

  async receiveWebhook(params: {
    connectionId: string;
    providerId: string;
    workspaceId: string;
    rawPayload: Record<string, unknown>;
  }): Promise<ProviderWebhookRecord> {
    const { data, error } = await supabase
      .from('provider_webhooks')
      .insert({
        connection_id: params.connectionId,
        provider_id: params.providerId,
        workspace_id: params.workspaceId,
        raw_payload: params.rawPayload,
        webhook_status: 'processing',
        is_processed: false,
      })
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to store webhook: ${error.message}`);

    await supabase.from('provider_events').insert({
      connection_id: params.connectionId,
      provider_id: params.providerId,
      workspace_id: params.workspaceId,
      event_type: 'webhook_received',
      event_status: 'info',
      message: 'Webhook received from provider.',
      metadata: { webhook_id: (data as ProviderWebhookRecord)?.id },
    });

    return data as ProviderWebhookRecord;
  }

  async markProcessed(webhookId: string, processedPayload: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from('provider_webhooks')
      .update({
        processed_payload: processedPayload,
        is_processed: true,
        processed_at: new Date().toISOString(),
        webhook_status: 'active',
        processing_error: null,
      })
      .eq('id', webhookId);
    if (error) throw new Error(`Failed to mark webhook processed: ${error.message}`);
  }

  async markFailed(webhookId: string, errorMessage: string): Promise<void> {
    const { error } = await supabase
      .from('provider_webhooks')
      .update({
        is_processed: false,
        processing_error: errorMessage,
        webhook_status: 'error',
      })
      .eq('id', webhookId);
    if (error) throw new Error(`Failed to mark webhook failed: ${error.message}`);
  }

  async processWebhook(ctx: ProviderContext, webhookId: string, payload: Record<string, unknown>): Promise<WebhookProcessResult> {
    try {
      const provider = providerRegistry.get(ctx.providerKey);
      if (!provider) throw new Error(`Provider not registered: ${ctx.providerKey}`);

      const result = await provider.processWebhook(ctx, payload);
      await this.markProcessed(webhookId, { result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      await this.markFailed(webhookId, message);
      return { processed: false, error: message };
    }
  }
}

export const providerWebhookService = new ProviderWebhookService();
