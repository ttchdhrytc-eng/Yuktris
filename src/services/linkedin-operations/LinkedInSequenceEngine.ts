// ============================================================
// LinkedInSequenceEngine — Manages multi-step sequences
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LinkedInSequence, LinkedInSequenceState, StepStatus } from '@/types/linkedin-operations';

class LinkedInSequenceEngine {
  // ----------------------------------------------------------
  // Create a sequence from campaign touchpoints
  // ----------------------------------------------------------

  async createSequence(workspaceId: string, params: {
    campaign_id?: string;
    sequence_name: string;
    sequence_steps: unknown[];
  }): Promise<LinkedInSequence> {
    const { data, error } = await supabase
      .from('linkedin_sequences')
      .insert({
        workspace_id: workspaceId,
        campaign_id: params.campaign_id ?? null,
        sequence_name: params.sequence_name,
        sequence_steps: params.sequence_steps,
        total_steps: params.sequence_steps.length,
        status: 'active',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as LinkedInSequence;
  }

  // ----------------------------------------------------------
  // Enroll a prospect in a sequence
  // ----------------------------------------------------------

  async enrollProspect(workspaceId: string, params: {
    sequence_id: string;
    linkedin_account_id?: string;
    contact_id: string;
    company_id: string;
  }): Promise<void> {
    const { error } = await supabase.from('linkedin_sequence_state').insert({
      workspace_id: workspaceId,
      sequence_id: params.sequence_id,
      linkedin_account_id: params.linkedin_account_id ?? null,
      contact_id: params.contact_id,
      company_id: params.company_id,
      current_step: 0,
      step_status: 'pending',
      started_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  // ----------------------------------------------------------
  // Advance a prospect to the next step
  // ----------------------------------------------------------

  async advanceStep(workspaceId: string, stateId: string): Promise<void> {
    const { data: state } = await supabase
      .from('linkedin_sequence_state')
      .select('*')
      .eq('id', stateId)
      .maybeSingle();

    if (!state) return;
    const currentState = state as LinkedInSequenceState;

    // Mark current step as completed
    await supabase.from('linkedin_sequence_state').update({
      current_step: currentState.current_step + 1,
      step_status: 'pending',
      next_action_at: this.calculateNextActionTime(currentState.current_step + 1),
    }).eq('id', stateId);
  }

  // ----------------------------------------------------------
  // Stop a sequence for a prospect
  // ----------------------------------------------------------

  async stopSequence(workspaceId: string, contactId: string, reason: 'meeting_booked' | 'prospect_replied' | 'prospect_rejected' | 'campaign_paused' | 'manual_stop'): Promise<void> {
    await supabase.from('linkedin_sequence_state').update({
      step_status: 'stopped',
      stopped_reason: reason,
      completed_at: new Date().toISOString(),
    }).eq('contact_id', contactId).in('step_status', ['pending', 'in_progress']);
  }

  // ----------------------------------------------------------
  // Load sequences
  // ----------------------------------------------------------

  async loadSequences(workspaceId: string): Promise<LinkedInSequence[]> {
    const { data } = await supabase
      .from('linkedin_sequences')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    return (data ?? []) as LinkedInSequence[];
  }

  // ----------------------------------------------------------
  // Load sequence states
  // ----------------------------------------------------------

  async loadSequenceStates(workspaceId: string): Promise<LinkedInSequenceState[]> {
    const { data } = await supabase
      .from('linkedin_sequence_state')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(50);
    return (data ?? []) as LinkedInSequenceState[];
  }

  // ----------------------------------------------------------
  // Get prospects ready for next step
  // ----------------------------------------------------------

  async getReadyForNextStep(workspaceId: string): Promise<LinkedInSequenceState[]> {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('linkedin_sequence_state')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('step_status', 'pending')
      .or(`next_action_at.is.null,next_action_at.lte.${now}`)
      .limit(20);
    return (data ?? []) as LinkedInSequenceState[];
  }

  // ----------------------------------------------------------
  // Pause all sequences for a campaign
  // ----------------------------------------------------------

  async pauseCampaign(workspaceId: string, campaignId: string): Promise<void> {
    await supabase.from('linkedin_sequences').update({ status: 'paused' }).eq('workspace_id', workspaceId).eq('campaign_id', campaignId);
    await supabase.from('linkedin_sequence_state').update({ step_status: 'skipped' }).eq('workspace_id', workspaceId).in('step_status', ['pending', 'in_progress']);
  }

  // ----------------------------------------------------------
  // Resume campaign sequences
  // ----------------------------------------------------------

  async resumeCampaign(workspaceId: string, campaignId: string): Promise<void> {
    await supabase.from('linkedin_sequences').update({ status: 'active' }).eq('workspace_id', workspaceId).eq('campaign_id', campaignId);
    await supabase.from('linkedin_sequence_state').update({ step_status: 'pending' }).eq('workspace_id', workspaceId).eq('step_status', 'skipped');
  }

  private calculateNextActionTime(nextStep: number): string {
    // Each step has a delay — day 0, day 3, day 7, day 14
    const delays = [0, 3, 7, 14, 21, 30];
    const delayDays = delays[Math.min(nextStep, delays.length - 1)] ?? 7;
    return new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString();
  }
}

export const linkedinSequenceEngine = new LinkedInSequenceEngine();
