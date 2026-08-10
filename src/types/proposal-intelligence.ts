// ============================================================
// Proposal Intelligence Types — Phase 11
// ============================================================

export type ProposalTriggerReason =
  | 'meeting_outcome' | 'buying_stage' | 'meeting_score'
  | 'conversation_rec' | 'manual';

export type ProposalRequestStatus = 'pending' | 'approved' | 'rejected' | 'generating' | 'generated' | 'expired';
export type ProposalUrgency = 'low' | 'medium' | 'high' | 'critical';

export type PackageTier = 'good' | 'better' | 'best' | 'enterprise' | 'custom';
export type OptionType = 'investment' | 'payment' | 'term' | 'addon';

export type PricingModel =
  | 'fixed_price' | 'subscription' | 'retainer' | 'usage_based'
  | 'per_seat' | 'enterprise' | 'hybrid' | 'multi_year' | 'one_time';

export type ProposalLifecycleStatus =
  | 'draft' | 'generating' | 'review' | 'approved' | 'sent' | 'viewed'
  | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' | 'revised';

export type ApprovalType = 'internal' | 'pricing' | 'legal' | 'finance' | 'executive' | 'version';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type SignatureStatus = 'pending' | 'signed' | 'declined' | 'expired';
export type DeliveryMethod = 'email' | 'link' | 'portal' | 'pdf' | 'in_person';
export type ActivityType = 'comment' | 'question' | 'revision_request' | 'status_change' | 'approval' | 'signature' | 'view' | 'download' | 'share';

export type ProposalNotificationType =
  | 'proposal_ready' | 'approval_needed' | 'proposal_sent' | 'proposal_viewed'
  | 'proposal_accepted' | 'proposal_rejected' | 'negotiation_started'
  | 'signature_requested' | 'version_created' | 'expiring_soon' | 'expired'
  | 'revision_requested' | 'pricing_approved' | 'legal_review_needed';

export type ProposalReasoningType =
  | 'pricing' | 'roi' | 'timeline' | 'package' | 'discount'
  | 'structure' | 'negotiation' | 'delivery';

export type ProposalOutcomeType =
  | 'pending' | 'accepted' | 'rejected' | 'negotiating' | 'expired' | 'withdrawn' | 'revised';

export type DiscountRuleType =
  | 'volume' | 'annual_commit' | 'multi_year' | 'startup' | 'nonprofit'
  | 'loyalty' | 'strategic' | 'custom';

export type PaymentPlanType = 'monthly' | 'quarterly' | 'annual' | 'milestone' | 'upfront' | 'hybrid';
export type ContractTermType = 'payment' | 'delivery' | 'warranty' | 'ip' | 'confidentiality' | 'termination' | 'sla' | 'liability' | 'governing_law' | 'custom';

// ============================================================
// Database Record Types
// ============================================================

