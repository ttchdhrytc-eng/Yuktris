import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ConversationAIRecommendations, MeetingReadiness } from '@/types/conversation-ai';

type Props = {
  recommendations: ConversationAIRecommendations | null;
};

const readinessTones: Record<MeetingReadiness, 'success' | 'brand' | 'warning' | 'neutral'> = {
  handed_off: 'success',
  ready: 'success',
  almost_ready: 'brand',
  warming_up: 'warning',
  not_ready: 'neutral',
};

const readinessLabels: Record<MeetingReadiness, string> = {
  handed_off: 'Handed Off',
  ready: 'Ready',
  almost_ready: 'Almost Ready',
  warming_up: 'Warming Up',
  not_ready: 'Not Ready',
};

export function NextActionCard({ recommendations }: Props) {
  if (!recommendations) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No recommendations available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-brand-400" />
            <CardTitle>Next Best Action</CardTitle>
          </div>
          <Badge tone={readinessTones[recommendations.meeting_readiness]} dot>
            {readinessLabels[recommendations.meeting_readiness]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-ink-500 block mb-1">Executive Summary</span>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
          </div>
          <div className="rounded-lg border border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5 p-3">
            <span className="text-xs text-brand-400 block mb-1">Recommended Next Action</span>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_next_action}</p>
          </div>
          {recommendations.recommended_followup && (
            <div>
              <span className="text-xs text-ink-500 block mb-1">Recommended Follow-up</span>
              <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_followup}</p>
            </div>
          )}
          {recommendations.escalation_suggestion && (
            <div className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
              <span className="text-xs text-warning-500 block mb-1">Escalation Suggestion</span>
              <p className="text-sm text-ink-500 leading-relaxed">{recommendations.escalation_suggestion}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
