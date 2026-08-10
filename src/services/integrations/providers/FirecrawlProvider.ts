// ============================================================
// FirecrawlProvider — Firecrawl web scraping integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import { supabase } from '@/lib/supabase';
import { integrationLogger } from '../IntegrationLogger';
import type { ProviderDefinition, ConnectResult, RefreshResult } from '@/types/integrations';

const FIRECRAWL_DEFINITION: ProviderDefinition = {
  id: 'firecrawl',
  name: 'Firecrawl',
  type: 'api_key',
  description: 'Web scraping and crawling for company research',
  icon: 'flame',
  color: '#FF6B35',
  docsUrl: 'https://docs.firecrawl.dev',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'validate_connection', 'health_check', 'get_permissions',
  ],
};

export class FirecrawlProvider extends BaseIntegrationProvider {
  definition = FIRECRAWL_DEFINITION;

  async connect(params: { workspaceId: string }): Promise<ConnectResult> {
    const record = await this.initialize(params.workspaceId);

    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('workspace_id', params.workspaceId)
      .eq('provider', 'firecrawl')
      .maybeSingle();

    if (!apiKey) {
      return {
        connected: false,
        error: 'No Firecrawl API key found. Add an API key in Settings → API Keys.',
      };
    }

    await this.updateRecord(record.id, {
      status: 'connected',
      connection_health: 'healthy',
      connected_account: 'Firecrawl API',
    });

    await integrationLogger.log({
      integrationId: record.id,
      event: 'connect',
      status: 'success',
      message: 'Firecrawl integration connected.',
    });

    return { connected: true, error: null };
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    return {
      integration_id: _integrationId,
      provider: 'firecrawl',
      refreshed: true,
      expires_at: null,
      error: null,
    };
  }
}
