export const LINKEDIN_OUTBOUND_MODE = 'cloud_persistent_agent';
export const STAGING_SUPABASE_PROJECT = 'vdiqfiuqckaxdjkadinu';

export function isLinkedInOutboundEnabled(value: string | undefined = import.meta.env.VITE_LINKEDIN_EXECUTION_MODE): boolean {
  return value === LINKEDIN_OUTBOUND_MODE;
}

export type LinkedInOutboundUiStatus = 'enabled' | 'staging_disabled' | 'disabled';

export function linkedinOutboundUiStatus(
  mode: string | undefined = import.meta.env.VITE_LINKEDIN_EXECUTION_MODE,
  supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): LinkedInOutboundUiStatus {
  if (isLinkedInOutboundEnabled(mode)) return 'enabled';
  return supabaseUrl?.includes(STAGING_SUPABASE_PROJECT) ? 'staging_disabled' : 'disabled';
}
