// ============================================================
// ConversationInboxPage — AI conversation inbox
// ============================================================
//
// Shows LinkedIn conversations with AI analysis, message
// history, reply suggestions, and approval workflow.

import { useState } from 'react';
import {
  MessageSquare, Send, Sparkles, Check, X,
  TrendingUp, AlertCircle, Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useLinkedInConversations, useLinkedInMessages, useApproveMessage,
} from '@/hooks/useLinkedInBrowser';
import { useAuth } from '@/hooks/useAuth';
import type { LinkedInConversation } from '@/types/linkedin-browser-automation';

export function ConversationInboxPage() {
  const conversations = useLinkedInConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = conversations.data ?? [];

  return (
    <div>
      <PageHeader
        title="Conversation Inbox"
        description="AI-powered LinkedIn conversation management with intent detection, sentiment analysis, and reply suggestions."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card>
            <div className="border-b border-gold-500/12 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink-50">Conversations</h3>
            </div>
            {conversations.isLoading ? (
              <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
            ) : list.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-ink-500">No conversations yet.</div>
            ) : (
              <div className="divide-y divide-border-subtle max-h-[600px] overflow-y-auto">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-card-800 transition-colors',
                      selectedId === c.id && 'bg-brand-300/10'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-50 truncate">{c.prospect_name}</span>
                      {c.unread_count > 0 && <Badge tone="brand" size="sm">{c.unread_count}</Badge>}
                    </div>
                    <p className="text-xs text-ink-400 truncate">{c.last_message_preview ?? 'No messages'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge tone={stageTone(c.stage)} size="sm">{c.stage}</Badge>
                      <Badge tone={healthTone(c.health)} size="sm">{c.health}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Message Thread */}
        <div className="lg:col-span-2">
          {selectedId ? (
            <MessageThread conversationId={selectedId} />
          ) : (
            <Card className="p-12 text-center text-sm text-ink-500">
              <MessageSquare className="h-8 w-8 text-ink-300 mx-auto mb-2" />
              Select a conversation to view messages.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageThread({ conversationId }: { conversationId: string }) {
  const messages = useLinkedInMessages(conversationId);
  const approveMessage = useApproveMessage();
  const { user } = useAuth();

  const list = messages.data ?? [];

  if (messages.isLoading) return <Card className="p-12 flex justify-center"><Spinner className="h-6 w-6" /></Card>;

  return (
    <Card>
      <div className="border-b border-gold-500/12 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink-50">Message Thread</h3>
      </div>
      <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto">
        {list.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">No messages in this conversation.</div>
        ) : (
          list.map((m) => (
            <div key={m.id} className={cn('px-4 py-3', m.direction === 'outbound' && 'bg-brand-300/10/30')}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  m.direction === 'inbound' ? 'bg-ink-100' : 'bg-brand-300/10'
                )}>
                  {m.direction === 'inbound' ? <MessageSquare className="h-4 w-4 text-ink-500" /> : <Send className="h-4 w-4 text-brand-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-ink-200">{m.sender_name ?? (m.direction === 'inbound' ? 'Prospect' : 'You')}</span>
                    {m.ai_generated && (
                      <Badge tone="brand" size="sm"><Sparkles className="h-3 w-3 inline mr-1" />AI</Badge>
                    )}
                    {m.ai_confidence !== null && (
                      <span className="text-xs text-ink-400">{Math.round(m.ai_confidence * 100)}% confidence</span>
                    )}
                    {m.approved && <Badge tone="success" size="sm"><Check className="h-3 w-3 inline" /></Badge>}
                  </div>
                  <p className="text-sm text-ink-600 whitespace-pre-wrap">{m.body}</p>
                  <p className="text-xs text-ink-400 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                  {m.ai_generated && !m.approved && user && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => approveMessage.mutate({ messageId: m.id, userId: user.id })}
                        disabled={approveMessage.isPending}
                        className="flex items-center gap-1 rounded-lg bg-success-500/10 px-2 py-1 text-xs font-medium text-success-500 hover:bg-success-500/20 transition-colors"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button className="flex items-center gap-1 rounded-lg bg-error-500/10 px-2 py-1 text-xs font-medium text-error-500 hover:bg-error-500/20 transition-colors">
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function stageTone(stage: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (stage) {
    case 'meeting_scheduled': case 'closed_won': return 'success';
    case 'qualified': case 'negotiation': return 'brand';
    case 'objection': return 'warning';
    case 'closed_lost': return 'error';
    default: return 'default';
  }
}

function healthTone(health: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (health) {
    case 'hot': case 'replied': return 'success';
    case 'active': return 'brand';
    case 'stalled': return 'warning';
    case 'dormant': case 'cold': return 'default';
    default: return 'default';
  }
}
