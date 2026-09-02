import type { QueueItem } from './queue.js';

export function productionAcceptanceScheduleCandidate(
  item: QueueItem,
  configuredAuthorizationId: string | null,
  normalOutboundEnabled: boolean,
): string | null {
  const boundAuthorizationId = typeof item.action_params?.production_acceptance_authorization_id === 'string'
    ? item.action_params.production_acceptance_authorization_id
    : null;
  if (normalOutboundEnabled || item.action_type !== 'connection_request' || !configuredAuthorizationId
      || boundAuthorizationId !== configuredAuthorizationId) return null;
  return boundAuthorizationId;
}
