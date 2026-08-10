// ============================================================
// ProviderAnalyticsService — Provider performance analytics
// ============================================================

import { supabase } from '@/lib/supabase';
import type {
  ProviderAnalytics,
  ProviderEventRecord,
  ProviderLogRecord,
} from '@/types/communication-providers';

class ProviderAnalyticsService {
  async getAnalytics(workspaceId: string): Promise<ProviderAnalytics> {
    const [connections, logs, events] = await Promise.all([
      this.loadConnections(workspaceId),
      this.loadLogs(workspaceId, 500),
      this.loadEvents(workspaceId, 100),
    ]);

    const totalConnections = connections.length;
    const connected = connections.filter((c: { status: string }) => c.status === 'connected').length;
    const disconnected = connections.filter((c: { status: string }) => c.status === 'disconnected').length;

    const sentLogs = logs.filter((l: { operation: string; status: string }) => l.operation === 'send_message');
    const totalSent = sentLogs.filter((l: { status: string }) => l.status === 'success').length;
    const totalFailed = sentLogs.filter((l: { status: string }) => l.status === 'failure').length;
    const totalRetries = logs.filter((l: { operation: string }) => l.operation === 'send_message' && (l as { metadata?: { retry_attempt?: number } }).metadata?.retry_attempt).length;

    const webhookEvents = events.filter((e: { event_type: string }) => e.event_type === 'webhook_received');
    const totalWebhooksReceived = webhookEvents.length;
    const totalWebhooksProcessed = webhookEvents.filter((e: { event_status: string }) => e.event_status === 'success').length;

    const successRate = totalSent + totalFailed > 0 ? totalSent / (totalSent + totalFailed) : 0;
    const latencies = logs.filter((l: { latency_ms: number | null }) => l.latency_ms !== null).map((l: { latency_ms: number }) => l.latency_ms);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length : null;

    const providerDist: Record<string, number> = {};
    for (const conn of connections) {
      const key = (conn as { provider_key: string }).provider_key;
      providerDist[key] = (providerDist[key] ?? 0) + 1;
    }

    const statusDist: Record<string, number> = {};
    for (const conn of connections) {
      const status = (conn as { status: string }).status;
      statusDist[status] = (statusDist[status] ?? 0) + 1;
    }

    return {
      total_connections: totalConnections,
      connected,
      disconnected,
      total_messages_sent: totalSent,
      total_messages_failed: totalFailed,
      total_retries: totalRetries,
      total_webhooks_received: totalWebhooksReceived,
      total_webhooks_processed: totalWebhooksProcessed,
      success_rate: Math.round(successRate * 100) / 100,
      avg_latency_ms: avgLatency !== null ? Math.round(avgLatency) : null,
      provider_distribution: providerDist,
      status_distribution: statusDist,
      recent_events: events.slice(0, 20),
      recent_logs: logs.slice(0, 20),
    };
  }

  async getRecentEvents(workspaceId: string, limit = 50): Promise<ProviderEventRecord[]> {
    return this.loadEvents(workspaceId, limit);
  }

  async getRecentLogs(workspaceId: string, limit = 50): Promise<ProviderLogRecord[]> {
    return this.loadLogs(workspaceId, limit);
  }

  private async loadConnections(workspaceId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) return [];
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  private async loadLogs(workspaceId: string, limit: number): Promise<ProviderLogRecord[]> {
    const { data, error } = await supabase
      .from('provider_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as ProviderLogRecord[];
  }

  private async loadEvents(workspaceId: string, limit: number): Promise<ProviderEventRecord[]> {
    const { data, error } = await supabase
      .from('provider_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as ProviderEventRecord[];
  }
}

export const providerAnalyticsService = new ProviderAnalyticsService();
