// ============================================================
// IntegrationLogger — Centralized audit trail for all integrations
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LogEvent, LogStatus } from '@/types/integrations';

class IntegrationLoggerService {
  async log(params: {
    integrationId: string;
    event: LogEvent;
    status: LogStatus;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('integration_logs').insert({
      integration_id: params.integrationId,
      event: params.event,
      status: params.status,
      message: params.message,
      metadata: params.metadata ?? {},
    });
    if (error) console.error('[IntegrationLogger] Failed to write log:', error.message);
  }

  async getLogs(integrationId: string, limit = 50): Promise<
    Array<{
      id: string;
      event: string;
      status: string;
      message: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>
  > {
    const { data, error } = await supabase
      .from('integration_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to fetch logs: ${error.message}`);
    return data ?? [];
  }

  async getLogsForWorkspace(
    workspaceId: string,
    limit = 100,
  filters?: { event?: LogEvent; status?: LogStatus }
  ): Promise<
    Array<{
      id: string;
      integration_id: string;
      event: string;
      status: string;
      message: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>
  > {
    let query = supabase
      .from('integration_logs')
      .select(`
        *,
        integrations!inner(workspace_id)
      `)
      .eq('integrations.workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters?.event) query = query.eq('event', filters.event);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch workspace logs: ${error.message}`);
    return data ?? [];
  }
}

export const integrationLogger = new IntegrationLoggerService();
