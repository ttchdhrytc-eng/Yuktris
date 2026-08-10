// ============================================================
// LinkedInProvider — LinkedIn Sales Navigator integration
// ============================================================

import { BaseIntegrationProvider } from '../BaseIntegrationProvider';
import type { ProviderDefinition, ConnectResult, RefreshResult, SyncResult } from '@/types/integrations';

const LINKEDIN_DEFINITION: ProviderDefinition = {
  id: 'linkedin',
  name: 'LinkedIn',
  type: 'oauth',
  description: 'Sales Navigator, prospect discovery, and outreach automation',
  icon: 'linkedin',
  color: '#0A66C2',
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  scopes: ['r_liteprofile', 'r_emailaddress', 'rw_organization_social'],
  docsUrl: 'https://learn.microsoft.com/en-us/linkedin/',
  capabilities: [
    'initialize', 'connect', 'disconnect', 'reconnect', 'refresh_tokens',
    'validate_connection', 'health_check', 'get_permissions', 'sync',
  ],
};

export class LinkedInProvider extends BaseIntegrationProvider {
  definition = LINKEDIN_DEFINITION;

  async connect(_params: {
    workspaceId: string;
    redirectUri?: string;
    scopes?: string[];
  }): Promise<ConnectResult> {
    throw new Error('LinkedIn connect not yet implemented');
  }

  async reconnect(_integrationId: string): Promise<ConnectResult> {
    throw new Error('LinkedIn reconnect not yet implemented');
  }

  async refreshTokens(_integrationId: string): Promise<RefreshResult> {
    throw new Error('LinkedIn token refresh not yet implemented');
  }

  async sync(_integrationId: string): Promise<SyncResult> {
    throw new Error('LinkedIn sync not yet implemented');
  }
}
