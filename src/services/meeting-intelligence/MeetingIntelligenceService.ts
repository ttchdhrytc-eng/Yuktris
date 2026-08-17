// ============================================================
// MeetingIntelligenceService — Main orchestrator Phase 10
// ============================================================
//
// Pipeline:
//   Conversation Intelligence → Detect Meeting Intent →
//   Create Meeting Request → Generate Candidates →
//   Find Available Slots → Schedule Meeting →
//   Generate Brief + Agenda + Questions + Competitor Intel →
//   Prepare Checklist → Create Calendar Event →
//   Notify Human → Track Outcome → Follow-up
//
// The user never manually schedules meetings.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { contextEngine } from '@/services/context/ContextEngine';
import type {
  MeetingIntelligenceDashboard, MeetingWithIntelligence,
  MeetingRequest, MeetingCandidate, MeetingSlot,
  MeetingSchedulerRecord, MeetingBrief, MeetingAgenda,
  MeetingPreparation, MeetingChecklist, MeetingCompetitorIntel,
  MeetingQuestion, MeetingAttendee, MeetingFollowup,
  MeetingOutcomeRecord, MeetingScore, MeetingAIReasoning,
  MeetingNotification, MeetingPreferences, MeetingTypeCode,
  MeetingPlatform, MeetingUrgency, DetectedIntent,
} from '@/types/meeting-intelligence';

class MeetingIntelligenceService {
  // ----------------------------------------------------------
  // STEP 1: Detect meeting intent from conversations
  // ----------------------------------------------------------

  async detectMeetingIntent(workspaceId: string): Promise<void> {
    // Load conversations with meeting-ready signals
    const { data: conversations } = await supabase
      .from('conversations')
      .select(`
        id, contact_id, company_id, prospect_name, prospect_title, company_name,
        buying_stage, meeting_readiness_level, status,
        conversation_intents!inner(primary_intent, urgency, meeting_likelihood, confidence)
      `)
      .eq('workspace_id', workspaceId)
      .in('status', ['active'])
      .order('last_analyzed_at', { ascending: false })
      .limit(30);

    if (!conversations || conversations.length === 0) return;

    for (const conv of conversations) {
      const convData = conv as Record<string, unknown>;
      const intents = convData.conversation_intents as Array<Record<string, unknown>>;
      if (!intents || intents.length === 0) continue;

      const topIntent = intents[0];
      const primaryIntent = topIntent.primary_intent as string;
      const meetingLikelihood = (topIntent.meeting_likelihood as number) ?? 0;
      const urgency = (topIntent.urgency as string) ?? 'medium';

      // Check if meeting intent detected
      const hasMeetingIntent = ['meeting_request', 'demo_request', 'pricing_request'].includes(primaryIntent);
      const isMeetingReady = convData.meeting_readiness_level === 'ready' || convData.meeting_readiness_level === 'almost_ready';
      const highLikelihood = meetingLikelihood > 0.6;

      if (!hasMeetingIntent && !isMeetingReady && !highLikelihood) continue;

      // Check if meeting request already exists for this conversation
      const { data: existing } = await supabase
        .from('meeting_requests')
        .select('id')
        .eq('conversation_id', conv.id)
        .in('status', ['pending', 'approved', 'scheduled'])
        .maybeSingle();

      if (existing) continue;

      // Determine meeting type from buying stage
      const buyingStage = convData.buying_stage as string;
      const recommendedType = this.determineMeetingType(primaryIntent, buyingStage);
      const estimatedDuration = this.estimateDuration(recommendedType);

      // Create meeting request
      const { data: request } = await supabase.from('meeting_requests').insert({
        workspace_id: workspaceId,
        conversation_id: conv.id,
        contact_id: convData.contact_id as string | null,
        company_id: convData.company_id as string | null,
        prospect_name: convData.prospect_name as string | null,
        prospect_title: convData.prospect_title as string | null,
        company_name: convData.company_name as string | null,
        detected_intent: primaryIntent as DetectedIntent,
        meeting_urgency: urgency as MeetingUrgency,
        buying_stage: buyingStage,
        meeting_readiness_level: convData.meeting_readiness_level as string,
        recommended_meeting_type: recommendedType,
        estimated_duration: estimatedDuration,
        confidence_score: (topIntent.confidence as number) ?? 0.5,
        reasoning: `Detected ${primaryIntent} with ${Math.round(meetingLikelihood * 100)}% meeting likelihood. Buying stage: ${buyingStage}.`,
        status: 'pending',
      }).select('*').single();

      if (!request) continue;

      // Create candidate
      await this.createCandidate(workspaceId, request as MeetingRequest);

      // Generate slots
      await this.generateSlots(workspaceId, request.id, estimatedDuration);

      // Create notification
      await this.createNotification(workspaceId, null, 'meeting_detected',
        'Meeting Intent Detected',
        `${convData.prospect_name ?? 'A prospect'} is ready for a ${recommendedType.replace(/_/g, ' ')} meeting.`,
        'success');

      // Store in memory
      await this.storeMemory(workspaceId, request.id, 'meeting_detection', {
        prospect: convData.prospect_name,
        company: convData.company_name,
        intent: primaryIntent,
        type: recommendedType,
        urgency,
      });
    }
  }

  // ----------------------------------------------------------
  // STEP 2: Create candidate from request
  // ----------------------------------------------------------

