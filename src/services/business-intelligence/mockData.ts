// ============================================================
// Mock Data — Business Intelligence Agent
// ============================================================
//
// Realistic sample analysis for https://revenueclutch.com
// This data simulates what the real Firecrawl + OpenAI + Tavily
// pipeline would produce. Used when the actual APIs are not yet
// configured.

import type {
  BusinessAnalysis,
  WebsitePage,
  BusinessInsights,
} from '@/types/business-intelligence';

export const MOCK_ANALYSIS: Omit<BusinessAnalysis, 'id' | 'workspace_id' | 'created_at' | 'updated_at'> = {
  website: 'https://revenueclutch.com',
  company_name: 'RevenueClutch',
  industry: 'B2B SaaS / Revenue Operations',
  country: 'United States',
  language: 'English',
  timezone: 'America/New_York',
  description:
    'RevenueClutch is a B2B SaaS platform that helps revenue teams automate lead enrichment, prospect research, and multi-channel outreach. The platform combines real-time intent data with AI-powered personalization to help sales teams book more meetings with qualified prospects.',
  business_model:
    'Subscription-based B2B SaaS with tiered pricing. Revenue is generated through monthly/annual SaaS subscriptions based on seat count and feature tier. Additional revenue from professional services and onboarding.',
  products: [
    'RevenueClutch Platform — Core outreach automation platform with LinkedIn + email sequences',
    'Intent Engine — Real-time buying signal detection from 50+ data sources',
    'Enrichment API — Prospect data enrichment with 40+ data points per contact',
    'Analytics Suite — Campaign performance dashboards and revenue attribution',
  ],
  services: [
    'Managed Outreach — Done-for-you campaign setup and optimization',
    'Data Enrichment — Bulk prospect enrichment via API or CSV upload',
    'Custom Integrations — CRM and workflow automation setup',
    'Onboarding & Training — Team onboarding and best-practice workshops',
  ],
  pricing_model:
    'Three-tier SaaS pricing: Starter ($99/mo, 1 seat), Growth ($299/mo, 3 seats + intent data), Scale ($799/mo, 10 seats + API + managed outreach). Annual billing offers 2 months free. Enterprise pricing available on request.',
  target_audience:
    'VPs of Sales, Heads of Revenue, Sales Development Leaders, and RevOps managers at B2B SaaS companies with 50–500 employees. Secondary audience: sales agencies and outsourced SDR teams.',
  usp:
    'RevenueClutch is the only platform that combines real-time intent signals with AI-personalized outreach across LinkedIn and email in a single workflow — reducing manual research time by 80% while increasing reply rates by 3.2x.',
  customer_problems: [
    'Sales teams spend 60% of their time on manual prospect research instead of selling',
    'Generic outreach messages get ignored — reply rates below 2% are common',
    'Intent data is siloed in separate tools, requiring manual cross-referencing',
    'No single platform combines enrichment, intent, and multi-channel outreach',
    'Sales leaders lack visibility into which outreach activities drive revenue',
  ],
  business_goals: [
    'Reach $10M ARR within 24 months by expanding mid-market customer base',
    'Launch AI-powered meeting booking agent by Q3 2026',
    'Achieve 95% customer retention through product-led onboarding',
    'Expand to European markets with GDPR-compliant data infrastructure',
    'Build marketplace of third-party data providers for enrichment',
  ],
  revenue_model:
    'Recurring subscription revenue (MRR/ARR) with tiered pricing. Land-and-expand motion: start with Starter, upsell to Growth/Scale as teams grow. Professional services provide additional one-time revenue. Net revenue retention target: 120%+.',
  competitive_position:
    'Positioned between pure outreach tools (Lemlist, Smartlead) and full RevOps platforms (Outreach, SalesLoft). Differentiates through integrated intent data and AI personalization at a lower price point. Main competitors lack real-time intent signals.',
  confidence_score: 92,
  business_category: 'B2B SaaS — Sales Engagement & Revenue Intelligence',
  primary_icp: 'VP Sales at B2B SaaS companies, 50–500 employees, US-based, using Salesforce or HubSpot',
  completion_percentage: 100,
  analysis_status: 'completed',
  error_message: null,
};

