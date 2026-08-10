import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, Calendar, MessageSquare,
  Flame, AlertTriangle, ArrowRight, BellOff,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
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

export function NotificationsPage() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications-all', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, action_url, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data ?? []) as Notification[];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) return;
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('workspace_id', workspace.id).is('read_at', 'null');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Notifications" description="Meeting bookings, replies, and signals" />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Meeting bookings, replies, and signals from your AI SDR"
        actions={
          unreadCount > 0 ? (
            <Button size="sm" variant="outline" onClick={() => markAllReadMutation.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {!notifications || notifications.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<BellOff className="h-5 w-5" />}
              title="No notifications yet"
              description="When your AI SDR books a meeting, receives a reply, or detects a buying signal, you'll see it here."
              action={<Button size="sm" onClick={() => navigate('/app/campaigns')}>View Campaigns</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn('p-4 hover-lift cursor-pointer', !n.read_at && 'border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5')}
              onClick={() => {
                if (!n.read_at) markReadMutation.mutate(n.id);
                if (n.action_url) navigate(n.action_url);
              }}
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', getNotifBg(n.type))}>
                  {getNotifIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-500">{n.title}</p>
                    {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-300" />}
                  </div>
                  {n.body && <p className="text-xs text-ink-500 mt-1 leading-relaxed">{n.body}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-ink-500">{timeAgo(n.created_at)}</span>
                    {n.action_url && (
                      <span className="text-[10px] text-brand-400 font-medium flex items-center gap-0.5">
                        View <ArrowRight className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function getNotifIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    meeting: <Check className="h-4 w-4 text-success-400" />,
    reply: <MessageSquare className="h-4 w-4 text-brand-400" />,
    signal: <Flame className="h-4 w-4 text-warning-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-error-400" />,
  };
  return icons[type] ?? <Bell className="h-4 w-4 text-ink-500" />;
}

function getNotifBg(type: string) {
  const bgs: Record<string, string> = {
    meeting: 'bg-success-500/10',
    reply: 'bg-gradient-to-r from-gold-400 to-gold-300/10',
    signal: 'bg-warning-500/10',
    warning: 'bg-error-500/10',
  };
  return bgs[type] ?? 'bg-card-900';
}
