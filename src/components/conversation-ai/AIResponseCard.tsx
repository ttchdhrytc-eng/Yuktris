import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ConversationAIResponse, ResponseType } from '@/types/conversation-ai';

type Props = {
  responses: ConversationAIResponse[];
};

const typeLabels: Record<ResponseType, string> = {
  recommended: 'Recommended Reply',
  alternative: 'Alternative Reply',
  followup: 'Follow-up Reply',
  escalation: 'Escalation / Human Review',
};

const typeTones: Record<ResponseType, 'success' | 'brand' | 'warning' | 'error'> = {
  recommended: 'success',
  alternative: 'brand',
  followup: 'brand',
  escalation: 'warning',
};

export function AIResponseCard({ responses }: Props) {
  if (!responses || responses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No AI responses generated yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <CardTitle>AI Response Center</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {responses.map((resp, i) => (
            <div key={resp.id ?? i} className={cn(
              'rounded-lg border p-3',
              resp.response_type === 'escalation' ? 'border-warning-500/30 bg-warning-500/5' : 'border-gold-500/8 bg-card-900',
            )}>
              <div className="flex items-center justify-between mb-2">
                <Badge tone={typeTones[resp.response_type]} dot>{typeLabels[resp.response_type]}</Badge>
                <span className={cn('text-xs font-semibold', resp.confidence >= 80 ? 'text-success-400' : resp.confidence >= 60 ? 'text-brand-400' : 'text-warning-500')}>
                  {resp.confidence}% confidence
                </span>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed mb-3">{resp.response_text}</p>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1 rounded-md border border-gold-500/8 bg-maroon-950 px-2 py-1 text-xs text-ink-500 hover:text-ink-500 transition-colors">
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button className="flex items-center gap-1 rounded-md border border-gold-500/8 bg-maroon-950 px-2 py-1 text-xs text-ink-500 hover:text-ink-500 transition-colors">
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button className="flex items-center gap-1 rounded-md border border-gold-500/8 bg-maroon-950 px-2 py-1 text-xs text-ink-500 hover:text-ink-500 transition-colors">
                  <X className="h-3 w-3" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
