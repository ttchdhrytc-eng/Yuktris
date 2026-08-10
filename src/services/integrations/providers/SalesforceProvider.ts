// ============================================================
// SalesforceProvider — Salesforce CRM integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import type { ProviderDefinition, ConnectResult, RefreshResult, SyncResult } from '@/types/integrations';

const SALESFORCE_DEFINITION: ProviderDefinition = {
  id: 'salesforce',
  name: 'Salesforce',
  type: 'oauth',
  description: 'CRM, sales cloud, and pipeline management',
  icon: 'salesforce',
  color: '#00A1E0',
  authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
  tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
  scopes: ['api', 'refresh_token'],
  docsUrl: 'https://developer.salesforce.com/docs',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'reconnect', 'refresh_tokens',
    'validate_connection', 'health_check', 'get_permissions', 'sync',
  ],
};

export class SalesforceProvider extends BaseIntegrationProvider {
  definition = SALESFORCE_DEFINITION;

  async connect(_params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    throw new Error('Salesforce connect not yet implemented');
  }

  async reconnect(_integrationId: string): Promise<ConnectResult> {
    throw new Error('Salesforce reconnect not yet implemented');
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    throw new Error('Salesforce token refresh not yet implemented');
  }

  async sync(_integrationId: string): Promise<SyncResult> {
    throw new Error('Salesforce sync not yet implemented');
  }
}