export const MOCK_PAGES: Omit<WebsitePage, 'id' | 'analysis_id' | 'created_at'>[] = [
  {
    page_title: 'RevenueClutch — AI-Powered Revenue Operating System',
    url: 'https://revenueclutch.com',
    page_type: 'homepage',
    content:
      'RevenueClutch helps B2B sales teams generate more meetings with AI. Automate prospect research, enrich leads with 40+ data points, and run personalized multi-channel outreach campaigns. Stop guessing. Start closing. Trusted by 500+ revenue teams worldwide.',
    summary:
      'Homepage introducing RevenueClutch as an AI-powered revenue operating system for B2B sales teams. Highlights automation, enrichment, and multi-channel outreach. Social proof: 500+ teams.',
    metadata: { word_count: 45, load_time_ms: 850, og_title: 'RevenueClutch — AI Revenue OS', og_description: 'Generate more meetings with AI' },
  },
  {
    page_title: 'Services — RevenueClutch',
    url: 'https://revenueclutch.com/services',
    page_type: 'services',
    content:
      'Managed Outreach: Done-for-you campaign setup. Data Enrichment: Bulk prospect enrichment via API. Custom Integrations: CRM and workflow automation. Onboarding & Training: Team onboarding and best-practice workshops.',
    summary:
      'Services page listing four service offerings: managed outreach, data enrichment, custom integrations, and onboarding/training. Each with brief descriptions.',
    metadata: { word_count: 32, load_time_ms: 620 },
  },
  {
    page_title: 'Pricing — RevenueClutch',
    url: 'https://revenueclutch.com/pricing',
    page_type: 'pricing',
    content:
      'Starter: $99/mo — 1 seat, 500 contacts/mo, email outreach. Growth: $299/mo — 3 seats, 5,000 contacts/mo, LinkedIn + email, intent data. Scale: $799/mo — 10 seats, unlimited contacts, API access, managed outreach. Enterprise: Custom — SSO, dedicated CSM, custom integrations.',
    summary:
      'Four pricing tiers: Starter ($99), Growth ($299), Scale ($799), Enterprise (custom). Annual billing offers 2 months free. Each tier increases seat count and feature access.',
    metadata: { word_count: 48, load_time_ms: 710 },
  },
  {
    page_title: 'Blog — RevenueClutch',
    url: 'https://revenueclutch.com/blog',
    page_type: 'blog',
    content:
      'Latest articles on B2B sales strategy, outreach automation, intent data, and revenue operations. Featured posts: "Why 97% of Cold Emails Fail (And How to Fix It)", "The Complete Guide to LinkedIn Automation in 2026", "5 Intent Signals That Predict Buying Behavior".',
    summary:
      'Blog with articles on sales strategy, outreach automation, and intent data. Content marketing focused on educating sales leaders and driving organic traffic.',
    metadata: { word_count: 38, post_count: 42, categories: ['Sales Strategy', 'Outreach', 'Intent Data', 'RevOps'] },
  },
  {
    page_title: 'Resources — RevenueClutch',
    url: 'https://revenueclutch.com/resources',
    page_type: 'resources',
    content:
      'Free resources: ROI Calculator, Outreach Templates Library, ICP Worksheet, Sales Tech Stack Guide, Cold Email Playbook. Downloadable PDFs and interactive tools.',
    summary:
      'Resources hub with downloadable templates, calculators, and guides for sales teams. Lead generation through gated content.',
    metadata: { word_count: 22, resource_count: 5 },
  },
  {
    page_title: 'Contact — RevenueClutch',
    url: 'https://revenueclutch.com/contact',
    page_type: 'contact',
    content:
      'Contact us at hello@revenueclutch.com or schedule a demo. Office: 548 Market St, San Francisco, CA. Phone: +1 (415) 555-0192. Support: support@revenueclutch.com.',
    summary:
      'Contact page with email, phone, office address, and demo scheduling CTA. Located in San Francisco.',
    metadata: { word_count: 28, email: 'hello@revenueclutch.com', phone: '+1 (415) 555-0192' },
  },
  {
    page_title: 'FAQ — RevenueClutch',
    url: 'https://revenueclutch.com/faq',
    page_type: 'faq',
    content:
      'Frequently asked questions about pricing, LinkedIn safety limits, data sources, integrations, cancellation, and onboarding. 24 questions answered across 6 categories.',
    summary:
      'FAQ page with 24 questions in 6 categories: pricing, safety, data, integrations, billing, onboarding. Addresses common buyer objections.',
    metadata: { word_count: 156, question_count: 24, categories: 6 },
  },
  {
    page_title: 'Testimonials — RevenueClutch',
    url: 'https://revenueclutch.com/testimonials',
    page_type: 'testimonials',
    content:
      'Customer testimonials from sales leaders at companies like Acme Corp, TechFlow, DataHive, and Nexus Labs. Average rating: 4.8/5 across 120+ reviews on G2 and Capterra.',
    summary:
      'Testimonials page with quotes from 8 customers and aggregate ratings from G2 and Capterra. Strong social proof from recognizable B2B brands.',
    metadata: { word_count: 35, testimonial_count: 8, avg_rating: 4.8, review_count: 120 },
  },
  {
    page_title: 'Case Studies — RevenueClutch',
    url: 'https://revenueclutch.com/case-studies',
    page_type: 'case_studies',
    content:
      'Case studies: How Acme Corp increased reply rates by 340% in 90 days. How TechFlow booked 142 meetings in one quarter. How DataHive reduced SDR research time by 80%.',
    summary:
      'Three case studies with quantified results: reply rate increase, meetings booked, and time saved. Strong ROI evidence for prospects.',
    metadata: { word_count: 30, case_study_count: 3 },
  },
];

