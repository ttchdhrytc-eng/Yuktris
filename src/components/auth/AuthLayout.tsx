import { type ReactNode } from 'react';
import { Sparkles, TrendingUp, Bot, Users, ShieldCheck } from 'lucide-react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-luxury">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-gold-500/10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #230006 0%, #32000C 30%, #4A0C17 60%, #5A1321 100%)' }}
      >
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gold-500/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-neon-500/4 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="absolute inset-0 grid-pattern opacity-20" />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #E2B93B)',
                boxShadow: '0 4px 14px -2px rgba(212, 175, 55, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              <Sparkles className="h-5 w-5 text-maroon-950" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold text-ink-50 tracking-tight">Revenue AI</span>
              <span className="text-2xs text-ink-500">AI Operating System</span>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-ink-50 leading-tight tracking-tight">
              The Autonomous Revenue
              <br />
              <span className="text-gradient-hero">Operating System</span>
            </h1>
            <p className="mt-4 text-sm text-ink-300 max-w-md leading-relaxed">
              Generate qualified meetings on autopilot. AI agents research, personalize, and
              reach out to your ideal prospects — while you focus on closing deals.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureRow icon={Bot} title="10 AI Agents" desc="Autonomous outreach at every stage" />
            <FeatureRow icon={TrendingUp} title="Revenue Pipeline" desc="Track meetings, replies, and conversions" />
            <FeatureRow icon={Users} title="Team Workspaces" desc="Collaborate with your entire team" />
          </div>
        </div>

        <div className="relative flex items-center justify-between">
          <p className="text-xs text-ink-500">© 2026 Revenue AI. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5 text-gold-400" />
            SOC 2 Type II
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative"
        style={{ background: 'radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.06), transparent 50%), linear-gradient(180deg, #2A0208, #3B0712)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/4 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="w-full max-w-sm relative">{children}</div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 group">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-gold-400 shrink-0 transition-all duration-300 group-hover:shadow-gold border border-gold-500/20"
        style={{ background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.08), rgba(120, 20, 40, 0.08))' }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-100">{title}</p>
        <p className="text-xs text-ink-400">{desc}</p>
      </div>
    </div>
  );
}
