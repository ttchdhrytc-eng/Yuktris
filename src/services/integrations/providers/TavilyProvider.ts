// ============================================================
// TavilyProvider — Tavily search API integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import { supabase } from '@/lib/supabase';
import { integrationLogger } from '../IntegrationLogger';
import type { ProviderDefinition, ConnectResult, RefreshResult } from '@/types/integrations';

const TAVILY_DEFINITION: ProviderDefinition = {
  id: 'tavily',
  name: 'Tavily',
  type: 'api_key',
  description: 'AI-optimized web search for research and intelligence',
  icon: 'search',
  color: '#8B5CF6',
  docsUrl: 'https://docs.tavily.com',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'validate_connection', 'health_check', 'get_permissions',
  ],
};

export class TavilyProvider extends BaseIntegrationProvider {
  definition = TAVILY_DEFINITION;

  async connect(params: { workspaceId: string }): Promise<ConnectResult> {
    const record = await this.initialize(params.workspaceId);

    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('workspace_id', params.workspaceId)
      .eq('provider', 'tavily')
      .maybeSingle();

    if (!apiKey) {
      return {
        connected: false,
        error: 'No Tavily API key found. Add an API key in Settings → API Keys.',
      };
    }

    await this.updateRecord(record.id, {
      status: 'connected',
      connection_health: 'healthy',
      connected_account: 'Tavily API',
    });

    await integrationLogger.log({
      integrationId: record.id,
      event: 'connect',
      status: 'success',
      message: 'Tavily integration connected.',
    });

    return { connected: true, error: null };
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    return {
      integration_id: _integrationId,
      provider: 'tavily',
      refreshed: true,
      expires_at: null,
      error: null,
    };
  }
}
