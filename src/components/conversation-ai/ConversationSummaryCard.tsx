import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ConversationSummary } from '@/types/conversation-ai';

type Props = {
  summary: ConversationSummary | null;
};

export function ConversationSummaryCard({ summary }: Props) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No conversation summary available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-400" />
          <CardTitle>Conversation Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-ink-500 block mb-1">Summary</span>
            <p className="text-sm text-ink-500 leading-relaxed">{summary.summary}</p>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-1">Next Action</span>
            <p className="text-sm text-ink-500 leading-relaxed">{summary.next_action}</p>
          </div>
          {summary.executive_summary && (
            <div>
              <span className="text-xs text-ink-500 block mb-1">Executive Summary</span>
              <p className="text-sm text-ink-500 leading-relaxed">{summary.executive_summary}</p>
            </div>
          )}
          {summary.recommended_followup && (
            <div>
              <span className="text-xs text-ink-500 block mb-1">Recommended Follow-up</span>
              <p className="text-sm text-ink-500 leading-relaxed">{summary.recommended_followup}</p>
            </div>
          )}
          {summary.escalation_suggestion && (
            <div>
              <span className="text-xs text-ink-500 block mb-1">Escalation Suggestion</span>
              <p className="text-sm text-ink-500 leading-relaxed">{summary.escalation_suggestion}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
