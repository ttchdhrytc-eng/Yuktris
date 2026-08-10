// ============================================================
// ProviderCapabilityService — Manages provider capability matrix
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ProviderCapabilityRecord, CapabilityKey } from '@/types/communication-providers';

class ProviderCapabilityService {
  async getCapabilities(providerId: string): Promise<ProviderCapabilityRecord[]> {
    const { data, error } = await supabase
      .from('provider_capabilities')
      .select('*')
      .eq('provider_id', providerId)
      .order('capability_key', { ascending: true });
    if (error) throw new Error(`Failed to load capabilities: ${error.message}`);
    return (data ?? []) as ProviderCapabilityRecord[];
  }

  async hasCapability(providerId: string, capability: CapabilityKey): Promise<boolean> {
    const { data, error } = await supabase
      .from('provider_capabilities')
      .select('is_supported, is_enabled')
      .eq('provider_id', providerId)
      .eq('capability_key', capability)
      .maybeSingle();
    if (error) return false;
    if (!data) return false;
    return (data as { is_supported: boolean; is_enabled: boolean }).is_supported && (data as { is_supported: boolean; is_enabled: boolean }).is_enabled;
  }

  async syncCapabilitiesFromDefinition(providerId: string, capabilities: string[]): Promise<void> {
    for (const cap of capabilities) {
      const { data: existing } = await supabase
        .from('provider_capabilities')
        .select('id')
        .eq('provider_id', providerId)
        .eq('capability_key', cap)
        .maybeSingle();

      if (!existing) {
        await supabase.from('provider_capabilities').insert({
          provider_id: providerId,
          capability_key: cap,
          capability_name: cap.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          is_supported: true,
          is_enabled: true,
        });
      }
    }
  }

  async toggleCapability(providerId: string, capability: CapabilityKey, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('provider_capabilities')
      .update({ is_enabled: enabled })
      .eq('provider_id', providerId)
      .eq('capability_key', capability);
    if (error) throw new Error(`Failed to toggle capability: ${error.message}`);
  }
}

export const providerCapabilityService = new ProviderCapabilityService();
