// ============================================================
// PromptManager — Centralized prompt management
// ============================================================
//
// Supports versioning, dynamic variables, prompt templates, and
// prompt testing. Prompts are stored in the ai_prompts table.

import { supabase } from '@/lib/supabase';
import type { AIPromptRecord, AIProviderId, PromptTestResult } from '@/types/ai-gateway';

class PromptManager {
  // Get the active version of a prompt by name
  async getPrompt(promptName: string): Promise<AIPromptRecord | null> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_name', promptName)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`Failed to load prompt: ${error.message}`);
    return data as AIPromptRecord | null;
  }

  // Get all active prompts
  async getAllPrompts(): Promise<AIPromptRecord[]> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('is_active', true)
      .order('prompt_name', { ascending: true });
    if (error) throw new Error(`Failed to load prompts: ${error.message}`);
    return (data ?? []) as AIPromptRecord[];
  }

  // Get all versions of a prompt
  async getPromptVersions(promptName: string): Promise<AIPromptRecord[]> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_name', promptName)
      .order('version', { ascending: false });
    if (error) throw new Error(`Failed to load prompt versions: ${error.message}`);
    return (data ?? []) as AIPromptRecord[];
  }

  // Create a new prompt or a new version of an existing prompt
  async createPrompt(params: {
    promptName: string;
    description?: string;
    systemPrompt: string;
    userPromptTemplate?: string;
    temperature?: number;
    maxTokens?: number | null;
    providerOverride?: AIProviderId | null;
    modelOverride?: string | null;
  }): Promise<AIPromptRecord> {
    // Get the latest version number
    const { data: existing } = await supabase
      .from('ai_prompts')
      .select('version')
      .eq('prompt_name', params.promptName)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = existing ? (existing as { version: number }).version + 1 : 1;

    // Deactivate previous active version
    if (existing) {
      await supabase
        .from('ai_prompts')
        .update({ is_active: false })
        .eq('prompt_name', params.promptName)
        .eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('ai_prompts')
      .insert({
        prompt_name: params.promptName,
        version: newVersion,
        description: params.description ?? null,
        system_prompt: params.systemPrompt,
        user_prompt_template: params.userPromptTemplate ?? null,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? null,
        provider_override: params.providerOverride ?? null,
        model_override: params.modelOverride ?? null,
        is_active: true,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create prompt: ${error.message}`);
    return data as AIPromptRecord;
  }

  // Update an existing prompt (creates a new version)
  async updatePrompt(promptName: string, updates: {
    description?: string;
    systemPrompt?: string;
    userPromptTemplate?: string;
    temperature?: number;
    maxTokens?: number | null;
    providerOverride?: AIProviderId | null;
    modelOverride?: string | null;
  }): Promise<AIPromptRecord> {
    const current = await this.getPrompt(promptName);
    if (!current) throw new Error(`Prompt not found: ${promptName}`);

    return this.createPrompt({
      promptName,
      description: updates.description ?? current.description ?? undefined,
      systemPrompt: updates.systemPrompt ?? current.system_prompt,
      userPromptTemplate: updates.userPromptTemplate ?? current.user_prompt_template ?? undefined,
      temperature: updates.temperature ?? Number(current.temperature),
      maxTokens: updates.maxTokens ?? current.max_tokens,
      providerOverride: updates.providerOverride ?? (current.provider_override as AIProviderId | null),
      modelOverride: updates.modelOverride ?? current.model_override,
    });
  }

  // Render a prompt template with variables
  renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] ?? match;
    });
  }

  // Extract variable names from a template
  extractVariables(template: string): string[] {
    const matches = template.matchAll(/\{\{(\w+)\}\}/g);
    return Array.from(matches).map((m) => m[1]);
  }

  // Test a prompt by rendering it with provided variables
  testPrompt(params: {
    systemPrompt: string;
    userPromptTemplate?: string;
    variables: Record<string, string>;
  }): PromptTestResult {
    const renderedSystem = this.renderTemplate(params.systemPrompt, params.variables);
    const renderedUser = params.userPromptTemplate
      ? this.renderTemplate(params.userPromptTemplate, params.variables)
      : '';

    const systemVars = this.extractVariables(params.systemPrompt);
    const userVars = params.userPromptTemplate ? this.extractVariables(params.userPromptTemplate) : [];
    const allVars = Array.from(new Set([...systemVars, ...userVars]));

    const missing = allVars.filter((v) => !(v in params.variables));
    const resolved = allVars.filter((v) => v in params.variables).length;

    return {
      rendered_system: renderedSystem,
      rendered_user: renderedUser,
      variables_resolved: resolved,
      variables_missing: missing,
    };
  }

  // Validate a prompt (basic checks)
  validatePrompt(params: {
    systemPrompt: string;
    userPromptTemplate?: string;
    temperature?: number;
    maxTokens?: number | null;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.systemPrompt || params.systemPrompt.trim().length === 0) {
      errors.push('System prompt is required.');
    }

    if (params.temperature !== undefined) {
      if (params.temperature < 0 || params.temperature > 2) {
        errors.push('Temperature must be between 0 and 2.');
      }
    }

    if (params.maxTokens !== null && params.maxTokens !== undefined) {
      if (params.maxTokens <= 0) {
        errors.push('Max tokens must be positive.');
      }
    }

    if (params.userPromptTemplate) {
      const vars = this.extractVariables(params.userPromptTemplate);
      if (vars.length === 0 && params.userPromptTemplate.length > 0) {
        // Template has no variables — that's fine, just a note
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const promptManager = new PromptManager();
