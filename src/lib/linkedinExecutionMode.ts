export const LINKEDIN_OUTBOUND_MODE = 'cloud_persistent_agent';

export function isLinkedInOutboundEnabled(value: string | undefined = import.meta.env.VITE_LINKEDIN_EXECUTION_MODE): boolean {
  return value === LINKEDIN_OUTBOUND_MODE;
}
