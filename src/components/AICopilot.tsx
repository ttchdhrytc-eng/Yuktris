import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, X, Send, Bot, TrendingUp, Rocket,
  Users, Calendar, Zap, Target, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AICopilot() {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({
    queryKey: ['copilot-stats', workspace?.id],
    enabled: !!workspace?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!workspace) return null;
      const wsId = workspace.id;
      const [campaigns, prospects, meetings, msgs] = await Promise.all([
        supabase.from('campaigns').select('id, name, status', { count: 'exact' }).eq('workspace_id', wsId),
        supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'scheduled'),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('direction', 'sent'),
      ]);
      return {
        campaigns: campaigns.data ?? [],
        prospects: prospects.count ?? 0,
        meetings: meetings.count ?? 0,
        sentMessages: msgs.count ?? 0,
      };
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const buildContext = useCallback((): string => {
    if (!stats) return 'No data available yet.';
    const parts: string[] = [];
    parts.push(`Active campaigns: ${stats.campaigns.filter((c) => c.status === 'active').length}`);
    parts.push(`Total prospects: ${stats.prospects}`);
    parts.push(`Meetings booked: ${stats.meetings}`);
    parts.push(`Messages sent: ${stats.sentMessages}`);
    return parts.join('\n');
  }, [stats]);

  const proactiveSuggestions = getProactiveSuggestions(stats);

  const handleSend = async (promptText?: string) => {
    const text = promptText ?? input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          prompt: `You are Yuktris, an autonomous AI SDR (sales development representative). You speak in first person as "I" — you ARE the AI SDR. You are friendly, proactive, and natural. Never sound robotic.

Current workspace stats:
${buildContext()}

User question: ${text}

Respond naturally, as if you're an AI sales team member reporting to your manager. Be concise, specific, and actionable. Use natural language like "I'm finding prospects..." or "I've booked 3 meetings this week."`,
          max_tokens: 600,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      const assistantContent = data.text ?? data.content ?? data.choices?.[0]?.message?.content ?? "I'm having trouble right now. Please try again in a moment.";

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent, timestamp: Date.now() }]);
    } catch {
      const fallback = generateFallback(text, stats);
      setMessages((prev) => [...prev, { role: 'assistant', content: fallback, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button — always visible */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300 shadow-lg hover:bg-brand-300/20 hover:scale-110 transition-transform duration-200 ease-premium animate-fade-in"
          aria-label="Open AI Copilot"
        >
          <Sparkles className="h-5 w-5 text-ink-50" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-success-500 border-2 border-bg-base animate-pulse" />
        </button>
      )}

      {/* Copilot panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl border border-gold-500/12 bg-maroon-900 shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gold-500/8 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300">
                  <Sparkles className="h-4 w-4 text-ink-50" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success-500 border-2 border-bg-surface" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">Your AI SDR</p>
                <p className="text-[10px] text-success-500 flex items-center gap-1">
                  <span className="flex h-1 w-1 rounded-full bg-success-500 animate-pulse" />
                  Active & working
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-200 hover:bg-card-800 rounded-lg p-1.5 transition-colors" aria-label="Close copilot">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-brand-300/10 border border-brand-300/20 p-3">
                  <p className="text-xs text-ink-600 leading-relaxed">
                    {getGreeting(stats)}
                  </p>
                </div>
                <p className="text-[10px] text-ink-400 uppercase tracking-wider px-1">I recommend</p>
                <div className="space-y-2">
                  {proactiveSuggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.prompt)}
                      className="w-full flex items-center gap-2.5 rounded-lg border border-gold-500/12 bg-card-900 px-2.5 py-2 text-left hover:border-gold-500/25 hover:bg-card-800 transition-all duration-200"
                    >
                      <s.icon className="h-3.5 w-3.5 text-brand-300 shrink-0" />
                      <span className="text-xs text-ink-600 flex-1">{s.label}</span>
                      <ArrowRight className="h-3 w-3 text-ink-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed animate-fade-in-up',
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950'
                    : 'bg-card-900 border border-gold-500/12 text-ink-200'
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <Spinner className="h-3.5 w-3.5" />
                <span>I'm thinking...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gold-500/8 p-3 shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-gold-500/12 bg-card-900 pr-2 focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 focus:outline-none"
                aria-label="Copilot message input"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950 disabled:opacity-50 hover:bg-brand-300/20 transition-colors"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getGreeting(stats: { campaigns: any[]; prospects: number; meetings: number; sentMessages: number } | null | undefined): string {
  if (!stats || stats.campaigns.length === 0) {
    return "Hi! I'm your AI SDR. I'm ready to start finding prospects and booking meetings for you. Launch a campaign and I'll handle everything — research, outreach, follow-ups, and scheduling.";
  }
  const active = stats.campaigns.filter((c) => c.status === 'active').length;
  if (active === 0) {
    return `I've been preparing while you were away. I found ${stats.prospects} potential prospects. Launch a campaign and I'll start reaching out immediately.`;
  }
  return `I've been busy! I've sent ${stats.sentMessages} messages, found ${stats.prospects} prospects, and booked ${stats.meetings} meetings so far. Ask me anything about how things are going.`;
}

function getProactiveSuggestions(stats: { campaigns: any[]; prospects: number; meetings: number; sentMessages: number } | null | undefined) {
  if (!stats || stats.campaigns.length === 0) {
    return [
      { label: 'What can you do for me?', icon: Bot, prompt: 'What can you do for me?' },
      { label: 'How do campaigns work?', icon: Rocket, prompt: 'How do campaigns work?' },
      { label: 'Find me new prospects', icon: Users, prompt: 'Find me new prospects' },
    ];
  }
  const active = stats.campaigns.filter((c) => c.status === 'active').length;
  if (active === 0) {
    return [
      { label: 'Launch a campaign', icon: Rocket, prompt: 'Help me launch a campaign' },
      { label: 'Show me hot prospects', icon: Target, prompt: 'Show me my hottest prospects' },
      { label: 'Improve my ICP', icon: TrendingUp, prompt: 'How can I improve my ICP?' },
    ];
  }
  return [
    { label: 'How are my campaigns doing?', icon: TrendingUp, prompt: 'How are my campaigns doing?' },
    { label: 'Any new buying signals?', icon: Zap, prompt: 'Any new buying signals?' },
    { label: 'What needs my attention?', icon: Bot, prompt: 'What needs my attention right now?' },
    { label: 'When is my next meeting?', icon: Calendar, prompt: 'When is my next meeting?' },
  ];
}

function generateFallback(prompt: string, stats: { campaigns: any[]; prospects: number; meetings: number; sentMessages: number } | null | undefined): string {
  const lower = prompt.toLowerCase();

  if (!stats || stats.campaigns.length === 0) {
    if (lower.includes('what') || lower.includes('do for me') || lower.includes('help')) {
      return "Here's what I can do for you:\n\n• Find qualified prospects on LinkedIn automatically\n• Research every prospect and score them\n• Write personalized connection requests and messages\n• Send follow-ups at the right time\n• Handle replies and objections\n• Book meetings directly to your calendar\n• Update your CRM\n\nAll you need to do is launch a campaign. I'll handle the rest.";
    }
    if (lower.includes('campaign') || lower.includes('launch')) {
      return "To launch a campaign, go to the Campaigns page and click 'Launch Campaign.' I'll ask you to pick an ICP and choose your channels. After that, I handle everything — finding prospects, writing messages, and booking meetings.";
    }
    if (lower.includes('prospect') || lower.includes('find')) {
      return "I'm ready to find prospects for you! Once you launch a campaign, I'll search LinkedIn for companies matching your ICP, identify decision makers, and score every prospect automatically.";
    }
    return "I'm your AI SDR, ready to find prospects and book meetings for you. Launch a campaign and I'll handle everything from research to scheduling.";
  }

  const active = stats.campaigns.filter((c) => c.status === 'active').length;

  if (lower.includes('how') && (lower.includes('campaign') || lower.includes('doing'))) {
    return `You have ${stats.campaigns.length} campaign${stats.campaigns.length > 1 ? 's' : ''} total, ${active} active. I've sent ${stats.sentMessages} messages, found ${stats.prospects} prospects, and booked ${stats.meetings} meetings. ${active > 0 ? "I'm working on finding more prospects right now." : "Launch a campaign to start generating meetings."}`;
  }
  if (lower.includes('signal') || lower.includes('buying')) {
    return "I monitor buying signals 24/7 — funding announcements, hiring spikes, technology changes, and leadership moves. When I detect a strong signal, I prioritize that prospect and adjust my outreach timing.";
  }
  if (lower.includes('attention') || lower.includes('need') || lower.includes('approval')) {
    return "Right now, everything is running smoothly. I'll notify you when a prospect replies positively, when a meeting is booked, or if I need your approval for a proposal. You can relax — I've got this.";
  }
  if (lower.includes('meeting') || lower.includes('calendar') || lower.includes('schedule')) {
    return stats.meetings > 0
      ? `I've booked ${stats.meetings} meeting${stats.meetings > 1 ? 's' : ''} so far. Check the Meetings page for your upcoming schedule — I'll have a full brief ready for each one.`
      : "No meetings booked yet. Once prospects start replying positively, I'll book meetings directly to your calendar and prepare a briefing for each one.";
  }
  if (lower.includes('icp') || lower.includes('target') || lower.includes('improve')) {
    return "I can adjust your ICP based on which prospects are responding best. I'm continuously learning from campaign results — if certain industries or company sizes reply more, I'll shift focus there automatically.";
  }
  if (lower.includes('prospect') || lower.includes('find') || lower.includes('hot')) {
    return `I've found ${stats.prospects} prospects so far. I score each one based on ICP fit, buying signals, and timing. The hottest prospects — those most likely to book a meeting — are prioritized in my outreach queue.`;
  }
  return "I'm your AI SDR. I'm finding prospects, sending outreach, and booking meetings for you. Ask me about campaign performance, buying signals, upcoming meetings, or what needs your attention.";
}
