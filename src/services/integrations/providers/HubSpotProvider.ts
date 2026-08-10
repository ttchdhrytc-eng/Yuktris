// ============================================================
// HubSpotProvider — HubSpot CRM integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import type { ProviderDefinition, ConnectResult, RefreshResult, SyncResult } from '@/types/integrations';

const HUBSPOT_DEFINITION: ProviderDefinition = {
  id: 'hubspot',
  name: 'HubSpot',
  type: 'oauth',
  description: 'CRM, marketing, and sales pipeline management',
  icon: 'hubspot',
  color: '#FF7A59',
  authUrl: 'https://app.hubspot.com/oauth/authorize',
  tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
  scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.companies.read'],
  docsUrl: 'https://developers.hubspot.com/docs',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'reconnect', 'refresh_tokens',
    'validate_connection', 'health_check', 'get_permissions', 'sync',
  ],
};

export class HubSpotProvider extends BaseIntegrationProvider {
  definition = HUBSPOT_DEFINITION;

  async connect(_params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    throw new Error('HubSpot connect not yet implemented');
  }

  async reconnect(_integrationId: string): Promise<ConnectResult> {
    throw new Error('HubSpot reconnect not yet implemented');
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    throw new Error('HubSpot token refresh not yet implemented');
  }

  async sync(_integrationId: string): Promise<SyncResult> {
    throw new Error('HubSpot sync not yet implemented');
  }
}