export interface ProposalRequest {
  id: string;
  workspace_id: string;
  meeting_id: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  project_id: string | null;
  prospect_name: string | null;
  company_name: string | null;
  trigger_reason: ProposalTriggerReason;
  trigger_data: Record<string, unknown>;
  buying_stage: string | null;
  meeting_score: number | null;
  estimated_deal_value: number | null;
  urgency: ProposalUrgency;
  confidence_score: number;
  reasoning: string | null;
  status: ProposalRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface ProposalPackage {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  package_tier: PackageTier;
  package_name: string;
  description: string | null;
  features: unknown[];
  deliverables: unknown[];
  timeline_weeks: number | null;
  price: number | null;
  roi_estimate: Record<string, unknown>;
  recommended_audience: string | null;
  is_recommended: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProposalOption {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  option_name: string;
  option_type: OptionType;
  description: string | null;
  investment_amount: number | null;
  term_months: number | null;
  monthly_cost: number | null;
  total_cost: number | null;
  savings_estimate: number | null;
  benefits: unknown[];
  is_recommended: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProposalROI {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  investment_amount: number;
  annual_savings: number | null;
  revenue_increase: number | null;
  productivity_gain_hours: number | null;
  productivity_gain_value: number | null;
  payback_period_months: number | null;
  break_even_month: number | null;
  roi_1_year: number | null;
  roi_3_year: number | null;
  roi_5_year: number | null;
  business_impact: string | null;
  total_3_year_value: number | null;
  total_5_year_value: number | null;
  confidence: number;
  version: number;
  created_at: string;
}

export interface ProposalBusinessCase {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  problem_statement: string;
  financial_impact: string | null;
  opportunity_cost: string | null;
  recommended_investment: string | null;
  expected_return: string | null;
  strategic_benefits: unknown[];
  operational_benefits: unknown[];
  executive_summary: string | null;
  version: number;
  created_at: string;
}

export interface ProposalTimelinePhase {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  phase_name: string;
  phase_description: string | null;
  start_week: number | null;
  end_week: number | null;
  milestones: unknown[];
  deliverables: unknown[];
  dependencies: unknown[];
  sort_order: number;
  created_at: string;
}

export interface ProposalScopeItem {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  scope_item: string;
  scope_type: 'included' | 'excluded' | 'optional' | 'addon';
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProposalDeliverable {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  deliverable_name: string;
  description: string | null;
  delivery_week: number | null;
  acceptance_criteria: string | null;
  dependencies: unknown[];
  sort_order: number;
  created_at: string;
}

export interface ProposalAssumption {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  assumption_text: string;
  assumption_type: string;
  impact: string | null;
  created_at: string;
}

export interface ProposalDependency {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  dependency_text: string;
  dependency_type: string;
  mitigation: string | null;
  created_at: string;
}

export interface ProposalRisk {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  risk_text: string;
  risk_type: string;
  probability: string;
  impact: string;
  mitigation: string | null;
  created_at: string;
}

export interface ProposalTeamMember {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  member_name: string;
  member_role: string | null;
  member_email: string | null;
  responsibilities: unknown[];
  allocation_percentage: number;
  is_internal: boolean;
  created_at: string;
}

export interface ProposalCaseStudy {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  case_study_name: string;
  industry: string | null;
  company_size: string | null;
  challenge: string | null;
  solution: string | null;
  results: unknown[];
  relevance_score: number;
  sort_order: number;
  created_at: string;
}

export interface ProposalTestimonial {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  quote: string;
  author_name: string | null;
  author_title: string | null;
  author_company: string | null;
  industry: string | null;
  relevance_score: number;
  sort_order: number;
  created_at: string;
}

export interface ProposalContractTerm {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  term_name: string;
  term_type: ContractTermType;
  term_text: string;
  is_negotiable: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProposalPaymentPlan {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  plan_name: string;
  plan_type: PaymentPlanType;
  total_amount: number | null;
  installment_count: number | null;
  installment_amount: number | null;
  payment_terms: string | null;
  discount_percentage: number | null;
  is_recommended: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProposalDiscountRule {
  id: string;
  workspace_id: string;
  rule_name: string;
  rule_type: DiscountRuleType;
  discount_percentage: number;
  min_contract_value: number | null;
  conditions: Record<string, unknown>;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ProposalApproval {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  approval_type: ApprovalType;
  approver_name: string;
  approver_role: string | null;
  approval_status: ApprovalStatus;
  approval_notes: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ProposalNegotiation {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  negotiation_round: number;
  predicted_objections: unknown[];
  pricing_concerns: unknown[];
  competitor_comparison: unknown[];
  discount_requests: unknown[];
  risk_concerns: unknown[];
  negotiation_guidance: string | null;
  fallback_offers: unknown[];
  alternative_packages: unknown[];
  concessions: unknown[];
  red_lines: unknown[];
  confidence: number;
  created_at: string;
}

export interface ProposalSignature {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_role: string | null;
  signature_status: SignatureStatus;
  signed_at: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ProposalStatusRecord {
  id: string;
  workspace_id: string;
  project_id: string;
  status: ProposalLifecycleStatus;
  status_reason: string | null;
  changed_by: 'ai' | 'human' | 'system';
  created_at: string;
}

export interface ProposalDelivery {
  id: string;
  workspace_id: string;
  project_id: string;
  version_id: string | null;
  delivery_method: DeliveryMethod;
  delivery_url: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  sent_at: string | null;
  opened_at: string | null;
  first_view_at: string | null;
  last_view_at: string | null;
  view_count: number;
  time_spent_seconds: number;
  download_count: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
}

export interface ProposalView {
  id: string;
  workspace_id: string;
  project_id: string;
  delivery_id: string;
  section_name: string | null;
  time_spent_seconds: number;
  viewed_at: string;
}

export interface ProposalActivity {
  id: string;
  workspace_id: string;
  project_id: string;
  activity_type: ActivityType;
  activity_text: string | null;
  activity_data: Record<string, unknown>;
  actor_name: string | null;
  actor_type: 'internal' | 'external' | 'system' | 'ai';
  created_at: string;
}

export interface ProposalNotification {
  id: string;
  workspace_id: string;
  project_id: string | null;
  notification_type: ProposalNotificationType;
  notification_title: string;
  notification_message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface ProposalAIReasoning {
  id: string;
  workspace_id: string;
  project_id: string;
  reasoning_type: ProposalReasoningType;
  reasoning_text: string;
  reasoning_data: Record<string, unknown>;
  confidence: number;
  created_at: string;
}

export interface ProposalScore {
  id: string;
  workspace_id: string;
  project_id: string;
  win_probability: number;
  pricing_strength: number;
  competitive_position: number;
  roi_quality: number;
  proposal_quality: number;
  relationship_strength: number;
  decision_confidence: number;
  overall_score: number;
  score_explanation: Record<string, string>;
  confidence: number;
  version: number;
  created_at: string;
}

export interface ProposalOutcome {
  id: string;
  workspace_id: string;
  project_id: string;
  outcome: ProposalOutcomeType;
  outcome_reason: string | null;
  final_deal_value: number | null;
  final_discount_percentage: number | null;
  negotiation_rounds: number;
  time_to_close_days: number | null;
  win_loss_factors: unknown[];
  lessons_learned: unknown[];
  version: number;
  created_at: string;
}

// ============================================================
// Composite Proposal with Intelligence
// ============================================================

export interface ProposalWithIntelligence {
  project: {
    id: string;
    workspace_id: string;
    company_id: string | null;
    project_name: string;
    proposal_type: string;
    status: string;
    priority: string;
    strategy: Record<string, unknown>;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  latestVersion: {
    id: string;
    version_number: number;
    executive_summary: string | null;
    content: Record<string, unknown>;
    is_latest: boolean;
    created_at: string;
  } | null;
  packages: ProposalPackage[];
  options: ProposalOption[];
  roi: ProposalROI | null;
  businessCase: ProposalBusinessCase | null;
  timeline: ProposalTimelinePhase[];
  scope: ProposalScopeItem[];
  deliverables: ProposalDeliverable[];
  assumptions: ProposalAssumption[];
  dependencies: ProposalDependency[];
  risks: ProposalRisk[];
  team: ProposalTeamMember[];
  caseStudies: ProposalCaseStudy[];
  testimonials: ProposalTestimonial[];
  contractTerms: ProposalContractTerm[];
  paymentPlans: ProposalPaymentPlan[];
  approvals: ProposalApproval[];
  negotiation: ProposalNegotiation | null;
  signatures: ProposalSignature[];
  statusHistory: ProposalStatusRecord[];
  deliveries: ProposalDelivery[];
  activity: ProposalActivity[];
  score: ProposalScore | null;
  reasoning: ProposalAIReasoning[];
  outcome: ProposalOutcome | null;
}

// ============================================================
// Dashboard
// ============================================================

export interface ProposalIntelligenceDashboard {
  totalProposals: number;
  awaitingApproval: number;
  sent: number;
  viewed: number;
  negotiating: number;
  accepted: number;
  rejected: number;
  avgWinProbability: number;
  forecastRevenue: number;
  proposals: ProposalWithIntelligence[];
  pendingRequests: ProposalRequest[];
  notifications: ProposalNotification[];
  topProposals: ProposalWithIntelligence[];
}
