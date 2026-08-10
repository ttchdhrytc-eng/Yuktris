// ============================================================
// DuplicateDetectionService — Prevents duplicate companies & contacts
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Company, Contact } from '@/types/prospect-discovery-engine';

class DuplicateDetectionService {
  // ----------------------------------------------------------
  // Company dedup — match by website or normalized name
  // ----------------------------------------------------------

  async findOrCreateCompany(workspaceId: string, data: {
    name: string;
    website?: string | null;
    industry?: string | null;
    description?: string | null;
    employee_count?: string | null;
    estimated_revenue?: string | null;
    headquarters?: string | null;
    country?: string | null;
    funding_stage?: string | null;
    growth_stage?: string | null;
    confidence_score?: number;
  }): Promise<{ company: Company; created: boolean }> {
    const normalizedWebsite = data.website ? this.normalizeUrl(data.website) : null;
    const normalizedName = data.name.toLowerCase().trim();

    // Try to find by website first
    if (normalizedWebsite) {
      const { data: existing } = await supabase
        .from('companies')
        .select('*')
        .eq('workspace_id', workspaceId)
        .ilike('website', `%${normalizedWebsite}%`)
        .maybeSingle();
      if (existing) {
        // Merge — update with any new data
        const merged = await this.mergeCompany(existing.id, data);
        return { company: merged, created: false };
      }
    }

    // Try to find by normalized name
    const { data: existingByName } = await supabase
      .from('companies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .ilike('name', normalizedName)
      .maybeSingle();
    if (existingByName) {
      const merged = await this.mergeCompany(existingByName.id, data);
      return { company: merged, created: false };
    }

    // Create new
    const { data: created, error } = await supabase
      .from('companies')
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        website: normalizedWebsite ?? data.website,
        industry: data.industry,
        description: data.description,
        employee_count: data.employee_count,
        estimated_revenue: data.estimated_revenue,
        headquarters: data.headquarters,
        country: data.country,
        funding_stage: data.funding_stage,
        growth_stage: data.growth_stage,
        confidence_score: data.confidence_score ?? 0.5,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { company: created as Company, created: true };
  }

  // ----------------------------------------------------------
  // Contact dedup — match by linkedin_url or name + company
  // ----------------------------------------------------------

  async findOrCreateContact(workspaceId: string, companyId: string, data: {
    first_name: string;
    last_name: string;
    full_name?: string;
    job_title?: string;
    department?: string;
    seniority?: string;
    linkedin_url?: string;
    public_email?: string;
    confidence_score?: number;
  }): Promise<{ contact: Contact; created: boolean }> {
    // Try by LinkedIn URL
    if (data.linkedin_url) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('linkedin_url', data.linkedin_url)
        .maybeSingle();
      if (existing) {
        const merged = await this.mergeContact(existing.id, data);
        return { contact: merged, created: false };
      }
    }

    // Try by name + company
    const { data: existingByName } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('company_id', companyId)
      .ilike('first_name', data.first_name)
      .ilike('last_name', data.last_name)
      .maybeSingle();
    if (existingByName) {
      const merged = await this.mergeContact(existingByName.id, data);
      return { contact: merged, created: false };
    }

    // Create new
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        company_id: companyId,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: data.full_name ?? `${data.first_name} ${data.last_name}`,
        job_title: data.job_title,
        department: data.department,
        seniority: data.seniority,
        linkedin_url: data.linkedin_url,
        public_email: data.public_email,
        confidence_score: data.confidence_score ?? 0.5,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { contact: created as Contact, created: true };
  }

  // ----------------------------------------------------------
  // Merge — update existing record with new data without losing history
  // ----------------------------------------------------------

  private async mergeCompany(companyId: string, newData: Record<string, unknown>): Promise<Company> {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(newData)) {
      if (value !== null && value !== undefined && value !== '') {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      return data as Company;
    }
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Company;
  }

  private async mergeContact(contactId: string, newData: Record<string, unknown>): Promise<Contact> {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(newData)) {
      if (value !== null && value !== undefined && value !== '') {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from('contacts').select('*').eq('id', contactId).single();
      return data as Contact;
    }
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Contact;
  }

  private normalizeUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
