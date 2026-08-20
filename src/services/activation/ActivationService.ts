// ============================================================
// ActivationService — Customer Activation Engine
// ============================================================
//
// Orchestrates the entire customer activation flow:
//   1. Create workspace from website
//   2. Start business intelligence analysis (Research Engine)
//   3. Generate ICPs (ICP Intelligence Service)
//   4. Create the first campaign
//   5. Seed agent_executions so the dashboard shows live AI activity
//   6. Mark onboarding complete
//
// The user only provides: website, ICP selection, goal, channels.
// Everything else is discovered and created automatically.

import { supabase } from '@/lib/supabase';
import { biService } from '@/services/business-intelligence';
import { icpService } from '@/services/icp-intelligence';

export type ActivationStep =
  | 'workspace'
  | 'research'
  | 'analysis'
  | 'icp'
  | 'campaign'
  | 'agents'
  | 'complete';

export interface ActivationProgress {
  step: ActivationStep;
  label: string;
  completed: boolean;
}

export interface BusinessProfile {
  analysisId: string;
  name: string;
  website: string;
  description: string;
  industry: string;
  services: string[];
  usp: string;
  competitors: string[];
  targetCustomers: string;
  pricingModel: string;
  technologies: string[];
  businessModel: string;
  decisionMakers?: string;
  painPoints?: string;
  goals?: string;
}

export interface ICPRecommendation {
  id: string;
  name: string;
  description: string;
  industry: string;
  companySize: string;
  jobTitles: string[];
  painPoints: string[];
  goals: string[];
  estimatedTam: string;
  estimatedReplyRate: string;
  estimatedMeetingRate: string;
  competition: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  confidence: number;
  recommended: boolean;
}

export interface CampaignGoal {
  id: string;
  label: string;
  description: string;
}

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  { id: 'book_meetings', label: 'Book Meetings', description: 'I will find qualified prospects and book meetings directly to your calendar.' },
  { id: 'generate_demos', label: 'Generate Demos', description: 'I will target prospects likely to need a product demonstration.' },
  { id: 'sell_product', label: 'Sell Product', description: 'I will find buyers with active intent and drive them toward a purchase.' },
  { id: 'find_partners', label: 'Find Partners', description: 'I will identify complementary businesses for partnership opportunities.' },
  { id: 'recruit_affiliates', label: 'Recruit Affiliates', description: 'I will find influencers and content creators to promote your product.' },
  { id: 'generate_leads', label: 'Generate Leads', description: 'I will build a pipeline of qualified leads for your sales team.' },
  { id: 'expand_accounts', label: 'Expand Existing Accounts', description: 'I will identify upsell opportunities within your current customer base.' },
];

class ActivationService {
  private listeners: Set<(progress: ActivationProgress[]) => void> = new Set();
  private currentProgress: ActivationProgress[] = [];

