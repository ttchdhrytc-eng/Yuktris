import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Search, Bell, LogOut, ChevronDown, Settings, Command, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import { cn, timeAgo } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  action_url: string | null;
  created_at: string;
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user?.email
    : user?.email;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, action_url, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as Notification[];
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) return;
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('workspace_id', workspace.id).is('read_at', 'null');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNotifClick = (n: Notification) => {
    if (!n.read_at) markReadMutation.mutate(n.id);
    setNotifOpen(false);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <header className="flex h-16 items-center justify-between px-5 shrink-0 glass-nav relative z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-ink-400 hover:text-gold-400 p-2 rounded-xl hover:bg-gold-500/8 transition-all duration-300"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          onClick={() => navigate('/app/prospects')}
          className={cn(
            'hidden sm:flex items-center gap-2 rounded-xl px-3 h-9 w-72 transition-all duration-300 backdrop-blur-md',
            searchFocused ? 'border-gold-500/40' : 'border-gold-500/12 hover:border-gold-500/25'
          )}
          style={{ background: searchFocused ? 'rgba(77, 16, 32, 0.5)' : 'rgba(59, 7, 18, 0.4)' }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        >
          <Search className="h-4 w-4 text-ink-500" />
          <span className="text-sm text-ink-500 flex-1 text-left">Search prospects, campaigns...</span>
          <kbd className="flex items-center gap-0.5 text-2xs text-ink-500 bg-maroon-950/60 border border-gold-500/10 rounded px-1.5 py-0.5 font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {/* AI Status indicator */}
        <div
          className="hidden md:flex items-center gap-2 rounded-xl px-3 h-9 mr-1 backdrop-blur-md border border-gold-500/12"
          style={{ background: 'rgba(59, 7, 18, 0.4)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-neon-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-500 glow-neon" />
          </span>
          <span className="text-xs text-ink-200 font-medium">AI Active</span>
          <Sparkles className="h-3.5 w-3.5 text-gold-400" />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative text-ink-400 hover:text-gold-400 p-2 rounded-xl hover:bg-gold-500/8 transition-all duration-300"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-error-500 text-ink-50 text-2xs font-bold flex items-center justify-center border border-maroon-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-80 rounded-2xl border border-gold-500/20 animate-scale-in z-50 backdrop-blur-2xl overflow-hidden"
              style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.95), rgba(88, 18, 37, 0.92))', boxShadow: '0 12px 40px -8px rgba(120, 20, 40, 0.5)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gold-500/10">
                <p className="text-sm font-semibold text-ink-50">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {!notifications || notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-5 w-5 text-ink-600 mx-auto mb-2" />
                    <p className="text-xs text-ink-500">No notifications yet</p>
                    <p className="text-2xs text-ink-600 mt-1">Meeting bookings and replies will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gold-500/8">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gold-500/6 transition-colors',
                          !n.read_at && 'bg-gold-500/5'
                        )}
                      >
                        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5', getNotifIconBg(n.type))}>
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink-100 truncate">{n.title}</p>
                          {n.body && <p className="text-2xs text-ink-400 mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-2xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-neon-500 shrink-0 mt-2 glow-neon" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-gold-500/10 px-4 py-2">
                <button
                  onClick={() => { setNotifOpen(false); navigate('/app/notifications'); }}
                  className="w-full text-center text-xs text-ink-400 hover:text-gold-400 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-gold-500/8 transition-all duration-300"
            aria-label="User menu"
          >
            <Avatar name={displayName ?? 'U'} size="sm" />
            <div className="hidden sm:block text-left">
              <p className="text-xs text-ink-100 max-w-[140px] truncate font-medium leading-tight">{displayName}</p>
              <p className="text-2xs text-ink-500 capitalize leading-tight">{profile?.role?.replace(/_/g, ' ') ?? ''}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-ink-500" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-56 rounded-2xl border border-gold-500/20 animate-scale-in py-1 z-50 backdrop-blur-2xl overflow-hidden"
              style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.95), rgba(88, 18, 37, 0.92))', boxShadow: '0 12px 40px -8px rgba(120, 20, 40, 0.5)' }}
            >
              <div className="px-3 py-2.5 border-b border-gold-500/10">
                <p className="text-xs font-medium text-ink-100 truncate">{displayName}</p>
                <p className="text-2xs text-ink-500 mt-0.5">{workspace?.name ?? 'No workspace'}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/app/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-300 hover:bg-gold-500/8 hover:text-gold-400 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/app/integrations'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-300 hover:bg-gold-500/8 hover:text-gold-400 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Integrations
              </button>
              <div className="my-1 border-t border-gold-500/10" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink-300 hover:bg-error-500/8 hover:text-error-500 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getNotifIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    meeting: <Check className="h-3.5 w-3.5 text-success-500" />,
    reply: <Bell className="h-3.5 w-3.5 text-gold-400" />,
    signal: <Bell className="h-3.5 w-3.5 text-warning-500" />,
    warning: <Bell className="h-3.5 w-3.5 text-error-500" />,
  };
  return icons[type] ?? <Bell className="h-3.5 w-3.5 text-ink-500" />;
}

function getNotifIconBg(type: string) {
  const bgs: Record<string, string> = {
    meeting: 'bg-success-500/10',
    reply: 'bg-gold-500/10',
    signal: 'bg-warning-500/10',
    warning: 'bg-error-500/10',
  };
  return bgs[type] ?? 'bg-maroon-800/40';
}
