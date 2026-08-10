// ============================================================
// Mock Data — Market Intelligence Agent
// ============================================================
//
// Realistic market intelligence for Yuktris (the product itself):
// AI-powered B2B Sales Platform.
// Simulates what Tavily + OpenAI + Firecrawl would produce.

import type {
  MarketAnalysis,
  IndustryAnalysis,
  CountryAnalysis,
  CompetitorAnalysis,
  TrendAnalysis,
  BuyingSignal,
  CompetitionLevel,
  Priority,
  ImpactLevel,
} from '@/types/market-intelligence';

// ============================================================
// Market Analysis (main record)
// ============================================================

export const MOCK_MARKET_ANALYSIS: Omit<MarketAnalysis, 'id' | 'workspace_id' | 'business_analysis_id' | 'created_at' | 'updated_at'> = {
  market_status: 'completed',
  market_size: '$18.2B (Global Sales Engagement Market, 2026)',
  growth_score: 82,
  competition_score: 71,
  opportunity_score: 88,
  confidence_score: 90,
  recommended_strategy: 'Focus on mid-market B2B SaaS companies (50–500 employees) in the US, UK, and Canada. Position as the AI-native alternative to legacy sales engagement platforms. Lead with intent-driven outreach as the primary differentiator. Target VP Sales and RevOps leaders with a land-and-expand motion starting at $299/mo. Expand into DACH and Nordics in Phase 2 after establishing 100+ North American customers.',
  executive_summary:
    'The sales engagement and revenue intelligence market is valued at $18.2B globally and growing at 14.2% CAGR. AI-powered outreach is the fastest-growing segment at 28% YoY. The market is dominated by legacy players (Outreach, SalesLoft) with limited AI capabilities, creating a significant opening for AI-native platforms. Key opportunities exist in mid-market B2B SaaS (50–500 employees) where buyers are tech-savvy, budgets are growing, and the need for efficient outreach is acute. The US, UK, and Canada represent 65% of the addressable market. Hiring activity, funding rounds, and leadership changes at target companies are the strongest buying signals. Recommended GTM: product-led growth with a self-serve entry point, expanding via land-and-expand. Differentiate through integrated intent data and AI personalization at a 50–70% price discount to enterprise alternatives.',
  error_message: null,
};

// ============================================================
// Industry Analysis
// ============================================================

export const MOCK_INDUSTRIES: Omit<IndustryAnalysis, 'id' | 'market_analysis_id'>[] = [
  { industry_name: 'B2B SaaS', market_size: '$6.8B addressable', growth_rate: '18% YoY', competition_level: 'high', opportunity_score: 94, priority: 'critical', recommended: true },
  { industry_name: 'Fintech', market_size: '$3.2B addressable', growth_rate: '22% YoY', competition_level: 'high', opportunity_score: 86, priority: 'high', recommended: true },
  { industry_name: 'Marketing & AdTech', market_size: '$2.1B addressable', growth_rate: '15% YoY', competition_level: 'medium', opportunity_score: 82, priority: 'high', recommended: true },
  { industry_name: 'Healthcare IT', market_size: '$1.9B addressable', growth_rate: '14% YoY', competition_level: 'medium', opportunity_score: 76, priority: 'medium', recommended: true },
  { industry_name: 'E-commerce', market_size: '$1.5B addressable', growth_rate: '12% YoY', competition_level: 'high', opportunity_score: 68, priority: 'medium', recommended: false },
  { industry_name: 'Manufacturing', market_size: '$0.8B addressable', growth_rate: '6% YoY', competition_level: 'low', opportunity_score: 52, priority: 'low', recommended: false },
  { industry_name: 'Real Estate Tech', market_size: '$0.4B addressable', growth_rate: '8% YoY', competition_level: 'low', opportunity_score: 45, priority: 'low', recommended: false },
  { industry_name: 'Construction Tech', market_size: '$0.3B addressable', growth_rate: '4% YoY', competition_level: 'low', opportunity_score: 38, priority: 'low', recommended: false },
];

// ============================================================
// Country Analysis
// ============================================================

export const MOCK_COUNTRIES: Omit<CountryAnalysis, 'id' | 'market_analysis_id'>[] = [
  { country: 'United States', market_size: '$8.4B', competition: 'high', language: 'English', buying_power: 95, opportunity_score: 96, recommended: true },
  { country: 'United Kingdom', market_size: '$1.8B', competition: 'medium', language: 'English', buying_power: 84, opportunity_score: 88, recommended: true },
  { country: 'Canada', market_size: '$1.1B', competition: 'medium', language: 'English', buying_power: 82, opportunity_score: 85, recommended: true },
  { country: 'Germany', market_size: '$1.6B', competition: 'medium', language: 'German', buying_power: 80, opportunity_score: 79, recommended: true },
  { country: 'Australia', market_size: '$0.7B', competition: 'low', language: 'English', buying_power: 78, opportunity_score: 76, recommended: true },
  { country: 'Netherlands', market_size: '$0.5B', competition: 'low', language: 'Dutch', buying_power: 76, opportunity_score: 74, recommended: true },
  { country: 'France', market_size: '$0.9B', competition: 'medium', language: 'French', buying_power: 72, opportunity_score: 68, recommended: false },
  { country: 'Singapore', market_size: '$0.3B', competition: 'low', language: 'English', buying_power: 74, opportunity_score: 65, recommended: false },
  { country: 'India', market_size: '$0.6B', competition: 'high', language: 'English', buying_power: 48, opportunity_score: 52, recommended: false },
  { country: 'Japan', market_size: '$0.8B', competition: 'low', language: 'Japanese', buying_power: 70, opportunity_score: 58, recommended: false },
];

