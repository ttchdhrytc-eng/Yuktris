import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox, Linkedin, Reply, Search, Send } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { timeAgo, cn } from '@/lib/utils';

type Conversation = { id: string; prospect_name: string; prospect_company: string | null; stage: string; last_message_at: string | null; last_message_preview: string | null; last_message_direction: string | null; metadata: Record<string, unknown> };
type LinkedInMessage = { id: string; direction: string; body: string; sent_at: string | null; created_at: string; metadata: Record<string, unknown> };
type ReplyState = { conversation_id: string | null; classification: string; metadata: Record<string, unknown> };
const isFixture = (metadata?: Record<string, unknown> | null) => metadata?.fixture === true || metadata?.test_fixture === true || metadata?.execution_fixture === true;

export function InboxPage() {
  const { workspace } = useWorkspace();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const inbox = useQuery({
    queryKey: ['linkedin-inbox-v1', workspace?.id], enabled: !!workspace?.id,
    queryFn: async () => {
      const [conversations, replies] = await Promise.all([
        supabase.from('linkedin_conversations').select('id,prospect_name,prospect_company,stage,last_message_at,last_message_preview,last_message_direction,metadata').eq('workspace_id', workspace!.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(100),
        supabase.from('linkedin_inbound_replies').select('conversation_id,classification,metadata').eq('workspace_id', workspace!.id).eq('match_status', 'matched').order('received_at', { ascending: false }).limit(200),
      ]);
      if (conversations.error) throw conversations.error;
      if (replies.error) throw replies.error;
      const classifications = new Map<string, string>();
      for (const reply of (replies.data ?? []) as ReplyState[]) if (reply.conversation_id && !isFixture(reply.metadata) && !classifications.has(reply.conversation_id)) classifications.set(reply.conversation_id, reply.classification);
      return ((conversations.data ?? []) as Conversation[]).filter((row) => !isFixture(row.metadata)).map((conversation) => ({ conversation, classification: classifications.get(conversation.id) }));
    },
  });
  const rows = useMemo(() => (inbox.data ?? []).filter(({ conversation }) => !search.trim() || `${conversation.prospect_name} ${conversation.prospect_company ?? ''} ${conversation.last_message_preview ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())), [inbox.data, search]);
  const thread = useQuery({
    queryKey: ['linkedin-inbox-thread-v1', workspace?.id, selected], enabled: !!workspace?.id && !!selected,
    queryFn: async () => { const { data, error } = await supabase.from('linkedin_messages').select('id,direction,body,sent_at,created_at,metadata').eq('workspace_id', workspace!.id).eq('conversation_id', selected!).order('created_at'); if (error) throw error; return ((data ?? []) as LinkedInMessage[]).filter((message) => !isFixture(message.metadata)); },
  });
  const selectedRow = rows.find(({ conversation }) => conversation.id === selected);

  return <div>
    <PageHeader title="Inbox" description="Genuine LinkedIn conversations and replies from your campaigns." />
    <div className="mb-4 relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search LinkedIn conversations..." className="pl-9" /></div>
    {inbox.isLoading ? <div className="flex justify-center py-20"><Spinner /></div> : inbox.isError ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="Inbox temporarily unavailable" description="LinkedIn conversations could not be loaded. No outreach was started." /> : rows.length ?
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="overflow-hidden"><div className="max-h-[640px] overflow-y-auto">{rows.map(({ conversation, classification }) => <button key={conversation.id} onClick={() => setSelected(conversation.id)} className={cn('w-full text-left px-4 py-3 border-b border-gold-500/8 hover:bg-card-800', selected === conversation.id && 'bg-card-900')}><div className="flex gap-2"><Linkedin className="h-4 w-4 mt-1 text-brand-400" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-sm font-medium text-ink-100 truncate">{conversation.prospect_name}</p><span className="text-[10px] text-ink-500">{conversation.last_message_at ? timeAgo(conversation.last_message_at) : ''}</span></div><p className="text-xs text-ink-500 truncate">{conversation.prospect_company ?? 'LinkedIn prospect'}</p><p className="text-xs text-ink-400 truncate mt-1">{conversation.last_message_preview ?? 'No message preview'}</p><div className="flex gap-1 mt-1"><Badge tone={conversation.last_message_direction === 'inbound' ? 'success' : 'brand'}>{conversation.last_message_direction ?? conversation.stage}</Badge>{classification && <Badge tone={classification === 'unknown' ? 'warning' : 'neutral'}>{classification.replaceAll('_', ' ')}</Badge>}</div></div></div></button>)}</div></Card>
        <Card className="lg:col-span-2"><CardContent>{selectedRow ? <><div className="mb-4 pb-4 border-b border-gold-500/8"><h3 className="font-semibold text-ink-100">{selectedRow.conversation.prospect_name}</h3><p className="text-xs text-ink-500">{selectedRow.conversation.prospect_company ?? 'LinkedIn'} · {selectedRow.conversation.stage.replaceAll('_', ' ')}</p></div>{thread.isLoading ? <Spinner /> : thread.data?.length ? <div className="space-y-3">{thread.data.map((message) => <div key={message.id} className={cn('flex', message.direction === 'outbound' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[85%] rounded-xl px-3 py-2', message.direction === 'outbound' ? 'bg-brand-500/10' : 'bg-card-800')}><div className="flex gap-1 text-xs text-ink-500">{message.direction === 'outbound' ? <Send className="h-3 w-3" /> : <Reply className="h-3 w-3" />}{message.direction}</div><p className="text-sm text-ink-200 whitespace-pre-wrap mt-1">{message.body}</p><p className="text-[10px] text-ink-500 mt-1">{new Date(message.sent_at ?? message.created_at).toLocaleString()}</p></div></div>)}</div> : <EmptyState icon={<Inbox className="h-5 w-5" />} title="No genuine messages" description="Fixtures and diagnostics are excluded." />}</> : <EmptyState icon={<Inbox className="h-5 w-5" />} title="Select a conversation" description="Choose a LinkedIn conversation to view its messages." />}</CardContent></Card>
      </div> : <EmptyState icon={<Inbox className="h-5 w-5" />} title="No LinkedIn conversations yet" description="Genuine messages and replies will appear here. Fixtures and diagnostics are excluded." />}
  </div>;
}
