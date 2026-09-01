export const LINKEDIN_EXECUTION_ENABLED = 'cloud_persistent_agent' as const;
export const LINKEDIN_EXECUTION_DISABLED = 'disabled' as const;

export type LinkedInExecutionGate = {
  configuredValue: string | null;
  outboundEnabled: boolean;
  reason: 'enabled' | 'explicitly_disabled' | 'missing' | 'empty' | 'unknown';
};

export function resolveLinkedInExecutionGate(rawValue: string | undefined): LinkedInExecutionGate {
  if (rawValue === undefined) return { configuredValue: null, outboundEnabled: false, reason: 'missing' };
  const value = rawValue.trim();
  if (!value) return { configuredValue: null, outboundEnabled: false, reason: 'empty' };
  if (value === LINKEDIN_EXECUTION_ENABLED)
    return { configuredValue: value, outboundEnabled: true, reason: 'enabled' };
  if (value === LINKEDIN_EXECUTION_DISABLED)
    return { configuredValue: value, outboundEnabled: false, reason: 'explicitly_disabled' };
  return { configuredValue: null, outboundEnabled: false, reason: 'unknown' };
}