// ============================================================
// Competitor Analysis
// ============================================================

export const MOCK_COMPETITORS: Omit<CompetitorAnalysis, 'id' | 'market_analysis_id'>[] = [
  {
    competitor: 'Outreach',
    website: 'https://outreach.io',
    pricing_model: 'Enterprise pricing (~$120/seat/mo, annual contracts)',
    market_position: 'Market leader in sales engagement, enterprise-focused',
    strengths: ['Strong brand recognition', 'Large enterprise customer base', 'Deep CRM integrations', 'Well-funded ($500M+ raised)'],
    weaknesses: ['High price point', 'Slow to add AI features', 'Complex onboarding', 'No built-in intent data', 'Requires SDR team to operate'],
    market_share: '~35%',
  },
  {
    competitor: 'SalesLoft',
    website: 'https://salesloft.com',
    pricing_model: 'Enterprise pricing (~$100/seat/mo, annual contracts)',
    market_position: '#2 in sales engagement, enterprise and mid-market',
    strengths: ['Strong cadence engine', 'Good email deliverability', 'Established brand', 'Large partner ecosystem'],
    weaknesses: ['Limited AI personalization', 'No intent signals', 'Expensive for SMBs', 'UI feels dated', 'Long implementation'],
    market_share: '~22%',
  },
  {
    competitor: 'Apollo.io',
    website: 'https://apollo.io',
    pricing_model: 'Freemium + tiers ($49–$99/seat/mo)',
    market_position: 'Data-first sales platform with outreach features',
    strengths: ['Large B2B database (275M+ contacts)', 'Affordable pricing', 'Free tier drives adoption', 'Good data enrichment'],
    weaknesses: ['Outreach is secondary to data', 'Limited multi-channel', 'Lower quality personalization', 'Intent data is basic', 'Support quality varies'],
    market_share: '~12%',
  },
  {
    competitor: 'Lemlist',
    website: 'https://lemlist.com',
    pricing_model: 'SaaS tiers ($59–$159/seat/mo)',
    market_position: 'Email-first outreach with personalization focus',
    strengths: ['Strong email personalization', 'Good multi-channel (email + LinkedIn)', 'Affordable for SMBs', 'Active community'],
    weaknesses: ['No intent data', 'Limited CRM integrations', 'Smaller data offering', 'Not enterprise-ready', 'No API access on lower tiers'],
    market_share: '~6%',
  },
  {
    competitor: 'Smartlead',
    website: 'https://smartlead.ai',
    pricing_model: 'SaaS ($39–$94/mo, unlimited mailboxes)',
    market_position: 'Cold email automation at scale',
    strengths: ['Unlimited mailbox support', 'Very affordable', 'Good deliverability features', 'Fast setup'],
    weaknesses: ['No CRM features', 'No intent data', 'Limited personalization', 'No LinkedIn automation', 'Basic analytics'],
    market_share: '~3%',
  },
];

// ============================================================
// Trend Analysis
// ============================================================

export const MOCK_TRENDS: Omit<TrendAnalysis, 'id' | 'market_analysis_id'>[] = [
  { trend: 'AI-Powered Personalization at Scale', impact: 'transformative', opportunity: 'Platforms that use AI to generate personalized messages at scale will dominate. 73% of buyers say generic outreach is their #1 complaint.', confidence: 95 },
  { trend: 'Intent Data Integration', impact: 'high', opportunity: 'Real-time intent signals (hiring, funding, tech changes) allow outreach at the moment of highest buying intent. Only 12% of sales teams currently use intent data.', confidence: 90 },
  { trend: 'LinkedIn Outreach Automation', impact: 'high', opportunity: 'LinkedIn messages have 3x higher reply rates than email. Automation within safety limits is a key differentiator.', confidence: 88 },
  { trend: 'Consolidation of Sales Tech Stack', impact: 'medium', opportunity: 'Buyers want fewer tools. All-in-one platforms that combine data, intent, and outreach will win budget consolidation.', confidence: 82 },
  { trend: 'Revenue Operations (RevOps) Centralization', impact: 'high', opportunity: 'RevOps teams are becoming the primary buyers of sales tools, replacing individual SDR managers. Platform must support RevOps workflows.', confidence: 85 },
  { trend: 'Privacy-First Data Collection', impact: 'medium', opportunity: 'GDPR/CCPA compliance is now table-stakes. Platforms with built-in compliance will win enterprise deals.', confidence: 80 },
  { trend: 'Conversational AI for Meeting Booking', impact: 'transformative', opportunity: 'AI agents that can handle prospect replies and book meetings autonomously will reduce SDR headcount needs by 40%.', confidence: 87 },
  { trend: 'Multi-Channel Orchestration', impact: 'high', opportunity: 'Coordinated outreach across LinkedIn + email + phone in a single workflow increases reply rates by 2.5x.', confidence: 86 },
];