  async createCandidate(workspaceId: string, request: MeetingRequest): Promise<void> {
    // Load conversation score
    const { data: score } = await supabase
      .from('conversation_score')
      .select('intent_score, engagement_score, overall_score')
      .eq('conversation_id', request.conversation_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Load company revenue estimate
    let revenueEstimate: number | null = null;
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('revenue_range')
        .eq('id', request.company_id)
        .maybeSingle();
      revenueEstimate = (company as Record<string, unknown>)?.revenue_range as number ?? null;
    }

    const intentScore = (score as Record<string, number>)?.intent_score ?? 50;
    const engagementScore = (score as Record<string, number>)?.engagement_score ?? 50;
    const overallScore = (score as Record<string, number>)?.overall_score ?? 50;

    const priority = request.meeting_urgency === 'critical' ? 'critical'
      : request.meeting_urgency === 'high' ? 'high'
      : overallScore > 70 ? 'high'
      : overallScore > 40 ? 'medium' : 'low';

    await supabase.from('meeting_candidates').insert({
      workspace_id: workspaceId,
      meeting_request_id: request.id,
      contact_id: request.contact_id,
      company_id: request.company_id,
      conversation_id: request.conversation_id,
      prospect_name: request.prospect_name,
      company_name: request.company_name,
      buying_stage: request.buying_stage,
      meeting_readiness: request.meeting_readiness_level,
      intent_score: intentScore,
      engagement_score: engagementScore,
      overall_score: overallScore,
      revenue_estimate: revenueEstimate,
      likelihood_to_close: 0.3,
      recommended_meeting_type: request.recommended_meeting_type,
      recommended_duration: request.estimated_duration,
      priority: priority as 'low' | 'medium' | 'high' | 'critical',
      status: 'candidate',
    });
  }

  // ----------------------------------------------------------
  // STEP 3: Generate available time slots
  // ----------------------------------------------------------