  subscribe(callback: (progress: ActivationProgress[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentProgress);
    return () => this.listeners.delete(callback);
  }

  private emit() {
    this.listeners.forEach((cb) => cb([...this.currentProgress]));
  }

  private updateStep(step: ActivationStep, label: string, completed: boolean) {
    const existing = this.currentProgress.find((p) => p.step === step);
    if (existing) {
      existing.label = label;
      existing.completed = completed;
    } else {
      this.currentProgress.push({ step, label, completed });
    }
    this.emit();
  }

  resetProgress() {
    this.currentProgress = [];
    this.emit();
  }

  async markOnboardingStage(workspaceId: string, stage: string, extra: Record<string, unknown> = {}): Promise<void> {
    const { error } = await supabase.from('workspaces').update({ onboarding_stage: stage, ...extra }).eq('id', workspaceId);
    if (error) throw new Error(`Could not save onboarding progress: ${error.message}`);
  }

  async loadPersistedOnboarding(workspaceId: string): Promise<{
    analysis: BusinessProfile | null;
    analysisStatus: string | null;
    icps: ICPRecommendation[];
    campaignInitialized: boolean;
  }> {
    const [{ data: analysis }, fullIcps, { data: campaigns }] = await Promise.all([
      supabase.from('business_analysis').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      icpService.loadAllICPs(workspaceId),
      supabase.from('customer_campaigns').select('id').eq('workspace_id', workspaceId).limit(1),
    ]);
    const persistedAnalysis = analysis as Record<string, unknown> | null;
    const profile = persistedAnalysis ? {
      analysisId: String(persistedAnalysis.id),
      name: String(persistedAnalysis.company_name ?? ''),
      website: String(persistedAnalysis.website ?? ''),
      description: String(persistedAnalysis.description ?? ''),
      industry: String(persistedAnalysis.industry ?? ''),
      services: Array.isArray(persistedAnalysis.services) ? persistedAnalysis.services.map(String) : [],
      usp: String(persistedAnalysis.usp ?? ''),
      competitors: [],
      targetCustomers: String(persistedAnalysis.target_audience ?? ''),
      pricingModel: String(persistedAnalysis.pricing_model ?? ''),
      technologies: [],
      businessModel: String(persistedAnalysis.business_model ?? ''),
    } : null;
    const icps: ICPRecommendation[] = fullIcps.map((icp, index) => ({
      id: icp.id, name: icp.name, description: icp.description,
      industry: icp.company_profile.industry, companySize: icp.company_profile.company_size,
      jobTitles: icp.decision_makers.map((item) => item.job_title),
      painPoints: icp.pain_points.map((item) => item.pain_point),
      goals: icp.goals.map((item) => item.goal),
      estimatedTam: icp.estimated_deal_size ?? '$10K+ ARR per deal',
      estimatedReplyRate: `${icp.conversion_rate}%`, estimatedMeetingRate: `${Math.round(icp.conversion_rate * 0.3)}%`,
      competition: icp.competition_score > 70 ? 'High' : icp.competition_score > 50 ? 'Medium' : 'Low',
      difficulty: icp.opportunity_score > 90 ? 'Medium' : icp.opportunity_score > 75 ? 'Easy' : 'Hard',
      confidence: icp.confidence, recommended: index === 0,
    }));
    return {
      analysis: profile,
      analysisStatus: persistedAnalysis ? String(persistedAnalysis.analysis_status ?? '') : null,
      icps,
      campaignInitialized: (campaigns?.length ?? 0) > 0,
    };
  }

  // ----------------------------------------------------------
  // Step 1: Create workspace from website
  // ----------------------------------------------------------

  async createWorkspaceFromWebsite(params: {
    userId: string;
    website: string;
  }): Promise<string> {
    this.resetProgress();
    this.updateStep('workspace', 'Creating your workspace...', false);

    const domain = params.website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    const name = domain.split('.')[0];
    const capName = name.charAt(0).toUpperCase() + name.slice(1);

    const { data: existingMembers } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', params.userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1);

    let workspaceId: string;

    if (existingMembers && existingMembers.length > 0) {
      workspaceId = existingMembers[0].workspace_id;
      await supabase
        .from('workspaces')
        .update({
          name: capName,
          website: params.website,
          onboarding_completed: false,
          onboarding_stage: 'business_input',
        })
        .eq('id', workspaceId);
    } else {
      const { data: ws, error } = await supabase
        .from('workspaces')
        .insert({
          name: capName,
          website: params.website,
          onboarding_completed: false,
          owner_id: params.userId,
          onboarding_stage: 'business_input',
        })
        .select()
        .single();

      if (error || !ws) throw new Error(error?.message ?? 'Failed to create workspace.');
      workspaceId = ws.id;

      await supabase
        .from('workspace_members')
        .insert({ workspace_id: ws.id, user_id: params.userId, role: 'owner' });
    }

    localStorage.setItem('revenueai_workspace_id', workspaceId);
    this.updateStep('workspace', 'Workspace created', true);
    return workspaceId;
  }

  // ----------------------------------------------------------
  // Step 2: Run business intelligence analysis
  // ----------------------------------------------------------

  async runBusinessAnalysis(workspaceId: string, website: string): Promise<BusinessProfile> {
    this.updateStep('research', 'Reading your website...', false);
    this.updateStep('analysis', 'Understanding your business...', false);

    const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const name = domain.split('.')[0];
    const capName = name.charAt(0).toUpperCase() + name.slice(1);
    await supabase.from('workspaces').update({ onboarding_stage: 'business_research' }).eq('id', workspaceId);

    const result = await biService.runResearchAnalysis(workspaceId, website, capName);
    if (result.analysis.analysis_status !== 'completed' || result.analysis.completion_percentage !== 100) {
      throw new Error('Business analysis did not finish successfully.');
    }

    this.updateStep('research', 'Website analyzed', true);
    this.updateStep('analysis', 'Business analysis complete', true);
    await supabase.from('workspaces').update({ onboarding_stage: 'business_ready' }).eq('id', workspaceId);
    return { analysisId: result.analysis.id, website, ...result.profile };
  }

  // ----------------------------------------------------------
  // Step 3: Generate ICPs
  // ----------------------------------------------------------

  async generateICPs(workspaceId: string, businessProfile: BusinessProfile): Promise<ICPRecommendation[]> {
    this.updateStep('icp', 'Generating ICP recommendations...', false);
    await supabase.from('workspaces').update({ onboarding_stage: 'icp_generating' }).eq('id', workspaceId);

    try {
      const { icps: generated } = await icpService.generateFullPipeline(workspaceId, businessProfile.name, businessProfile.analysisId);

      const icps: ICPRecommendation[] = generated.map((icp, index) => ({
        id: icp.id,
        name: icp.name,
        description: icp.description,
        industry: icp.company_profile.industry,
        companySize: icp.company_profile.company_size,
        jobTitles: icp.decision_makers.map((dm) => dm.job_title),
        painPoints: icp.pain_points.map((p) => p.pain_point),
        goals: icp.goals.map((g) => g.goal),
        estimatedTam: icp.estimated_deal_size ?? '$10K+ ARR per deal',
        estimatedReplyRate: `${icp.conversion_rate}%`,
        estimatedMeetingRate: `${Math.round(icp.conversion_rate * 0.3)}%`,
        competition: icp.competition_score > 70 ? 'High' : icp.competition_score > 50 ? 'Medium' : 'Low',
        difficulty: icp.opportunity_score > 90 ? 'Medium' : icp.opportunity_score > 75 ? 'Easy' : 'Hard',
        confidence: icp.confidence,
        recommended: index === 0,
      }));

      this.updateStep('icp', 'ICPs generated', true);
      await supabase.from('workspaces').update({ onboarding_stage: 'icp_ready' }).eq('id', workspaceId);
      return icps;
    } catch (error) {
      this.updateStep('icp', 'ICP generation needs attention', false);
      console.error('Onboarding ICP generation failed', error);
      throw new Error('We could not finish building your ideal customer profile. Please try again.');
    }
  }

  // ----------------------------------------------------------
  // Step 4: Create campaign + seed AI activity
  // ----------------------------------------------------------

  async initializeCampaign(params: {
    workspaceId: string;
    icp: ICPRecommendation;
    goal: string;
    channels: { linkedin: boolean; email: boolean };
    businessProfile?: BusinessProfile;
    linkedinAccountId?: string | null;
  }): Promise<{ campaignId: string; status: 'ready' | 'blocked_prerequisite'; message: string }> {
    this.updateStep('campaign', 'Creating your campaign...', false);

    const channelStr = [
      params.channels.linkedin ? 'LinkedIn' : null,
      params.channels.email ? 'Email' : null,
    ].filter(Boolean).join(' + ');

    const goalLabel = CAMPAIGN_GOALS.find((g) => g.id === params.goal)?.label ?? params.goal;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: params.workspaceId,
        name: `${params.icp.name} — ${goalLabel}`,
        description: `Targeting ${params.icp.name}. Channels: ${channelStr}. Goal: ${goalLabel}.`,
        status: 'draft',
        start_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    const campaignId = campaign.id;

    // Persist reviewed/edited business profile to the workspace
    if (params.businessProfile) {
      await supabase
        .from('workspaces')
        .update({
          name: params.businessProfile.name,
          industry: params.businessProfile.industry,
        })
        .eq('id', params.workspaceId);
    }

    if (params.channels.linkedin) {
      this.updateStep('campaign', 'Starting LinkedIn prospect discovery...', false);
      const { data: pipeline, error: pipelineError } = await supabase.functions.invoke('linkedin-v1-pipeline', {
        body: {
          action: 'initialize',
          workspace_id: params.workspaceId,
          campaign_id: campaignId,
          icp: params.icp,
          linkedin_account_id: params.linkedinAccountId,
          require_gmail: params.channels.email,
          campaign: { name: campaign.name, source_campaign_id: campaignId },
        },
      });
      if (pipelineError) {
        throw new Error(`Campaign setup failed: ${pipelineError.message}`);
      }
      if ((pipeline as { error?: string } | null)?.error) {
        throw new Error(`Campaign setup failed: ${(pipeline as { error: string }).error}`);
      }
      const result = pipeline as { status?: 'ready' | 'blocked_prerequisite'; message?: string } | null;
      this.updateStep('campaign', result?.status === 'ready' ? 'Campaign ready to launch' : 'Campaign saved; connections required', true);
      this.updateStep('complete', 'Activation complete', true);
      await supabase.from('workspaces').update({ onboarding_stage: 'setup_ready' }).eq('id', params.workspaceId);
      return { campaignId, status: result?.status ?? 'blocked_prerequisite', message: result?.message ?? 'Campaign saved.' };
    } else {
      this.updateStep('campaign', 'Campaign created', true);
    }

    this.updateStep('complete', 'Activation complete', true);
    await supabase.from('workspaces').update({ onboarding_stage: 'setup_ready' }).eq('id', params.workspaceId);
    return { campaignId, status: 'ready', message: 'Campaign saved and ready.' };
  }

  // ----------------------------------------------------------
  // Complete activation
  // ----------------------------------------------------------

  async completeActivation(workspaceId: string): Promise<void> {
    await supabase
      .from('workspaces')
      .update({ onboarding_completed: true, onboarding_stage: 'completed' })
      .eq('id', workspaceId);
  }
}

export const activationService = new ActivationService();
