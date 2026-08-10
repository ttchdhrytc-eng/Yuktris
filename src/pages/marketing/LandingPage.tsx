import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, ArrowRight, Check, Zap, Brain, Target, TrendingUp,
  FileText, Mail, Calendar, Globe, Cpu, Users, BarChart3,
  Shield, Star, ChevronDown, Menu, X,
  Rocket, Linkedin, MessagesSquare, Bot, PieChart, Activity,
  Send, CalendarCheck, Award, PlayCircle, Radar,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Results', href: '#results' },
];

const workflow = [
  { icon: Globe, title: 'Connect Website', desc: 'Enter your business website. AI learns your product instantly.' },
  { icon: Linkedin, title: 'Connect LinkedIn', desc: 'Link your LinkedIn account. AI starts finding prospects automatically.' },
  { icon: Mail, title: 'Connect Email', desc: 'Connect your email. AI sends personalized outreach on your behalf.' },
  { icon: Target, title: 'Define ICP', desc: 'Tell AI who your ideal customers are. It builds a targeting profile.' },
  { icon: Users, title: 'AI Finds Prospects', desc: 'AI scans the market, scores fit, and builds your prospect list.' },
  { icon: Send, title: 'AI Sends Outreach', desc: 'Connection requests, personalized messages, and follow-ups — all automated.' },
  { icon: MessagesSquare, title: 'AI Handles Replies', desc: 'AI reads responses, handles objections, and qualifies leads.' },
  { icon: FileText, title: 'AI Generates Proposals', desc: 'Tailored proposals with ROI projections, ready for review.' },
  { icon: CalendarCheck, title: 'AI Books Meetings', desc: 'AI schedules meetings directly on your calendar.' },
  { icon: TrendingUp, title: 'Close Deals', desc: 'Your sales team walks into warm, pre-qualified meetings.' },
];

const features = [
  { icon: Bot, title: 'AI SDR', desc: 'Your autonomous sales development rep. Finds prospects, sends outreach, handles replies, books meetings — 24/7.' },
  { icon: Linkedin, title: 'LinkedIn Automation', desc: 'Connection requests, personalized messages, follow-ups, and InMails — all sent automatically with safety limits.' },
  { icon: Mail, title: 'Email Automation', desc: 'AI-written cold emails and follow-up sequences, personalized to each prospect. Full inbox management.' },
  { icon: FileText, title: 'AI Proposal Generator', desc: 'Generate tailored proposals with executive summaries, pain point analysis, and ROI projections in seconds.' },
  { icon: Calendar, title: 'Meeting Automation', desc: 'AI schedules meetings, sends reminders, prepares briefs, and follows up — all on autopilot.' },
  { icon: PieChart, title: 'Revenue Analytics', desc: 'Track campaign performance, reply rates, pipeline value, and revenue attribution in real time.' },
];

const integrations = [
  { icon: Linkedin, name: 'LinkedIn', desc: 'Sales Navigator & automation' },
  { icon: Mail, name: 'Gmail', desc: 'Email outreach & inbox management' },
  { icon: Calendar, name: 'Google Calendar', desc: 'Meeting scheduling & reminders' },
  { icon: Zap, name: 'Zapier', desc: 'Connect 5,000+ apps' },
  { icon: BarChart3, name: 'HubSpot', desc: 'CRM sync & pipeline tracking' },
  { icon: Activity, name: 'Slack', desc: 'Real-time AI activity notifications' },
];

const testimonials = [
  { quote: 'Revenue AI replaced our entire SDR team. We went from 15 meetings/month to 80+ without hiring a single rep.', author: 'Sarah Chen', role: 'VP Sales, Lattice', metric: '5.3x more meetings' },
  { quote: 'The AI handles everything — finding prospects, sending messages, booking calls. My team just shows up and closes.', author: 'Marcus Rodriguez', role: 'Head of RevOps, Vercel', metric: '$2.4M pipeline added' },
  { quote: 'From connecting LinkedIn to booked meetings in under a week. It feels like having 10 SDRs working around the clock.', author: 'Priya Patel', role: 'CEO, Flowbase', metric: '80% less manual work' },
];