  async generateSlots(workspaceId: string, requestId: string, duration: number): Promise<void> {
    const prefs = await this.loadPreferences(workspaceId);
    const now = new Date();
    const minStart = new Date(now.getTime() + (prefs?.min_notice_hours ?? 2) * 60 * 60 * 1000);
    const endWindow = new Date(minStart.getTime() + 14 * 24 * 60 * 60 * 1000);
    const timezone = prefs?.timezone ?? 'America/New_York';

    // Ask Google Calendar for real busy blocks. If Google Calendar is not
    // connected we fail visibly rather than presenting fabricated availability.
    const { data: freeBusy, error: freeBusyError } = await supabase.functions.invoke('google-calendar-booking', {
      body: {
        action: 'freebusy',
        workspace_id: workspaceId,
        time_min: minStart.toISOString(),
        time_max: endWindow.toISOString(),
        timezone,
      },
    });
    if (freeBusyError) throw new Error(freeBusyError.message);
    if (freeBusy?.error) throw new Error(String(freeBusy.error));
    const busy = (freeBusy?.busy ?? []) as Array<{ start: string; end: string }>;
    const slots: Array<{ start_time: string; end_time: string; slot_rank: number }> = [];

    for (let dayOffset = 1; dayOffset <= 14 && slots.length < 5; dayOffset++) {
      const date = new Date(minStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase();
      if (!(prefs?.working_days ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).includes(dayName)) continue;

      const startHour = parseInt((prefs?.working_hours_start ?? '09:00').split(':')[0]);
      const endHour = parseInt((prefs?.working_hours_end ?? '17:00').split(':')[0]);
      const slotTimes = [startHour + 1, Math.floor((startHour + endHour) / 2), endHour - 1];
      for (const hour of slotTimes) {
        if (hour < startHour || hour >= endHour) continue;
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        if (slotStart < minStart) continue;
        const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
        const conflict = busy.some((block) => new Date(block.start).getTime() < slotEnd.getTime() && new Date(block.end).getTime() > slotStart.getTime());
        if (conflict) continue;
        slots.push({ start_time: slotStart.toISOString(), end_time: slotEnd.toISOString(), slot_rank: slots.length + 1 });
        if (slots.length >= 5) break;
      }
    }

    await supabase.from('meeting_slots')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('meeting_request_id', requestId)
      .eq('prospect_response', 'pending');

    if (slots.length > 0) {
      const { error } = await supabase.from('meeting_slots').insert(slots.map((slot) => ({
        workspace_id: workspaceId,
        meeting_request_id: requestId,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_rank: slot.slot_rank,
        timezone,
        is_available: true,
        is_offered: true,
        prospect_response: 'pending',
      })));
      if (error) throw new Error(error.message);
    }
  }

  // ----------------------------------------------------------
  // STEP 4: Schedule meeting (auto-select best slot)
  // ----------------------------------------------------------

  async scheduleMeeting(workspaceId: string, requestId: string): Promise<MeetingSchedulerRecord | null> {
    const { data: request, error: requestError } = await supabase
      .from('meeting_requests')
      .select('*')
      .eq('id', requestId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (requestError) throw new Error(requestError.message);
    if (!request) return null;

    const { data: slots, error: slotsError } = await supabase
      .from('meeting_slots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('meeting_request_id', requestId)
      .eq('is_available', true)
      .eq('prospect_response', 'accepted')
      .order('slot_rank', { ascending: true })
      .limit(1);
    if (slotsError) throw new Error(slotsError.message);
    if (!slots || slots.length === 0) return null;
    const slot = slots[0];

    const meetingType = (request.recommended_meeting_type ?? 'discovery') as MeetingTypeCode;
    const duration = request.estimated_duration ?? 30;
    let attendeeEmail: string | null = null;
    if (request.contact_id) {
      const { data: contact } = await supabase.from('contacts').select('email').eq('id', request.contact_id).eq('workspace_id', workspaceId).maybeSingle();
      attendeeEmail = contact?.email ?? null;
    }

    const title = `${meetingType.replace(/_/g, ' ')}: ${request.prospect_name ?? 'Prospect'} — ${request.company_name ?? ''}`;
    const { data: calendarResult, error: calendarError } = await supabase.functions.invoke('google-calendar-booking', {
      body: {
        action: 'create',
        workspace_id: workspaceId,
        summary: title,
        description: `AI-scheduled ${meetingType.replace(/_/g, ' ')} meeting via Yuktris`,
        start: slot.start_time,
        end: slot.end_time,
        timezone: slot.timezone,
        attendees: attendeeEmail ? [attendeeEmail] : [],
        idempotency_key: `meeting-${requestId}-${slot.id}`,
      },
    });
    if (calendarError || !calendarResult?.externalEventId) {
      throw new Error(calendarError?.message ?? calendarResult?.error ?? 'Google Calendar event creation failed');
    }

    const { data: meeting, error: meetingError } = await supabase.from('meeting_scheduler').insert({
      workspace_id: workspaceId,
      meeting_request_id: requestId,
      conversation_id: request.conversation_id,
      contact_id: request.contact_id,
      company_id: request.company_id,
      meeting_type: meetingType,
      meeting_title: title,
      meeting_description: `AI-scheduled ${meetingType.replace(/_/g, ' ')} meeting`,
      scheduled_start: slot.start_time,
      scheduled_end: slot.end_time,
      timezone: slot.timezone,
      duration_minutes: duration,
      platform: 'google_meet' as MeetingPlatform,
      meeting_link: calendarResult.meetLink ?? calendarResult.htmlLink ?? null,
      google_meet_link: calendarResult.meetLink ?? null,
      calendar_event_id: calendarResult.externalEventId,
      status: 'confirmed',
      prospect_name: request.prospect_name,
      prospect_title: request.prospect_title,
      company_name: request.company_name,
    }).select('*').single();
    if (meetingError) {
      await supabase.functions.invoke('google-calendar-booking', { body: { action: 'delete', workspace_id: workspaceId, event_id: calendarResult.externalEventId } }).catch(() => undefined);
      throw new Error(meetingError.message);
    }
    if (!meeting) return null;

    await supabase.from('meeting_slots').update({ is_selected: true, prospect_response: 'accepted' }).eq('id', slot.id).eq('workspace_id', workspaceId);
    await supabase.from('meeting_requests').update({ status: 'scheduled' }).eq('id', requestId).eq('workspace_id', workspaceId);
    await supabase.from('meeting_candidates').update({ status: 'scheduled' }).eq('meeting_request_id', requestId).eq('workspace_id', workspaceId);
    await supabase.from('meeting_confirmations').insert({
      workspace_id: workspaceId,
      meeting_id: meeting.id,
      confirmed_by: 'ai',
      confirmation_method: 'auto',
      notes: 'Google Calendar event and attendee invitation created automatically by Yuktris.',
    });

    await this.generateFullPreparation(workspaceId, meeting.id);
    await this.recordVersion(workspaceId, meeting.id, 'meeting_created', 'ai');
    await this.createNotification(workspaceId, meeting.id, 'meeting_scheduled',
      'Meeting Booked',
      `${meetingType.replace(/_/g, ' ')} with ${request.prospect_name ?? 'prospect'} is booked for ${new Date(slot.start_time).toLocaleString()}.`,
      'success');
    await this.storeMemory(workspaceId, meeting.id, 'meeting_scheduled', {
      meetingType,
      prospect: request.prospect_name,
      company: request.company_name,
      scheduledAt: slot.start_time,
      calendarEventId: calendarResult.externalEventId,
      meetingLink: calendarResult.meetLink ?? null,
    });

    return meeting as MeetingSchedulerRecord;
  }

  /**
   * Book a prospect-confirmed exact time. This is used only after conversation
   * intelligence has extracted an explicit date/time with high confidence.
   * It re-checks Google Calendar before creating the event.
   */
  async scheduleMeetingAtTime(workspaceId: string, requestId: string, startIso: string, endIso: string, timezone = 'UTC'): Promise<MeetingSchedulerRecord | null> {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || start.getTime() <= Date.now()) {
      throw new Error('Invalid or expired prospect-confirmed meeting time');
    }

    const { data: freeBusy, error: freeBusyError } = await supabase.functions.invoke('google-calendar-booking', {
      body: { action: 'freebusy', workspace_id: workspaceId, time_min: start.toISOString(), time_max: end.toISOString(), timezone },
    });
    if (freeBusyError) throw new Error(freeBusyError.message);
    if ((freeBusy?.busy ?? []).length > 0) throw new Error('Prospect-confirmed time conflicts with the connected calendar');

    const { data: existingSlot } = await supabase.from('meeting_slots')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('meeting_request_id', requestId)
      .eq('start_time', start.toISOString())
      .maybeSingle();

    let slotId = existingSlot?.id as string | undefined;
    if (!slotId) {
      const { data: createdSlot, error: slotError } = await supabase.from('meeting_slots').insert({
        workspace_id: workspaceId,
        meeting_request_id: requestId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        slot_rank: 0,
        timezone,
        is_available: true,
        is_selected: true,
        is_offered: true,
        prospect_response: 'accepted',
      }).select('*').single();
      if (slotError) throw new Error(slotError.message);
      slotId = createdSlot.id;
    } else {
      await supabase.from('meeting_slots').update({ is_selected: true, prospect_response: 'accepted', is_available: true }).eq('id', slotId);
    }

    // scheduleMeeting prefers accepted slots, so this produces the same
    // idempotent Calendar/DB path as a prospect choosing an offered slot.
    return this.scheduleMeeting(workspaceId, requestId);
  }

  // ----------------------------------------------------------
  // STEP 5: Generate full preparation (brief, agenda, questions, competitor intel, checklist, score)
  // ----------------------------------------------------------

  async generateFullPreparation(workspaceId: string, meetingId: string): Promise<void> {
    const { data: meeting } = await supabase
      .from('meeting_scheduler')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle();
    if (!meeting) return;

    // Load context from previous phases
    const context = await this.loadMeetingContext(workspaceId, meeting as MeetingSchedulerRecord);

    // Single AI call for all preparation
    const result = await this.callAIPreparation(meeting as MeetingSchedulerRecord, context);

    // Persist brief
    await this.upsertBrief(workspaceId, meetingId, result.brief);

    // Persist agenda
    await this.upsertAgenda(workspaceId, meetingId, result.agenda);

    // Persist questions
    if (result.questions?.length) {
      await supabase.from('meeting_questions').insert(
        result.questions.map((q: { question_category: string; question_text: string; priority: string }) => ({
          workspace_id: workspaceId,
          meeting_id: meetingId,
          question_category: q.question_category,
          question_text: q.question_text,
          priority: q.priority ?? 'medium',
        })),
      );
    }

    // Persist competitor intel
    if (result.competitorIntel?.length) {
      await supabase.from('meeting_competitor_intel').insert(
        result.competitorIntel.map((c: { competitor_name: string; comparison?: Record<string, unknown>; weaknesses?: unknown[]; differentiators?: unknown[]; battle_cards?: unknown[]; objection_handling?: unknown[]; pricing_comparison?: Record<string, unknown>; migration_strategy?: string }) => ({
          workspace_id: workspaceId,
          meeting_id: meetingId,
          competitor_name: c.competitor_name,
          comparison: c.comparison ?? {},
          weaknesses: c.weaknesses ?? [],
          differentiators: c.differentiators ?? [],
          battle_cards: c.battle_cards ?? [],
          objection_handling: c.objection_handling ?? [],
          pricing_comparison: c.pricing_comparison ?? {},
          migration_strategy: c.migration_strategy ?? null,
        })),
      );
    }

    // Persist preparation
    await this.upsertPreparation(workspaceId, meetingId, result.preparation);

    // Persist checklist
    await this.upsertChecklist(workspaceId, meetingId, result.checklist);

    // Persist score
    await this.upsertScore(workspaceId, meetingId, result.score);

    // Persist reasoning
    if (result.reasoning?.length) {
      await supabase.from('meeting_ai_reasoning').insert(
        result.reasoning.map((r: { reasoning_type: string; reasoning_text: string; confidence?: number }) => ({
          workspace_id: workspaceId,
          meeting_id: meetingId,
          reasoning_type: r.reasoning_type,
          reasoning_text: r.reasoning_text,
          confidence: r.confidence ?? 0.7,
        })),
      );
    }

    // Populate knowledge graph
    await this.populateKnowledgeGraph(workspaceId, meetingId, result);

    // Create notification
    await this.createNotification(workspaceId, meetingId, 'brief_ready',
      'Meeting Brief Ready',
      `I've prepared the full meeting brief, agenda, discovery questions, and competitor battle cards.`,
      'success');
  }

  // ----------------------------------------------------------
  // AI Preparation call
  // ----------------------------------------------------------

  private async callAIPreparation(meeting: MeetingSchedulerRecord, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const systemPrompt = 'You are an elite meeting preparation AI for enterprise sales. You generate comprehensive meeting briefs, agendas, discovery questions, competitor intelligence, preparation checklists, and meeting scores. You always respond with valid JSON.';

    const userPrompt = `Generate complete meeting preparation for this meeting.

MEETING:
${JSON.stringify({
  type: meeting.meeting_type,
  title: meeting.meeting_title,
  prospect: meeting.prospect_name,
  title_role: meeting.prospect_title,
  company: meeting.company_name,
  duration: meeting.duration_minutes,
  scheduled: meeting.scheduled_start,
}, null, 2)}

CONTEXT FROM PREVIOUS PHASES:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks) with this structure:

{
  "brief": {
    "executive_summary": "1-paragraph summary",
    "company_overview": "Company background",
    "prospect_overview": "Prospect background",
    "timeline": [{"event": "Initial contact", "date": "2024-01-15"}],
    "conversation_summary": "Summary of conversation so far",
    "pain_points": [{"point": "Manual data entry", "severity": "high"}],
    "goals": [{"goal": "Reduce manual work", "priority": "high"}],
    "buying_signals": [{"signal": "Asked about pricing", "strength": 0.8}],
    "decision_makers": [{"name": "CTO", "role": "Technical decision maker"}],
    "objections": [{"objection": "Too expensive", "severity": "medium"}],
    "competitors": [{"name": "Competitor A", "threat_level": "medium"}],
    "technologies": [{"name": "Salesforce", "category": "CRM"}],
    "revenue_estimate": 50000,
    "likelihood_to_close": 0.4,
    "next_recommendation": "Focus on ROI and time savings",
    "confidence": 0.82
  },
  "agenda": {
    "agenda_items": [
      {"item": "Introduction", "duration_minutes": 5, "type": "intro"},
      {"item": "Discovery", "duration_minutes": 10, "type": "discovery"},
      {"item": "Pain Points Discussion", "duration_minutes": 10, "type": "discussion"},
      {"item": "Demo", "duration_minutes": 15, "type": "demo"},
      {"item": "ROI Discussion", "duration_minutes": 10, "type": "roi"},
      {"item": "Pricing", "duration_minutes": 5, "type": "pricing"},
      {"item": "Next Steps", "duration_minutes": 5, "type": "next_steps"}
    ],
    "total_duration_minutes": 30
  },
  "questions": [
    {"question_category": "business", "question_text": "What are your top priorities this quarter?", "priority": "high"},
    {"question_category": "technical", "question_text": "What tools are you currently using?", "priority": "high"},
    {"question_category": "budget", "question_text": "How is your budget allocated?", "priority": "medium"},
    {"question_category": "timeline", "question_text": "When do you need a solution in place?", "priority": "high"},
    {"question_category": "decision_process", "question_text": "Who else is involved in the decision?", "priority": "high"},
    {"question_category": "current_tools", "question_text": "What CRM are you using today?", "priority": "medium"},
    {"question_category": "competitors", "question_text": "Are you evaluating other solutions?", "priority": "medium"},
    {"question_category": "success_metrics", "question_text": "How do you measure success?", "priority": "medium"},
    {"question_category": "risks", "question_text": "What concerns do you have?", "priority": "low"},
    {"question_category": "expansion_opportunities", "question_text": "Are there other teams that could benefit?", "priority": "low"}
  ],
  "competitorIntel": [
    {
      "competitor_name": "Competitor A",
      "comparison": {"our_strength": "Better AI", "their_strength": "Lower price"},
      "weaknesses": ["Limited integrations", "No AI"],
      "differentiators": ["AI-powered", "Better UX", "More integrations"],
      "battle_cards": [{"situation": "They mention price", "response": "Focus on ROI and time saved"}],
      "objection_handling": [{"objection": "They're cheaper", "response": "Our AI saves 10 hours/week"}],
      "pricing_comparison": {"us": "$500/mo", "them": "$200/mo"},
      "migration_strategy": "We offer free migration assistance"
    }
  ],
  "preparation": {
    "proposal_checklist": [{"item": "ROI calculator ready", "done": false}, {"item": "Case studies selected", "done": false}],
    "roi_data": {"time_saved_hours_week": 10, "annual_savings": 52000},
    "case_studies": [{"name": "Acme Corp", "industry": "SaaS", "result": "50% efficiency gain"}],
    "trust_signals": [{"signal": "SOC2 certified", "type": "security"}],
    "testimonials": [{"quote": "Great product", "author": "VP Sales, TechCorp"}],
    "relevant_industries": ["SaaS", "FinTech"],
    "pricing_recommendation": "Start with Pro plan at $500/mo",
    "offer_recommendation": "Offer 20% discount for annual commitment"
  },
  "checklist": {
    "checklist_items": [
      {"item": "Review prospect LinkedIn profile", "done": false, "category": "research"},
      {"item": "Prepare demo environment", "done": false, "category": "demo"},
      {"item": "Send calendar invite", "done": false, "category": "logistics"},
      {"item": "Prepare ROI calculator", "done": false, "category": "preparation"},
      {"item": "Review competitor battle cards", "done": false, "category": "competitive"}
    ],
    "completion_percentage": 0
  },
  "score": {
    "preparation_score": 60,
    "qualification_score": 70,
    "revenue_score": 65,
    "likelihood_to_close": 40,
    "risk_score": 25,
    "overall_score": 65,
    "score_explanation": {
      "preparation": "Brief and agenda ready, needs demo prep",
      "qualification": "Strong buying signals detected",
      "revenue": "Mid-market opportunity"
    },
    "confidence": 0.78
  },
  "reasoning": [
    {"reasoning_type": "meeting_detection", "reasoning_text": "Prospect asked for a demo, indicating high intent", "confidence": 0.85},
    {"reasoning_type": "meeting_type", "reasoning_text": "Demo is appropriate because prospect is in evaluating stage", "confidence": 0.8},
    {"reasoning_type": "attendees", "reasoning_text": "CTO should attend because technical questions are expected", "confidence": 0.75},
    {"reasoning_type": "timing", "reasoning_text": "Morning slot preferred based on prospect timezone", "confidence": 0.7}
  ]
}

Return ONLY the JSON object.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 8000,
      workspaceId: meeting.workspace_id,
      agentName: 'meeting_intelligence_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
  }

  // ----------------------------------------------------------
  // Confirm meeting
  // ----------------------------------------------------------

  async confirmMeeting(workspaceId: string, meetingId: string, confirmedBy: 'prospect' | 'ai' | 'human' = 'ai'): Promise<void> {
    await supabase.from('meeting_scheduler').update({ status: 'confirmed' }).eq('id', meetingId);
    await supabase.from('meeting_confirmations').insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      confirmed_by: confirmedBy,
      confirmation_method: confirmedBy === 'ai' ? 'auto' : 'manual',
    });
    await this.recordVersion(workspaceId, meetingId, 'meeting_confirmed', confirmedBy);
    await this.createNotification(workspaceId, meetingId, 'meeting_confirmed',
      'Meeting Confirmed',
      'Meeting has been confirmed. Calendar invite and preparation materials are ready.',
      'success');
  }

  // ----------------------------------------------------------
  // Reschedule meeting
  // ----------------------------------------------------------

  async rescheduleMeeting(workspaceId: string, meetingId: string, newStart: string, newEnd: string, reason?: string): Promise<void> {
    const { data: meeting, error } = await supabase.from('meeting_scheduler')
      .select('scheduled_start,scheduled_end,calendar_event_id,timezone,meeting_title,meeting_description')
      .eq('id', meetingId).eq('workspace_id', workspaceId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!meeting) return;
    if (!meeting.calendar_event_id) throw new Error('Meeting is missing its Google Calendar event id');

    const { error: calendarError } = await supabase.functions.invoke('google-calendar-booking', {
      body: {
        action: 'update',
        workspace_id: workspaceId,
        event_id: meeting.calendar_event_id,
        start: newStart,
        end: newEnd,
        timezone: meeting.timezone,
        summary: meeting.meeting_title,
        description: meeting.meeting_description,
      },
    });
    if (calendarError) throw new Error(`Google Calendar reschedule failed: ${calendarError.message}`);

    await supabase.from('meeting_reschedules').insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      previous_start: meeting.scheduled_start,
      previous_end: meeting.scheduled_end,
      new_start: newStart,
      new_end: newEnd,
      rescheduled_by: 'ai',
      reason: reason ?? 'Auto-rescheduled',
    });
    await supabase.from('meeting_scheduler').update({ scheduled_start: newStart, scheduled_end: newEnd, status: 'rescheduled' }).eq('id', meetingId).eq('workspace_id', workspaceId);
    await this.recordVersion(workspaceId, meetingId, 'meeting_rescheduled', 'ai');
  }

  // ----------------------------------------------------------
  // Cancel meeting
  // ----------------------------------------------------------

  async cancelMeeting(workspaceId: string, meetingId: string, reason?: string): Promise<void> {
    const { data: meeting, error } = await supabase.from('meeting_scheduler').select('calendar_event_id').eq('id', meetingId).eq('workspace_id', workspaceId).maybeSingle();
    if (error) throw new Error(error.message);
    if (meeting?.calendar_event_id) {
      const { error: calendarError } = await supabase.functions.invoke('google-calendar-booking', {
        body: { action: 'delete', workspace_id: workspaceId, event_id: meeting.calendar_event_id },
      });
      if (calendarError) throw new Error(`Google Calendar cancellation failed: ${calendarError.message}`);
    }
    await supabase.from('meeting_scheduler').update({ status: 'cancelled' }).eq('id', meetingId).eq('workspace_id', workspaceId);
    await supabase.from('meeting_cancellations').insert({ workspace_id: workspaceId, meeting_id: meetingId, cancelled_by: 'ai', reason: reason ?? 'Cancelled by system' });
    await this.recordVersion(workspaceId, meetingId, 'meeting_cancelled', 'ai');
  }

  // ----------------------------------------------------------
  // Record meeting outcome
  // ----------------------------------------------------------

  async recordOutcome(workspaceId: string, meetingId: string, outcome: {
    outcome: string;
    attendance_status?: string;
    qualification_result?: string;
    next_followup?: string;
    followup_notes?: string;
    deal_value?: number;
    next_action?: string;
  }): Promise<void> {
    const { data: existing } = await supabase
      .from('meeting_outcomes')
      .select('id, version')
      .eq('meeting_id', meetingId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase.from('meeting_outcomes').update({
        outcome: outcome.outcome,
        attendance_status: outcome.attendance_status ?? 'attended',
        qualification_result: outcome.qualification_result ?? null,
        next_followup: outcome.next_followup ?? null,
        followup_notes: outcome.followup_notes ?? null,
        deal_value: outcome.deal_value ?? null,
        next_action: outcome.next_action ?? null,
      }).eq('id', existing.id);
    } else {
      await supabase.from('meeting_outcomes').insert({
        workspace_id: workspaceId,
        meeting_id: meetingId,
        outcome: outcome.outcome,
        attendance_status: outcome.attendance_status ?? 'attended',
        qualification_result: outcome.qualification_result ?? null,
        next_followup: outcome.next_followup ?? null,
        followup_notes: outcome.followup_notes ?? null,
        deal_value: outcome.deal_value ?? null,
        next_action: outcome.next_action ?? null,
      });
    }

    await supabase.from('meeting_scheduler').update({ status: 'completed' }).eq('id', meetingId);
    await this.recordVersion(workspaceId, meetingId, 'outcome_recorded', 'ai');

    // Generate follow-ups
    await this.generateFollowups(workspaceId, meetingId, outcome);
  }

  // ----------------------------------------------------------
  // Generate follow-ups after meeting
  // ----------------------------------------------------------

  async generateFollowups(workspaceId: string, meetingId: string, outcome: Record<string, unknown>): Promise<void> {
    const followups: Array<{ followup_type: string; followup_content: string; due_date: string | null }> = [];

    followups.push({
      followup_type: 'summary',
      followup_content: 'Generate meeting summary and send to prospect',
      due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    if (outcome.outcome === 'moved_to_opportunity') {
      followups.push({
        followup_type: 'proposal_reminder',
        followup_content: 'Prepare and send proposal within 48 hours',
        due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (outcome.outcome === 'followup_scheduled') {
      followups.push({
        followup_type: 'next_meeting',
        followup_content: 'Schedule follow-up meeting',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    followups.push({
      followup_type: 'linkedin',
      followup_content: 'Send LinkedIn follow-up message to prospect',
      due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });

    followups.push({
      followup_type: 'email',
      followup_content: 'Send thank-you email with meeting notes',
      due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    await supabase.from('meeting_followups').insert(
      followups.map((f) => ({
        workspace_id: workspaceId,
        meeting_id: meetingId,
        followup_type: f.followup_type,
        followup_content: f.followup_content,
        due_date: f.due_date,
        is_completed: false,
      })),
    );

    await this.createNotification(workspaceId, meetingId, 'followup_due',
      'Follow-ups Generated',
      'I\'ve generated post-meeting follow-ups including summary, email, and LinkedIn message.',
      'info');
  }

  // ----------------------------------------------------------
  // Load dashboard
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<MeetingIntelligenceDashboard> {
    const [meetingsData, requestsData, candidatesData, slotsData, notificationsData, prefsData] = await Promise.all([
      supabase.from('meeting_scheduler').select('*').eq('workspace_id', workspaceId).order('scheduled_start', { ascending: false }).limit(50),
      supabase.from('meeting_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(30),
      supabase.from('meeting_candidates').select('*').eq('workspace_id', workspaceId).order('overall_score', { ascending: false }).limit(20),
      supabase.from('meeting_slots').select('*').eq('workspace_id', workspaceId).order('start_time', { ascending: true }).limit(30),
      supabase.from('meeting_notifications').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      supabase.from('meeting_preferences').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    ]);

    const meetings = (meetingsData.data ?? []) as MeetingSchedulerRecord[];
    const fullMeetings: MeetingWithIntelligence[] = [];

    for (const m of meetings) {
      const intel = await this.loadMeetingIntelligence(workspaceId, m.id);
      if (intel) fullMeetings.push(intel);
    }

    const today = new Date().toISOString().split('T')[0];
    const meetingsToday = meetings.filter((m) => m.scheduled_start.startsWith(today)).length;
    const pendingScheduling = (requestsData.data ?? []).filter((r: MeetingRequest) => r.status === 'pending').length;
    const awaitingConfirmation = meetings.filter((m) => m.status === 'pending_confirmation').length;
    const preparationNeeded = fullMeetings.filter((m) => m.checklist && m.checklist.completion_percentage < 100).length;
    const avgScore = fullMeetings.length > 0 ? Math.round(fullMeetings.reduce((s, m) => s + (m.score?.overall_score ?? 0), 0) / fullMeetings.length) : 0;
    const forecastRevenue = fullMeetings.reduce((s, m) => s + (m.meeting.revenue_estimate ?? 0), 0);

    return {
      totalMeetings: meetings.length,
      meetingsToday,
      pendingScheduling,
      awaitingConfirmation,
      preparationNeeded,
      avgMeetingScore: avgScore,
      forecastRevenue,
      meetings: fullMeetings,
      pendingRequests: (requestsData.data ?? []) as MeetingRequest[],
      candidates: (candidatesData.data ?? []) as MeetingCandidate[],
      slots: (slotsData.data ?? []) as MeetingSlot[],
      notifications: (notificationsData.data ?? []) as MeetingNotification[],
      preferences: (prefsData.data ?? null) as MeetingPreferences | null,
      topMeetings: fullMeetings.sort((a, b) => (b.score?.overall_score ?? 0) - (a.score?.overall_score ?? 0)).slice(0, 10),
    };
  }

  // ----------------------------------------------------------
  // Load full intelligence for a single meeting
  // ----------------------------------------------------------

  async loadMeetingIntelligence(workspaceId: string, meetingId: string): Promise<MeetingWithIntelligence | null> {
    const { data: meeting } = await supabase.from('meeting_scheduler').select('*').eq('id', meetingId).maybeSingle();
    if (!meeting) return null;

    const [brief, agenda, preparation, checklist, competitorIntel, questions, attendees, followups, outcome, score, reasoning, confirmations, notes] = await Promise.all([
      supabase.from('meeting_briefs').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_agendas').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_preparation').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_checklists').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_competitor_intel').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }),
      supabase.from('meeting_questions').select('*').eq('meeting_id', meetingId).order('priority', { ascending: false }),
      supabase.from('meeting_attendees').select('*').eq('meeting_id', meetingId),
      supabase.from('meeting_followups').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: false }),
      supabase.from('meeting_outcomes').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_score').select('*').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meeting_ai_reasoning').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: false }),
      supabase.from('meeting_confirmations').select('*').eq('meeting_id', meetingId).order('confirmed_at', { ascending: false }),
      supabase.from('meeting_notes').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: false }),
    ]);

    return {
      meeting: meeting as MeetingSchedulerRecord,
      brief: (brief.data ?? null) as MeetingBrief | null,
      agenda: (agenda.data ?? null) as MeetingAgenda | null,
      preparation: (preparation.data ?? null) as MeetingPreparation | null,
      checklist: (checklist.data ?? null) as MeetingChecklist | null,
      competitorIntel: (competitorIntel.data ?? []) as MeetingCompetitorIntel[],
      questions: (questions.data ?? []) as MeetingQuestion[],
      attendees: (attendees.data ?? []) as MeetingAttendee[],
      followups: (followups.data ?? []) as MeetingFollowup[],
      outcome: (outcome.data ?? null) as MeetingOutcomeRecord | null,
      score: (score.data ?? null) as MeetingScore | null,
      reasoning: (reasoning.data ?? []) as MeetingAIReasoning[],
      confirmations: (confirmations.data ?? []) as MeetingConfirmation[],
      notes: (notes.data ?? []) as MeetingNote[],
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private determineMeetingType(intent: string, buyingStage: string | undefined): MeetingTypeCode {
    if (intent === 'demo_request') return 'demo';
    if (intent === 'pricing_request') return 'pricing_discussion';
    if (buyingStage === 'evaluating') return 'demo';
    if (buyingStage === 'decision') return 'proposal_review';
    if (buyingStage === 'negotiation') return 'negotiation';
    if (buyingStage === 'interested') return 'discovery';
    return 'discovery';
  }

  private estimateDuration(type: MeetingTypeCode): number {
    const durations: Record<string, number> = {
      discovery: 30, intro_call: 15, demo: 45, technical_demo: 60,
      pricing_discussion: 30, proposal_review: 45, security_review: 60,
      compliance_review: 60, executive_meeting: 30, negotiation: 60,
    };
    return durations[type] ?? 30;
  }

  private async loadPreferences(workspaceId: string): Promise<MeetingPreferences | null> {
    const { data } = await supabase.from('meeting_preferences').select('*').eq('workspace_id', workspaceId).maybeSingle();
    return data as MeetingPreferences | null;
  }

  private async loadMeetingContext(workspaceId: string, meeting: MeetingSchedulerRecord): Promise<Record<string, unknown>> {
    const [company, conversation, personalization, revenueDNA] = await Promise.all([
      meeting.company_id ? supabase.from('companies').select('*').eq('id', meeting.company_id).maybeSingle() : Promise.resolve({ data: null }),
      meeting.conversation_id ? supabase.from('conversations').select('buying_stage, meeting_readiness_level, status').eq('id', meeting.conversation_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('personalization_profiles').select('communication_style, tone, value_proposition, pain_point_references, trust_signals').eq('workspace_id', workspaceId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('revenue_dna_profiles').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    let memoryContext: Record<string, unknown> = {};
    try {
      const memories = await memoryEngine.getMemoriesByEntity('meeting', meeting.id, workspaceId);
      memoryContext = { memoryCount: memories.length };
    } catch { /* best-effort */ }

    return {
      company: company.data,
      conversation: conversation.data,
      personalization: personalization.data,
      revenueDNA: revenueDNA.data,
      memory: memoryContext,
    };
  }

  private async upsertBrief(workspaceId: string, meetingId: string, brief: Record<string, unknown>): Promise<void> {
    const { data: existing } = await supabase.from('meeting_briefs').select('id, version').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      await supabase.from('meeting_briefs').update({
        executive_summary: brief.executive_summary ?? null,
        company_overview: brief.company_overview ?? null,
        prospect_overview: brief.prospect_overview ?? null,
        timeline: brief.timeline ?? [],
        conversation_summary: brief.conversation_summary ?? null,
        pain_points: brief.pain_points ?? [],
        goals: brief.goals ?? [],
        buying_signals: brief.buying_signals ?? [],
        decision_makers: brief.decision_makers ?? [],
        objections: brief.objections ?? [],
        competitors: brief.competitors ?? [],
        technologies: brief.technologies ?? [],
        revenue_estimate: brief.revenue_estimate ?? null,
        likelihood_to_close: brief.likelihood_to_close ?? 0.3,
        next_recommendation: brief.next_recommendation ?? null,
        confidence: brief.confidence ?? 0.5,
      }).eq('id', existing.id);
    } else {
      await supabase.from('meeting_briefs').insert({
        workspace_id: workspaceId, meeting_id: meetingId,
        executive_summary: brief.executive_summary ?? null,
        company_overview: brief.company_overview ?? null,
        prospect_overview: brief.prospect_overview ?? null,
        timeline: brief.timeline ?? [],
        conversation_summary: brief.conversation_summary ?? null,
        pain_points: brief.pain_points ?? [],
        goals: brief.goals ?? [],
        buying_signals: brief.buying_signals ?? [],
        decision_makers: brief.decision_makers ?? [],
        objections: brief.objections ?? [],
        competitors: brief.competitors ?? [],
        technologies: brief.technologies ?? [],
        revenue_estimate: brief.revenue_estimate ?? null,
        likelihood_to_close: brief.likelihood_to_close ?? 0.3,
        next_recommendation: brief.next_recommendation ?? null,
        confidence: brief.confidence ?? 0.5,
      });
    }
  }

  private async upsertAgenda(workspaceId: string, meetingId: string, agenda: Record<string, unknown>): Promise<void> {
    const { data: existing } = await supabase.from('meeting_agendas').select('id').eq('meeting_id', meetingId).maybeSingle();
    if (existing) {
      await supabase.from('meeting_agendas').update({
        agenda_items: agenda.agenda_items ?? [],
        total_duration_minutes: agenda.total_duration_minutes ?? 30,
      }).eq('id', existing.id);
    } else {
      await supabase.from('meeting_agendas').insert({
        workspace_id: workspaceId, meeting_id: meetingId,
        agenda_items: agenda.agenda_items ?? [],
        total_duration_minutes: agenda.total_duration_minutes ?? 30,
      });
    }
  }

  private async upsertPreparation(workspaceId: string, meetingId: string, prep: Record<string, unknown>): Promise<void> {
    const { data: existing } = await supabase.from('meeting_preparation').select('id').eq('meeting_id', meetingId).maybeSingle();
    const record = {
      proposal_checklist: prep.proposal_checklist ?? [],
      roi_data: prep.roi_data ?? {},
      case_studies: prep.case_studies ?? [],
      trust_signals: prep.trust_signals ?? [],
      testimonials: prep.testimonials ?? [],
      relevant_industries: prep.relevant_industries ?? [],
      pricing_recommendation: prep.pricing_recommendation ?? null,
      offer_recommendation: prep.offer_recommendation ?? null,
    };
    if (existing) {
      await supabase.from('meeting_preparation').update(record).eq('id', existing.id);
    } else {
      await supabase.from('meeting_preparation').insert({ workspace_id: workspaceId, meeting_id: meetingId, ...record });
    }
  }

  private async upsertChecklist(workspaceId: string, meetingId: string, checklist: Record<string, unknown>): Promise<void> {
    const { data: existing } = await supabase.from('meeting_checklists').select('id').eq('meeting_id', meetingId).maybeSingle();
    const record = {
      checklist_items: checklist.checklist_items ?? [],
      completion_percentage: checklist.completion_percentage ?? 0,
    };
    if (existing) {
      await supabase.from('meeting_checklists').update(record).eq('id', existing.id);
    } else {
      await supabase.from('meeting_checklists').insert({ workspace_id: workspaceId, meeting_id: meetingId, ...record });
    }
  }

  private async upsertScore(workspaceId: string, meetingId: string, score: Record<string, unknown>): Promise<void> {
    const { data: existing } = await supabase.from('meeting_score').select('id, version').eq('meeting_id', meetingId).order('version', { ascending: false }).limit(1).maybeSingle();
    const record = {
      preparation_score: score.preparation_score ?? 0,
      qualification_score: score.qualification_score ?? 0,
      revenue_score: score.revenue_score ?? 0,
      likelihood_to_close: score.likelihood_to_close ?? 0,
      risk_score: score.risk_score ?? 0,
      overall_score: score.overall_score ?? 0,
      score_explanation: score.score_explanation ?? {},
      confidence: score.confidence ?? 0.5,
      version: (existing?.version ?? 0) + 1,
    };
    if (existing) {
      await supabase.from('meeting_score').update(record).eq('id', existing.id);
    } else {
      await supabase.from('meeting_score').insert({ workspace_id: workspaceId, meeting_id: meetingId, ...record });
    }
  }

  private async recordVersion(workspaceId: string, meetingId: string, changeType: string, changedBy: 'ai' | 'human' | 'system'): Promise<void> {
    const { data: latest } = await supabase.from('meeting_versions').select('version_number').eq('meeting_id', meetingId).order('version_number', { ascending: false }).limit(1).maybeSingle();
    await supabase.from('meeting_versions').insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      version_number: (latest?.version_number ?? 0) + 1,
      changed_by: changedBy,
      change_type: changeType,
    });
  }

  private async createNotification(workspaceId: string, meetingId: string | null, type: string, title: string, message: string, severity: 'info' | 'warning' | 'error' | 'success'): Promise<void> {
    await supabase.from('meeting_notifications').insert({
      workspace_id: workspaceId,
      meeting_id: meetingId,
      notification_type: type,
      notification_title: title,
      notification_message: message,
      severity,
    });
    await supabase.from('notifications').upsert({
      workspace_id: workspaceId,
      event_key: meetingId ? `meeting:${meetingId}:${type}` : `meeting:${type}:${title}`,
      type,
      title,
      body: message,
      action_url: meetingId ? '/app/meetings' : '/app/meeting-intelligence',
      metadata: { meeting_id: meetingId, severity },
    }, { onConflict: 'workspace_id,event_key' }).then(() => {}, () => {});
  }

  private async storeMemory(workspaceId: string, entityId: string, memoryType: string, content: Record<string, unknown>): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'meeting',
        entityId,
        memoryType,
        title: `Meeting: ${content.prospect ?? 'Unknown'}`,
        summary: `${content.meetingType ?? 'Meeting'} scheduled for ${content.prospect ?? 'prospect'}`,
        content,
        confidenceScore: 0.8,
        importanceScore: 0.85,
        workspaceId,
      });
    } catch { /* best-effort */ }
  }

  private async populateKnowledgeGraph(workspaceId: string, meetingId: string, result: Record<string, unknown>): Promise<void> {
    try {
      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: [{
          nodeType: 'meeting' as never,
          externalId: `meeting_${meetingId}`,
          displayName: `Meeting: ${result.brief && typeof result.brief === 'object' ? 'Meeting' : 'Meeting'}`,
          properties: {
            meetingType: result.meetingType,
            overallScore: result.score && typeof result.score === 'object' ? (result.score as Record<string, unknown>).overall_score : 0,
          },
          confidenceScore: 0.8,
        }],
        relationships: [],
      });
    } catch { /* best-effort */ }
  }
}

export const meetingIntelligenceService = new MeetingIntelligenceService();
