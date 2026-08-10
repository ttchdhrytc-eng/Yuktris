// ============================================================
// SlackProvider — Slack messaging integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import type { ProviderDefinition, ConnectResult, RefreshResult, SyncResult } from '@/types/integrations';

const SLACK_DEFINITION: ProviderDefinition = {
  id: 'slack',
  name: 'Slack',
  type: 'oauth',
  description: 'Team messaging and notification automation',
  icon: 'slack',
  color: '#4A154B',
  authUrl: 'https://slack.com/oauth/v2/authorize',
  tokenUrl: 'https://slack.com/api/oauth.v2.access',
  scopes: ['chat:write', 'channels:read', 'channels:history'],
  docsUrl: 'https://api.slack.com/docs',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'reconnect', 'refresh_tokens',
    'validate_connection', 'health_check', 'get_permissions', 'sync',
  ],
};

export class SlackProvider extends BaseIntegrationProvider {
  definition = SLACK_DEFINITION;

  async connect(_params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    throw new Error('Slack connect not yet implemented');
  }

  async reconnect(_integrationId: string): Promise<ConnectResult> {
    throw new Error('Slack reconnect not yet implemented');
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    throw new Error('Slack token refresh not yet implemented');
  }

  async sync(_integrationId: string): Promise<SyncResult> {
    throw new Error('Slack sync not yet implemented');
  }
}