// ============================================================
// Buying Signals
// ============================================================

export const MOCK_SIGNALS: Omit<BuyingSignal, 'id' | 'market_analysis_id'>[] = [
  { signal_name: 'Hiring Activity', description: 'Companies actively hiring SDRs, AEs, or RevOps roles indicate sales team expansion and need for sales tools.', priority: 'critical', confidence: 92 },
  { signal_name: 'Funding Rounds', description: 'Companies that recently raised Series A+ rounds have fresh budgets and are scaling sales teams. Strongest signal within 90 days of funding.', priority: 'critical', confidence: 94 },
  { signal_name: 'Expansion Signals', description: 'Companies opening new offices, entering new markets, or launching products indicate growth phase and need for outreach tools.', priority: 'high', confidence: 86 },
  { signal_name: 'Technology Changes', description: 'Companies switching CRMs (e.g., from Pipedrive to Salesforce) indicate sales tech stack transformation and openness to new tools.', priority: 'high', confidence: 84 },
  { signal_name: 'Leadership Changes', description: 'New VP Sales or CRO hires signal strategy shifts and openness to new sales tooling. 67% of new sales leaders evaluate tools within 60 days.', priority: 'high', confidence: 88 },
  { signal_name: 'Product Launches', description: 'Companies launching new products need to scale outreach to promote them. Strong signal for outreach platform adoption.', priority: 'medium', confidence: 78 },
  { signal_name: 'Acquisitions', description: 'Companies that acquired others are integrating teams and need to align outreach processes. Medium-term signal.', priority: 'medium', confidence: 72 },
  { signal_name: 'Market Events', description: 'Companies attending major sales conferences (SaaStr, Salesloft Reach) show active interest in sales technology.', priority: 'low', confidence: 65 },
];

// ============================================================
// Strategy / Recommendations
// ============================================================

export const MOCK_STRATEGY = {
  recommendedIndustries: ['B2B SaaS', 'Fintech', 'Marketing & AdTech', 'Healthcare IT'],
  recommendedCountries: ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'Netherlands'],
  recommendedCompanySizes: ['50–200 employees', '200–500 employees', '500–1000 employees'],
  recommendedSalesStrategy:
    'Land-and-expand with a product-led growth entry point. Start prospects on a 14-day free trial, then convert to Starter ($99/mo). Expand to Growth ($299/mo) within 90 days by demonstrating ROI through meeting bookings. Target VP Sales and RevOps leaders as primary buyers. Use intent signals (hiring, funding) to prioritize outreach timing.',
  recommendedPositioning:
    'Position Yuktris as the AI-native alternative to legacy sales engagement platforms. Lead with "AI that researches, personalizes, and books meetings autonomously" — contrasting with manual, tool-heavy workflows of Outreach/SalesLoft. Emphasize 80% reduction in research time and 3.2x reply rates as proof points.',
  recommendedMessaging:
    'Primary angle: "Stop researching. Start closing." Secondary: "The only platform that combines intent signals + AI personalization + multi-channel outreach." Social proof: "Trusted by 500+ revenue teams." Objection handling: "Half the price of Outreach, 3x the AI capability."',
  recommendedStrategy:
    'Focus on mid-market B2B SaaS companies (50–500 employees) in the US, UK, and Canada. Position as the AI-native alternative to legacy sales engagement platforms. Lead with intent-driven outreach as the primary differentiator. Target VP Sales and RevOps leaders with a land-and-expand motion starting at $299/mo. Expand into DACH and Nordics in Phase 2 after establishing 100+ North American customers.',
  executiveSummary:
    'The sales engagement and revenue intelligence market is valued at $18.2B globally and growing at 14.2% CAGR. AI-powered outreach is the fastest-growing segment at 28% YoY. The market is dominated by legacy players (Outreach, SalesLoft) with limited AI capabilities, creating a significant opening for AI-native platforms. Key opportunities exist in mid-market B2B SaaS (50–500 employees) where buyers are tech-savvy, budgets are growing, and the need for efficient outreach is acute. The US, UK, and Canada represent 65% of the addressable market. Hiring activity, funding rounds, and leadership changes at target companies are the strongest buying signals. Recommended GTM: product-led growth with a self-serve entry point, expanding via land-and-expand. Differentiate through integrated intent data and AI personalization at a 50–70% price discount to enterprise alternatives.',
};

// ============================================================
// Helper: Competition level to display
// ============================================================

export const competitionLabel: Record<CompetitionLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
};

export const priorityLabel: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const impactLabel: Record<ImpactLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  transformative: 'Transformative',
};
