// ============================================================
// ProspectScoringService — AI-powered prospect scoring
// ============================================================

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import type {
  ProspectScoringInput, ProspectScoringResult, AIRecommendation,
  ProspectScore, SignalType,
} from '@/types/prospect-discovery-engine';

class ProspectScoringService {
  // ----------------------------------------------------------
  // Score a prospect (company + optional contact)
  // ----------------------------------------------------------

  async scoreProspect(workspaceId: string, input: ProspectScoringInput): Promise<ProspectScoringResult> {
    const systemPrompt = 'You are a B2B prospect scoring expert. You score companies and decision makers based on fit, signals, and probability. Always respond with valid JSON.';
    const userPrompt = `Score this prospect:

COMPANY: ${JSON.stringify(input.company)}
CONTACT: ${input.contact ? JSON.stringify(input.contact) : 'N/A'}
SIGNALS: ${JSON.stringify(input.signals)}
REVENUE STRATEGY: ${input.revenueStrategy ? JSON.stringify(input.revenueStrategy) : 'N/A'}

Return ONLY JSON:
{
  "company_score": 82,
  "decision_maker_score": 75,
  "relationship_score": 30,
  "reply_probability": 0.18,
  "meeting_probability": 0.08,
  "revenue_probability": 0.04,
  "overall_prospect_score": 78,
  "scoring_factors": {"icp_fit": 85, "signal_strength": 80, "decision_maker_access": 70},
  "ai_explanation": "This company scores high because...",
  "confidence": 0.82
}

Return ONLY the JSON.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2000,
      workspaceId,
      agentName: 'prospect_scoring_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as ProspectScoringResult;
  }

  // ----------------------------------------------------------
  // Generate AI recommendation for a prospect
  // ----------------------------------------------------------

  async generateRecommendation(
    workspaceId: string,
    company: { name: string; industry?: string; size?: string },
    contact: { full_name?: string; job_title?: string; department?: string } | null,
    signals: { type: SignalType; strength: number }[],
    revenueStrategy?: { best_messaging_angle?: string; best_outreach_channel?: string },
  ): Promise<AIRecommendation> {
    const systemPrompt = 'You are a B2B sales strategist. You explain why a company should be targeted, why a specific person, and why now. Always respond with valid JSON.';
    const userPrompt = `Generate a prospect recommendation:

COMPANY: ${JSON.stringify(company)}
CONTACT: ${contact ? JSON.stringify(contact) : 'N/A'}
SIGNALS: ${JSON.stringify(signals)}
STRATEGY CONTEXT: ${revenueStrategy ? JSON.stringify(revenueStrategy) : 'N/A'}

Return ONLY JSON:
{
  "why_company": "Acme Corp is a high-growth SaaS company that recently raised Series B...",
  "why_person": "Jane Doe is the VP of Sales with direct budget authority...",
  "why_now": "They are actively hiring 5 SDRs which signals expansion...",
  "reply_probability": 0.18,
  "meeting_probability": 0.08,
  "suggested_campaign": "High Growth SaaS Outreach",
  "suggested_messaging_angle": "AI-powered revenue acceleration",
  "suggested_cta": "Book a 15-min discovery call",
  "recommended_persona": "VP Sales",
  "confidence": 0.85
}

Return ONLY the JSON.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 2000,
      workspaceId,
      agentName: 'prospect_recommendation_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as AIRecommendation;
  }

  // ----------------------------------------------------------
  // Persist score to database
  // ----------------------------------------------------------

  async persistScore(
    workspaceId: string,
    companyId: string | null,
    contactId: string | null,
    result: ProspectScoringResult,
  ): Promise<ProspectScore> {
    const { data, error } = await supabase
      .from('prospect_scores')
      .insert({
        workspace_id: workspaceId,
        company_id: companyId,
        contact_id: contactId,
        company_score: result.company_score,
        decision_maker_score: result.decision_maker_score,
        relationship_score: result.relationship_score,
        reply_probability: result.reply_probability,
        meeting_probability: result.meeting_probability,
        revenue_probability: result.revenue_probability,
        overall_prospect_score: result.overall_prospect_score,
        scoring_factors: result.scoring_factors,
        ai_explanation: result.ai_explanation,
        confidence_score: result.confidence,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as ProspectScore;
  }

  // ----------------------------------------------------------
  // Persist recommendation to database
  // ----------------------------------------------------------

  async persistRecommendation(
    workspaceId: string,
    companyId: string,
    contactId: string | null,
    rec: AIRecommendation,
  ): Promise<void> {
    await supabase.from('prospect_recommendations').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId,
      recommendation: `${rec.why_company} ${rec.why_person} ${rec.why_now}`,
      priority: rec.reply_probability > 0.15 ? 'high' : 'medium',
      reason: rec.why_now,
      why_company: rec.why_company,
      why_person: rec.why_person,
      why_now: rec.why_now,
      reply_probability: rec.reply_probability,
      meeting_probability: rec.meeting_probability,
      suggested_campaign: rec.suggested_campaign,
      suggested_messaging_angle: rec.suggested_messaging_angle,
      suggested_cta: rec.suggested_cta,
      recommended_persona: rec.recommended_persona,
      confidence_score: rec.confidence,
    });
  }
}

export const prospectScoringService = new ProspectScoringService();
