// ============================================================
// OpenAIProvider — OpenAI API integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import { supabase } from '@/lib/supabase';
import { integrationLogger } from '../IntegrationLogger';
import type { ProviderDefinition, ConnectResult, RefreshResult } from '@/types/integrations';

const OPENAI_DEFINITION: ProviderDefinition = {
  id: 'openai',
  name: 'OpenAI',
  type: 'api_key',
  description: 'GPT models for AI-powered analysis and content generation',
  icon: 'sparkles',
  color: '#10A37F',
  docsUrl: 'https://platform.openai.com/docs',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'validate_connection', 'health_check', 'get_permissions',
  ],
};

export class OpenAIProvider extends BaseIntegrationProvider {
  definition = OPENAI_DEFINITION;

  async connect(params: { workspaceId: string }): Promise<ConnectResult> {
    const record = await this.initialize(params.workspaceId);

    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('workspace_id', params.workspaceId)
      .eq('provider', 'openai')
      .maybeSingle();

    if (!apiKey) {
      return {
        connected: false,
        error: 'No OpenAI API key found. Add an API key in Settings → API Keys.',
      };
    }

    await this.updateRecord(record.id, {
      status: 'connected',
      connection_health: 'healthy',
      connected_account: 'OpenAI API',
    });

    await integrationLogger.log({
      integrationId: record.id,
      event: 'connect',
      status: 'success',
      message: 'OpenAI integration connected.',
    });

    return { connected: true, error: null };
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    return {
      integration_id: _integrationId,
      provider: 'openai',
      refreshed: true,
      expires_at: null,
      error: null,
    };
  }
}
