import { useState } from 'react';
import { StaticPage } from './MarketingLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FeaturesPage() {
  return (
    <StaticPage title="Features" description="Everything Revenue AI offers — in one platform.">
      <div className="space-y-4">
        {[
          { t: 'AI Research Engine', d: '14 specialized agents crawl websites, analyze tech stacks, detect buying signals, and map decision makers.' },
          { t: 'Revenue Intelligence', d: 'Score every account on ICP fit, buying intent, growth potential, and technology match.' },
          { t: 'Proposal Generation', d: 'Generate tailored proposals with executive summaries, pain point analysis, and ROI projections.' },
          { t: 'Outreach Automation', d: 'AI-written cold emails, follow-up sequences, and meeting briefs personalized to each prospect.' },
          { t: 'Meeting Preparation', d: 'Walk into every sales call with a complete brief including discovery questions and recommended pitch.' },
        ].map((f) => (
          <div key={f.t} className="rounded-xl border border-gold-500/12 bg-card-900 p-5 hover-lift hover:border-gold-400/30 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-ink-50 mb-1">{f.t}</h3>
            <p className="text-sm text-ink-400">{f.d}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function HowItWorksPage() {
  return (
    <StaticPage title="How It Works" description="From company name to closed deal in four steps.">
      <div className="space-y-4">
        {[
          { n: '01', t: 'Add a Company', d: 'Enter a company name and website.' },
          { n: '02', t: 'Click Analyze', d: '14 AI agents execute in sequence — research, intelligence, SEO, ICP, signals, decision makers, proposal, email, follow-up, meeting brief.' },
          { n: '03', t: 'Get Your Report', d: 'One unified Revenue Intelligence Report with everything you need.' },
          { n: '04', t: 'Generate & Engage', d: 'Generate proposals, emails, follow-ups, and meeting briefs from the report page.' },
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-gold-500/12 bg-card-900 p-5 hover-lift hover:border-gold-400/30 backdrop-blur-sm">
            <span className="text-xs font-mono text-gold-400">{s.n}</span>
            <h3 className="text-sm font-semibold text-ink-50 mt-1 mb-1">{s.t}</h3>
            <p className="text-sm text-ink-400">{s.d}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function PricingPage() {
  return (
    <StaticPage title="Pricing" description="Simple, transparent pricing. Start free.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { n: 'Starter', p: '$99', f: ['10 analyses/mo', 'Full AI pipeline', 'Reports', 'Email & proposals'] },
          { n: 'Professional', p: '$299', f: ['50 analyses/mo', 'Everything in Starter', 'Meeting briefs', '3 team members', 'API access'], h: true },
          { n: 'Enterprise', p: 'Custom', f: ['Unlimited', 'Custom agents', 'SSO & SAML', 'Dedicated support'] },
        ].map((plan) => (
          <div key={plan.n} className={cn('rounded-xl border p-5 backdrop-blur-sm', plan.h ? 'border-gold-400/40 bg-gold-400/5 shadow-gold' : 'border-gold-500/12 bg-card-900 hover:border-gold-400/30')}>
            <h3 className="text-sm font-semibold text-ink-50">{plan.n}</h3>
            <p className="text-2xl font-bold text-ink-50 mt-2">{plan.p}</p>
            <ul className="mt-4 space-y-2">
              {plan.f.map((feat) => <li key={feat} className="flex items-start gap-2 text-xs text-ink-400"><Check className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />{feat}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function ResourcesPage() {
  return (
    <StaticPage title="Resources" description="Guides, documentation, and best practices.">
      <div className="space-y-3">
        {['Getting Started Guide', 'AI Agent Documentation', 'Best Practices for Outreach', 'Understanding Revenue Scores', 'API Reference'].map((r) => (
          <div key={r} className="rounded-xl border border-gold-500/12 bg-card-900 p-4 hover:border-gold-400/30 hover:bg-card-800 transition-all duration-200 cursor-pointer backdrop-blur-sm">
            <span className="text-sm text-ink-200">{r}</span>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function AboutPage() {
  return (
    <StaticPage title="About Revenue AI" description="We're building the future of revenue intelligence.">
      <div className="space-y-4 text-sm text-ink-400 leading-relaxed">
        <p>Revenue AI was founded with a simple mission: give every sales team the intelligence of a team of analysts, at a fraction of the cost and time.</p>
        <p>Our platform deploys 14 specialized AI agents that work together to research companies, detect buying signals, identify decision makers, generate proposals, write outreach emails, and prepare meeting briefs — all from a single company name.</p>
        <p>We believe sales teams should spend time building relationships, not doing manual research. Revenue AI handles the research so you can focus on closing.</p>
      </div>
    </StaticPage>
  );
}

export function ContactPage() {
  return (
    <StaticPage title="Contact Us" description="Get in touch with the Revenue AI team.">
      <div className="space-y-4">
        {[
          { t: 'Sales', e: 'sales@revenueai.com' },
          { t: 'Support', e: 'support@revenueai.com' },
          { t: 'General', e: 'hello@revenueai.com' },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-gold-500/12 bg-card-900 p-5 hover-lift hover:border-gold-400/30 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-ink-50 mb-1">{c.t}</h3>
            <p className="text-sm text-gold-400">{c.e}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" description="How we handle your data.">
      <div className="space-y-4 text-sm text-ink-400 leading-relaxed">
        <p>Revenue AI takes data privacy seriously. All data is encrypted in transit and at rest. We use Supabase with row-level security to ensure your data is isolated to your workspace.</p>
        <p>We never share your company data with third parties. AI processing is done through encrypted API calls to our AI providers.</p>
        <p>You can export or delete your data at any time from your workspace settings.</p>
      </div>
    </StaticPage>
  );
}

export function TermsPage() {
  return (
    <StaticPage title="Terms of Service" description="The terms governing your use of Revenue AI.">
      <div className="space-y-4 text-sm text-ink-400 leading-relaxed">
        <p>By using Revenue AI, you agree to use the platform for legitimate business purposes. You are responsible for the accuracy of the data you input.</p>
        <p>Revenue AI is provided "as is" without warranties. We are not liable for business decisions made based on AI-generated insights.</p>
        <p>Subscriptions are billed monthly and can be cancelled at any time.</p>
      </div>
    </StaticPage>
  );
}

export function SecurityPage() {
  return (
    <StaticPage title="Security" description="How we protect your data and infrastructure.">
      <div className="space-y-4">
        {[
          { t: 'Encryption', d: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). API calls to AI providers use encrypted channels.' },
          { t: 'Authentication', d: 'We use Supabase Auth with JWT-based sessions, secure HTTP-only cookies, and optional SSO/SAML for Enterprise plans.' },
          { t: 'Workspace Isolation', d: 'Row-Level Security (RLS) ensures your data is isolated to your workspace. No other tenant can access your data.' },
          { t: 'AI Privacy', d: 'Your company data is sent to AI providers for processing but is never stored or used for training by Revenue AI.' },
          { t: 'Infrastructure', d: 'Hosted on Supabase (PostgreSQL) and Vercel (Edge Functions). Both are SOC 2 Type II compliant.' },
          { t: 'Compliance', d: 'GDPR-ready data handling. SOC 2 Type II in progress. Data Processing Agreement (DPA) available for Enterprise.' },
        ].map((s) => (
          <div key={s.t} className="rounded-xl border border-gold-500/12 bg-card-900 p-5 hover-lift hover:border-gold-400/30 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-ink-50 mb-1">{s.t}</h3>
            <p className="text-sm text-ink-400 leading-relaxed">{s.d}</p>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [openArticle, setOpenArticle] = useState<number | null>(null);

  const categories = [
    { name: 'Getting Started', articles: ['Creating your workspace', 'Running your first analysis', 'Understanding the report', 'Connecting AI providers'] },
    { name: 'AI Guides', articles: ['How the 14-agent pipeline works', 'Improving AI output quality', 'Using the AI Copilot', 'Customizing prompts'] },
    { name: 'Troubleshooting', articles: ['Analysis failed — what to do', 'AI provider connection issues', 'Workspace access problems', 'Export not working'] },
  ];

  return (
    <StaticPage title="Help Center" description="Search our documentation, guides, and FAQs.">
      <div className="space-y-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full h-10 px-3 pl-9 rounded-lg border border-gold-500/12 bg-card-900 text-sm text-ink-100 placeholder:text-ink-500 focus:border-gold-400/50 focus:outline-none focus:ring-2 focus:ring-gold-400/15"
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink-500" />
        </div>

        {categories.map((cat) => (
          <div key={cat.name}>
            <h3 className="text-sm font-semibold text-ink-100 mb-3">{cat.name}</h3>
            <div className="space-y-2">
              {cat.articles.map((article, i) => {
                const idx = cat.name.length * 10 + i;
                return (
                  <div key={article} className="rounded-xl border border-gold-500/12 bg-card-900 overflow-hidden backdrop-blur-sm">
                    <button
                      onClick={() => setOpenArticle(openArticle === idx ? null : idx)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-800 transition-colors"
                    >
                      <span className="text-sm text-ink-300">{article}</span>
                      <ChevronDown className={cn('h-4 w-4 text-ink-500 transition-transform', openArticle === idx && 'rotate-180')} />
                    </button>
                    {openArticle === idx && (
                      <div className="px-4 pb-3 text-xs text-ink-500 leading-relaxed animate-fade-in">
                        This article covers {article.toLowerCase()}. For detailed instructions, follow the step-by-step guide in the application. If you need additional help, contact support@revenueai.com.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function StatusPage() {
  const services = [
    { name: 'Web Application', status: 'operational', uptime: '99.98%' },
    { name: 'AI Pipeline', status: 'operational', uptime: '99.95%' },
    { name: 'Database', status: 'operational', uptime: '99.99%' },
    { name: 'Edge Functions', status: 'operational', uptime: '99.97%' },
    { name: 'AI Providers', status: 'degraded', uptime: '99.50%' },
  ];

  return (
    <StaticPage title="System Status" description="Real-time status of Revenue AI services.">
      <div className="space-y-3">
        {services.map((s) => (
          <div key={s.name} className="flex items-center justify-between rounded-xl border border-gold-500/12 bg-card-900 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className={cn('h-2.5 w-2.5 rounded-full', s.status === 'operational' ? 'bg-success-500' : 'bg-warning-500', s.status === 'operational' && 'animate-pulse')} />
              <span className="text-sm text-ink-200">{s.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-500">{s.uptime} uptime</span>
              <Badge tone={s.status === 'operational' ? 'success' : 'warning'} dot>{s.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function RoadmapPage() {
  const roadmap = [
    { q: 'Q3 2026', items: ['AI Copilot v2 with multi-turn reasoning', 'Custom agent builder', 'Slack & Teams integration', 'Advanced analytics dashboard'] },
    { q: 'Q4 2026', items: ['CRM sync (HubSpot, Salesforce)', 'Email sending via Gmail API', 'Calendar integration (Google, Outlook)', 'Team collaboration features'] },
    { q: 'Q1 2027', items: ['Custom report templates', 'API v2 with webhooks', 'Mobile app (iOS & Android)', 'Enterprise SSO/SAML'] },
  ];

  return (
    <StaticPage title="Product Roadmap" description="What we're building next.">
      <div className="space-y-8">
        {roadmap.map((phase) => (
          <div key={phase.q}>
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="brand">{phase.q}</Badge>
            </div>
            <div className="space-y-2">
              {phase.items.map((item) => (
                <div key={item} className="flex items-center gap-2.5 rounded-lg border border-gold-500/12 bg-card-900 p-3 backdrop-blur-sm hover:border-gold-400/30 transition-all duration-200">
                  <ChevronRight className="h-4 w-4 text-gold-400" />
                  <span className="text-sm text-ink-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}

export function BookDemoPage() {
  return (
    <StaticPage title="Book a Demo" description="See Revenue AI in action with a personalized demo.">
      <div className="space-y-6">
        <div className="rounded-xl border border-gold-400/20 bg-gold-400/5 p-5">
          <p className="text-sm text-ink-300 leading-relaxed">
            Schedule a 30-minute demo with our team. We'll show you how Revenue AI can analyze your target accounts, generate proposals, and help your team close more deals.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Full Name', placeholder: 'John Smith' },
            { label: 'Work Email', placeholder: 'john@company.com' },
            { label: 'Company', placeholder: 'Acme Inc.' },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">{field.label}</label>
              <input className="w-full h-10 px-3 rounded-lg border border-gold-500/12 bg-card-900 text-sm text-ink-100 placeholder:text-ink-500 focus:border-gold-400/50 focus:outline-none focus:ring-2 focus:ring-gold-400/15" placeholder={field.placeholder} />
            </div>
          ))}
          <Button className="w-full">Request Demo</Button>
        </div>
      </div>
    </StaticPage>
  );
}

export function ReleaseNotesPage() {
  const releases = [
    { version: 'v2.0.0', date: 'Jul 2026', highlights: ['New: AI Copilot with context-aware suggestions', 'New: Full 14-agent pipeline with live progress', 'New: Unified Revenue Intelligence Report', 'New: Export to PDF, Markdown, and Clipboard', 'New: 9-step onboarding flow', 'Improved: Premium design system with dark mode'] },
    { version: 'v1.5.0', date: 'Jun 2026', highlights: ['New: Knowledge Graph visualization', 'New: Memory Engine with persistence', 'New: Context Engine for AI agents', 'Improved: Dashboard with quick actions'] },
    { version: 'v1.0.0', date: 'May 2026', highlights: ['Initial release', '14 AI agents for revenue intelligence', 'Workspace and team management', 'Supabase backend with RLS'] },
  ];

  return (
    <StaticPage title="Release Notes" description="What's new in Revenue AI.">
      <div className="space-y-8">
        {releases.map((r) => (
          <div key={r.version}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-semibold text-ink-50">{r.version}</h3>
              <Badge tone="neutral">{r.date}</Badge>
            </div>
            <ul className="space-y-2">
              {r.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-ink-400">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-gold-400 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </StaticPage>
  );
}