export const MOCK_INSIGHTS: Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'> = {
  strengths: [
    'Strong product differentiation through integrated intent data + AI personalization',
    'Competitive pricing (50–70% below enterprise alternatives like Outreach/SalesLoft)',
    'Multi-channel approach (LinkedIn + email) in a single platform',
    'High social proof: 500+ customers, 4.8/5 G2 rating, quantified case studies',
    'Clear ICP and focused messaging for B2B SaaS sales leaders',
  ],
  weaknesses: [
    'Limited brand awareness compared to established competitors (Outreach, SalesLoft)',
    'No free tier — may limit top-of-funnel acquisition and product-led growth',
    'LinkedIn automation carries inherent platform risk and compliance concerns',
    'Reliance on third-party data providers for intent signals creates dependency',
    'No visible SOC 2 / ISO 27001 compliance certifications listed on website',
  ],
  opportunities: [
    'Expand to European markets with GDPR-compliant infrastructure',
    'Build a data provider marketplace for additional revenue streams',
    'Launch AI meeting-booking agent to expand product surface area',
    'Develop free tools (ROI calculator, templates) for inbound lead generation',
    'Partner with CRM consultancies and sales agencies for channel distribution',
  ],
  risks: [
    'LinkedIn may restrict or ban automation APIs, impacting core functionality',
    'Enterprise competitors could add intent data features at similar price points',
    'Economic downturn may reduce sales tech budgets and slow expansion',
    'Data privacy regulations (GDPR, CCPA) may limit data enrichment capabilities',
    'Customer acquisition cost may be unsustainable without strong organic channels',
  ],
  executive_summary:
    'RevenueClutch is a well-positioned B2B SaaS platform in the sales engagement and revenue intelligence market. Its core differentiation — combining real-time intent signals with AI-personalized multi-channel outreach — addresses a genuine pain point for sales teams. The pricing strategy is competitive and the land-and-expand model supports strong net revenue retention. Key risks include LinkedIn platform dependency and competition from larger, well-funded incumbents. The company should prioritize: (1) achieving compliance certifications to unlock enterprise deals, (2) launching free tools for inbound acquisition, and (3) expanding to European markets. With a clear ICP and strong product-market fit signals (500+ customers, 4.8/5 rating), RevenueClutch is well-positioned for continued growth if it can scale its go-to-market motion efficiently.',
  raw_json: {
    crawl_metadata: {
      pages_discovered: 9,
      pages_extracted: 9,
      total_words: 434,
      crawl_duration_ms: 4280,
      tool: 'firecrawl (mock)',
    },
    ai_metadata: {
      model: 'gpt-4o (mock)',
      tokens_used: 12480,
      analysis_duration_ms: 8200,
      confidence_method: 'weighted_feature_extraction',
    },
    extracted_entities: {
      emails: ['hello@revenueclutch.com', 'support@revenueclutch.com'],
      phones: ['+1 (415) 555-0192'],
      addresses: ['548 Market St, San Francisco, CA'],
      social_links: ['linkedin.com/company/revenueclutch', 'twitter.com/revenueclutch'],
    },
    competitive_landscape: {
      direct_competitors: ['Outreach', 'SalesLoft', 'Lemlist', 'Smartlead'],
      indirect_competitors: ['ZoomInfo', 'Apollo', 'Clearbit'],
      market_category: 'Sales Engagement & Revenue Intelligence',
    },
  },
};