const pricingPlans = [
  { name: 'Starter', price: '$299', period: '/mo', features: ['1 LinkedIn account', '1 Email account', '500 prospects/month', 'AI outreach automation', 'Meeting scheduling', 'Basic analytics', 'Email support'], cta: 'Start Free Trial', highlight: false },
  { name: 'Growth', price: '$799', period: '/mo', features: ['3 LinkedIn accounts', '3 Email accounts', '2,000 prospects/month', 'AI proposal generation', 'AI objection handling', 'Advanced analytics', 'CRM integration', 'Priority support', '3 team members'], cta: 'Start Free Trial', highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited accounts', 'Unlimited prospects', 'Custom AI agents', 'White-label platform', 'SSO & SAML', 'Dedicated AI tuning', 'SLA guarantee', 'On-premise option', 'Dedicated support'], cta: 'Contact Sales', highlight: false },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-luxury text-ink-200">
      {/* ─── Navbar ─── */}
      <header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-400', scrolled ? 'glass-nav' : 'bg-transparent')}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #E2B93B)', boxShadow: '0 4px 14px -2px rgba(212, 175, 55, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)' }}
            >
              <Sparkles className="h-4.5 w-4.5 text-maroon-950" />
            </div>
            <span className="text-base font-bold tracking-tight text-ink-50">Revenue AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="text-sm text-ink-300 hover:text-gold-400 transition-colors">{link.label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup"><Button variant="primary" size="sm">Get Started <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>

          <button className="md:hidden text-ink-300 hover:text-gold-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden glass-nav animate-fade-in">
            <div className="px-6 py-4 space-y-3">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block text-sm text-ink-300 hover:text-gold-400">{link.label}</a>
              ))}
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="flex-1"><Button variant="secondary" size="sm" className="w-full">Sign in</Button></Link>
                <Link to="/signup" className="flex-1"><Button variant="primary" size="sm" className="w-full">Get Started</Button></Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero ─── */}
      <section className="relative pt-36 pb-24 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #240006 0%, #3B0712 35%, #59111F 70%, #7A2B18 100%)' }}
      >
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-gold-500/12 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-neon-500/5 rounded-full blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/20 px-4 py-1.5 mb-7 animate-fade-in-up backdrop-blur-md"
            style={{ background: 'rgba(212, 175, 55, 0.06)' }}
          >
            <span className="h-2 w-2 rounded-full bg-neon-500 animate-pulse glow-neon" />
            <span className="text-sm text-gold-300 font-medium">AI Revenue Operating System</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-ink-50 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            Hire an
            <br />
            <span className="text-gradient-hero">AI Sales Team</span>
          </h1>

          <p className="text-lg md:text-xl text-ink-300 max-w-2xl mx-auto leading-relaxed mb-9 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Connect LinkedIn. Connect Gmail. Describe your ideal customer. Your AI sales team handles prospecting, outreach, follow-ups, and meeting booking — automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <Link to="/signup"><Button variant="primary" size="lg">Hire Your AI Sales Team <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="#how-it-works"><Button variant="secondary" size="lg"><PlayCircle className="h-4 w-4" />See How It Works</Button></a>
          </div>

          <p className="text-sm text-ink-500 mt-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>14-day free trial · No credit card required · Cancel anytime</p>
        </div>

        {/* Workflow illustration */}
        <div className="relative max-w-6xl mx-auto px-6 mt-20 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="rounded-3xl border border-gold-500/15 overflow-hidden backdrop-blur-xl"
            style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.85), rgba(59, 7, 18, 0.85))', boxShadow: '0 25px 50px -12px rgba(120, 20, 40, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)' }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 h-11 border-b border-gold-500/10"
              style={{ background: 'rgba(35, 0, 6, 0.5)' }}
            >
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-error-500/60" />
                <div className="h-3 w-3 rounded-full bg-warning-500/60" />
                <div className="h-3 w-3 rounded-full bg-success-500/60" />
              </div>
              <div className="flex-1 text-center text-sm text-ink-500">app.revenueai.com/dashboard</div>
            </div>
            {/* Mock dashboard */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Prospects Found', value: '1,247', icon: Users, color: 'text-gold-300', pct: '78%' },
                { label: 'Messages Sent', value: '892', icon: Send, color: 'text-gold-400', pct: '64%' },
                { label: 'Meetings Booked', value: '34', icon: CalendarCheck, color: 'text-success-500', pct: '92%' },
              ].map((stat, i) => (
                <div key={i} className="rounded-2xl border border-gold-500/10 p-4 space-y-3"
                  style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.6), rgba(59, 7, 18, 0.5))' }}
                >
                  <div className="flex items-center justify-between">
                    <stat.icon className={cn('h-5 w-5', stat.color)} />
                    <span className="text-xs text-ink-500">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-ink-50">{stat.value}</p>
                  <div className="h-1.5 w-full bg-maroon-950/60 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold-400 to-gold-300 rounded-full" style={{ width: stat.pct }} />
                  </div>
                </div>
              ))}
              {/* AI activity timeline */}
              <div className="md:col-span-2 rounded-2xl border border-gold-500/10 p-4 space-y-3"
                style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.6), rgba(59, 7, 18, 0.5))' }}
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-gold-400" />
                  <span className="text-sm font-medium text-ink-100">AI Activity</span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-success-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-500 animate-pulse glow-neon" /> Live
                  </span>
                </div>
                {[
                  { text: 'AI found 47 new prospects matching your ICP', time: '2m ago', icon: Radar, color: 'text-gold-300' },
                  { text: 'AI sent 23 LinkedIn connection requests', time: '5m ago', icon: Linkedin, color: 'text-gold-400' },
                  { text: 'AI received 4 replies — 2 positive, 2 objections', time: '12m ago', icon: MessagesSquare, color: 'text-success-500' },
                  { text: 'AI booked a meeting with Sarah Chen (VP Sales)', time: '28m ago', icon: CalendarCheck, color: 'text-warning-500' },
                ].map((act, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border border-gold-500/10', 'bg-maroon-900/50', act.color)}>
                      <act.icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm text-ink-200 flex-1">{act.text}</p>
                    <span className="text-xs text-ink-500">{act.time}</span>
                  </div>
                ))}
              </div>
              {/* Quick action */}
              <div className="rounded-2xl border border-gold-500/20 p-4 space-y-3"
                style={{ background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.06), rgba(120, 20, 40, 0.06))' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold-400" />
                  <span className="text-sm font-medium text-ink-50">AI Recommendation</span>
                </div>
                <p className="text-sm text-ink-200 leading-relaxed">3 prospects replied positively. Follow up within 24h to maximize conversion.</p>
                <div className="flex gap-2">
                  <div className="h-8 flex-1 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300 flex items-center justify-center text-xs text-maroon-950 font-medium btn-gold-glow">Follow Up Now</div>
                  <div className="h-8 px-3 rounded-xl bg-maroon-900/60 border border-gold-500/10 flex items-center justify-center text-xs text-ink-400">Later</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Customer logos ─── */}
      <section className="py-12 border-y border-gold-500/8"
        style={{ background: 'linear-gradient(180deg, #2A0208, #32000C)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-ink-500 uppercase tracking-wider mb-6">Trusted by revenue teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {['Lattice', 'Vercel', 'Flowbase', 'Notion', 'Linear', 'Cursor'].map((name) => (
              <span key={name} className="text-xl font-bold text-ink-400 tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Platform Features ─── */}
      <section id="platform" className="py-24 relative"
        style={{ background: 'linear-gradient(180deg, #32000C, #3B0712)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge tone="brand" className="mb-3">Platform</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">One platform. Your entire sales pipeline.</h2>
            <p className="text-base text-ink-300">From prospecting to closing — Revenue AI automates every step of your outbound sales workflow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div key={feature.title} className="glass-card p-6 hover-lift cursor-default animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-gold-400 mb-5 transition-all duration-300 hover:shadow-gold border border-gold-500/20"
                  style={{ background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.08), rgba(120, 20, 40, 0.08))' }}
                >
                  <feature.icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="text-lg font-semibold text-ink-50 mb-2">{feature.title}</h3>
                <p className="text-sm text-ink-300 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 relative"
        style={{ background: 'linear-gradient(180deg, #3B0712, #4A0C17)' }}
      >
        <div className="absolute inset-0 dot-pattern opacity-20" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge tone="violet" className="mb-3">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">From setup to closed deals</h2>
            <p className="text-base text-ink-300">Connect your tools, define your ICP, and let AI handle the rest. Your sales team focuses on closing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {workflow.map((step, i) => (
              <div key={i} className="glass-card p-5 hover-lift animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-gold-400 border border-gold-500/20"
                    style={{ background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.08), rgba(120, 20, 40, 0.08))' }}
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-bold text-ink-700">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="text-sm font-semibold text-ink-50 mb-1.5">{step.title}</h3>
                <p className="text-sm text-ink-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Integrations ─── */}
      <section id="integrations" className="py-24"
        style={{ background: 'linear-gradient(180deg, #4A0C17, #5A1321)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge tone="success" className="mb-3">Integrations</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">Connects with your stack</h2>
            <p className="text-base text-ink-300">Revenue AI plugs into the tools your team already uses. Set up in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration, i) => (
              <div key={i} className="glass-card p-5 flex items-center gap-4 hover-lift animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-gold-400 shrink-0 border border-gold-500/15"
                  style={{ background: 'rgba(59, 7, 18, 0.5)' }}
                >
                  <integration.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-50">{integration.name}</h3>
                  <p className="text-sm text-ink-400">{integration.desc}</p>
                </div>
                <Badge tone="success" size="sm" className="ml-auto">Connected</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="results" className="py-24"
        style={{ background: 'linear-gradient(180deg, #5A1321, #4A0C17)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge tone="warning" className="mb-3">Customer Results</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">Revenue teams close more with AI</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="glass-card p-6 hover-lift animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 text-gold-400 fill-gold-400" />)}
                </div>
                <p className="text-base text-ink-200 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium border border-gold-500/20"
                      style={{ background: 'linear-gradient(145deg, rgba(100, 16, 30, 0.6), rgba(77, 16, 32, 0.6))', color: 'rgb(242 201 76)' }}
                    >
                      {t.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-100">{t.author}</p>
                      <p className="text-xs text-ink-400">{t.role}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gold-500/10">
                  <p className="text-lg font-bold text-gradient-gold">{t.metric}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24"
        style={{ background: 'linear-gradient(180deg, #4A0C17, #3B0712)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge tone="brand" className="mb-3">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">Pricing that scales with your revenue</h2>
            <p className="text-base text-ink-300">Start free. Upgrade when your AI starts booking meetings.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div key={plan.name} className={cn('relative rounded-3xl border p-7 animate-fade-in-up', plan.highlight ? 'border-gold-500/40 shadow-gold-lg' : 'border-gold-500/12 hover:border-gold-500/25')}
                style={{
                  background: plan.highlight
                    ? 'linear-gradient(145deg, rgba(77, 16, 32, 0.9), rgba(88, 18, 37, 0.85))'
                    : 'linear-gradient(145deg, rgba(59, 7, 18, 0.7), rgba(77, 16, 32, 0.6))',
                  boxShadow: plan.highlight ? '0 12px 40px -8px rgba(212, 175, 55, 0.2), 0 0 0 1px rgba(212, 175, 55, 0.15)' : '0 8px 32px -8px rgba(120, 20, 40, 0.3)',
                }}
                style-delay={`${i * 0.08}s`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge tone="violet" className="shadow-gold">Most Popular</Badge>
                  </div>
                )}
                <h3 className="text-base font-semibold text-ink-50 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-bold text-ink-50">{plan.price}</span>
                  <span className="text-sm text-ink-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-200">
                      <Check className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="block">
                  <Button variant={plan.highlight ? 'primary' : 'secondary'} className="w-full">{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #3B0712, #230006)' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gold-500/10 rounded-full blur-[120px]" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-ink-50">Ready to automate your sales?</h2>
          <p className="text-base text-ink-300 mb-8 max-w-lg mx-auto">Join the revenue teams using AI to find prospects, send outreach, and book meetings — all on autopilot.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup"><Button variant="primary" size="lg">Start Free Trial <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="#pricing"><Button variant="secondary" size="lg">View Pricing</Button></a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gold-500/8"
        style={{ background: 'linear-gradient(180deg, #230006, #2A0208)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #E2B93B)' }}
                >
                  <Sparkles className="h-4.5 w-4.5 text-maroon-950" />
                </div>
                <span className="text-base font-bold tracking-tight text-ink-50">Revenue AI</span>
              </Link>
              <p className="text-sm text-ink-300 max-w-xs leading-relaxed">The autonomous sales platform that finds prospects, sends outreach, and books meetings — 24/7.</p>
              <div className="flex items-center gap-3 mt-4">
                <Badge tone="success" dot>SOC 2 Ready</Badge>
                <Badge tone="neutral" dot>GDPR</Badge>
              </div>
            </div>

            {[
              { title: 'Product', links: ['Features', 'Pricing', 'How It Works', 'Integrations', 'API'] },
              { title: 'Company', links: ['About', 'Contact', 'Careers', 'Blog'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'DPA'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-ink-200 uppercase tracking-wider mb-3">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}><a href="#" className="text-sm text-ink-400 hover:text-gold-400 transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-gold-500/8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-ink-500">© 2026 Revenue AI. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm text-ink-500">
              <a href="#" className="hover:text-gold-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-gold-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-gold-400 transition-colors">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
