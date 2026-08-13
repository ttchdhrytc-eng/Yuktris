import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, MessageSquare, Calendar,
  BarChart3, Plug, CreditCard, DollarSign, Settings, Sparkles, ChevronDown,
  ListOrdered, Monitor, UserCircle, Activity, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: string;
};

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/app/prospects', label: 'Prospects', icon: Users },
      { to: '/app/meetings', label: 'Meetings', icon: Calendar },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/app/analytics', label: 'Reports', icon: BarChart3 },
      { to: '/app/integrations', label: 'Integrations', icon: Plug },
      { to: '/app/execution-queue', label: 'Execution Queue', icon: ListOrdered },
      { to: '/app/browser', label: 'Browser Automation', icon: Monitor },
      { to: '/app/linkedin-accounts', label: 'LinkedIn Accounts', icon: UserCircle },
      { to: '/app/linkedin-automation', label: 'LinkedIn Automation', icon: UserCircle },
      { to: '/app/conversations', label: 'Conversations', icon: MessageSquare },
      { to: '/app/meeting-scheduler', label: 'Meeting Scheduler', icon: Calendar },
      { to: '/app/integration-health', label: 'Integration Health', icon: Activity },
      { to: '/app/payments', label: 'Payments', icon: CreditCard },
      { to: '/app/billing', label: 'Billing', icon: DollarSign },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { workspace, workspaces, switchWorkspace } = useWorkspace();
  const [wsOpen, setWsOpen] = useState(false);

  return (
    <aside className="flex h-full w-64 flex-col glass-sidebar shrink-0 relative">
      {/* Ambient gold glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-gold-500/6 blur-3xl" />
        <div className="absolute bottom-20 -left-10 h-32 w-32 rounded-full bg-wine-800/15 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-gold-500/10 shrink-0 relative z-10">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #E2B93B)',
            boxShadow: '0 4px 14px -2px rgba(212, 175, 55, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
          }}
        >
          <Sparkles className="h-4.5 w-4.5 text-maroon-950" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-ink-50 tracking-tight">Revenue AI</span>
          <span className="text-2xs text-ink-500">AI Operating System</span>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 py-3 border-b border-gold-500/10 shrink-0 relative z-10">
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-gold-500/12 hover:border-gold-500/30 transition-all duration-300 group backdrop-blur-md"
          style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.6), rgba(59, 7, 18, 0.6))' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold border border-gold-500/20"
            style={{ background: 'linear-gradient(145deg, rgba(100, 16, 30, 0.6), rgba(77, 16, 32, 0.6))', color: 'rgb(242 201 76)' }}
          >
            {(workspace?.name ?? 'W')[0]}
          </div>
          <span className="text-sm font-medium text-ink-200 truncate flex-1 text-left">
            {workspace?.name ?? 'No workspace'}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-ink-500 transition-transform group-hover:text-gold-400', wsOpen && 'rotate-180')} />
        </button>
        {wsOpen && workspaces.length > 1 && (
          <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-gold-500/20 z-50 py-1 animate-scale-in backdrop-blur-2xl"
            style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.95), rgba(88, 18, 37, 0.92))', boxShadow: '0 12px 40px -8px rgba(120, 20, 40, 0.5)' }}
          >
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => { setWsOpen(false); switchWorkspace(ws); onNavigate?.(); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gold-500/8 transition-colors text-left',
                  ws.id === workspace?.id ? 'text-gold-400 font-medium' : 'text-ink-300'
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-maroon-900/60 text-xs font-semibold text-ink-400 border border-gold-500/10">
                  {ws.name[0]}
                </div>
                <span className="truncate flex-1">{ws.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 relative z-10">
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-widest text-ink-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.to} {...item} onClick={onNavigate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Upgrade card */}
      <div className="px-3 py-3 shrink-0 relative z-10">
        <div
          className="rounded-2xl p-4 relative overflow-hidden border border-gold-500/20"
          style={{
            background: 'linear-gradient(145deg, rgba(100, 16, 30, 0.5), rgba(77, 16, 32, 0.4))',
            boxShadow: '0 8px 24px -8px rgba(120, 20, 40, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
          }}
        >
          <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full bg-gold-500/10 blur-2xl" />
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-gold-400" />
            <p className="text-sm font-semibold text-ink-50">Upgrade to Growth</p>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed mb-3">Unlock unlimited campaigns and prospects.</p>
          <button
            onClick={() => onNavigate?.()}
            className="w-full rounded-xl bg-gradient-to-r from-gold-400 to-gold-300 hover:from-gold-300 hover:to-neon-400 text-maroon-950 text-sm font-semibold py-2 transition-all duration-300 btn-gold-glow hover:shadow-gold-lg active:scale-[0.97]"
          >
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ to, label, icon: Icon, end, badge, onClick }: NavItem & { onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-premium',
          isActive
            ? 'text-gold-300 font-medium border border-gold-500/20'
            : 'text-ink-400 hover:text-ink-100 border border-transparent'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <>
              <span
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.12), rgba(120, 20, 40, 0.06))',
                  boxShadow: 'inset 3px 0 0 0 rgb(212 175 55), 0 0 16px -4px rgba(212, 175, 55, 0.15)',
                }}
              />
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-gradient-to-b from-gold-300 to-gold-500" style={{ boxShadow: '0 0 8px rgba(212, 175, 55, 0.4)' }} />
            </>
          )}
          <Icon className={cn('h-4.5 w-4.5 shrink-0 transition-all duration-300 group-hover:scale-105 relative z-10', isActive ? 'text-gold-400' : 'text-ink-400 group-hover:text-gold-300')} />
          <span className="truncate flex-1 relative z-10">{label}</span>
          {badge && (
            <span className="text-xs font-medium text-gold-400 bg-gold-500/10 rounded-full px-2 py-0.5 border border-gold-500/20 relative z-10">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
