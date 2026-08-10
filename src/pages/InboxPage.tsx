import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox, Send, Reply, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { timeAgo, cn } from '@/lib/utils';
import type { Message } from '@/types';

export function InboxPage() {
  const { workspace } = useWorkspace();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', workspace?.id, search],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      let q = supabase
        .from('messages')
        .select('*, prospect:prospects(*)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (search) q = q.or(`body.ilike.%${search}%,subject.ilike.%${search}%`);
      const { data } = await q.limit(100);
      return (data ?? []) as Message[];
    },
  });

  const selectedMsg = messages?.find((m) => m.id === selected);

  return (
    <div>
      <PageHeader title="Inbox" description="All messages from your outreach campaigns." />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : messages && messages.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Message list */}
          <Card className="lg:col-span-1 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setSelected(msg.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gold-500/8 hover:bg-card-800 transition-colors',
                    selected === msg.id && 'bg-card-900'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                      msg.direction === 'sent' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' : 'bg-success-500/10 text-success-400'
                    )}>
                      {msg.direction === 'sent' ? <Send className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-500 truncate">
                          {msg.prospect ? `${msg.prospect.first_name ?? ''} ${msg.prospect.last_name ?? ''}`.trim() : 'Unknown'}
                        </p>
                        <span className="text-[10px] text-ink-500 shrink-0 ml-2">{timeAgo(msg.created_at)}</span>
                      </div>
                      <p className="text-xs text-ink-500 truncate mt-0.5">
                        {msg.subject ?? msg.body?.slice(0, 60) ?? 'No content'}
                      </p>
                      <Badge tone={msg.direction === 'sent' ? 'brand' : 'success'} className="mt-1">
                        {msg.direction}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Message detail */}
          <Card className="lg:col-span-2">
            <CardContent>
              {selectedMsg ? (
                <div>
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gold-500/8">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-500">
                        {selectedMsg.subject ?? 'No subject'}
                      </h3>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {selectedMsg.prospect
                          ? `${selectedMsg.prospect.first_name ?? ''} ${selectedMsg.prospect.last_name ?? ''}`.trim()
                          : 'Unknown prospect'}
                        {' · '}{selectedMsg.channel}
                      </p>
                    </div>
                    <Badge tone={selectedMsg.direction === 'sent' ? 'brand' : 'success'}>
                      {selectedMsg.direction}
                    </Badge>
                  </div>
                  <div className="text-sm text-ink-500 whitespace-pre-wrap leading-relaxed">
                    {selectedMsg.body ?? 'No content'}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gold-500/8 text-xs text-ink-500">
                    {new Date(selectedMsg.created_at).toLocaleString('en-US')}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="Select a message"
                  description="Choose a message from the list to view its full content."
                  className="py-12"
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No messages yet"
          description="Messages sent and received from your campaigns will appear here."
        />
      )}
    </div>
  );
}
