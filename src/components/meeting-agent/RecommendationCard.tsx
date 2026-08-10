import { Lightbulb, ArrowRight, Users, CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { MeetingAIRecommendations } from '@/types/meeting-agent';

type Props = { recommendations: MeetingAIRecommendations };

export function RecommendationCard({ recommendations }: Props) {
  const readinessTone = recommendations.meeting_readiness === 'ready' || recommendations.meeting_readiness === 'handed_off' ? 'success' : recommendations.meeting_readiness === 'almost_ready' ? 'brand' : recommendations.meeting_readiness === 'warming_up' ? 'warning' : 'neutral';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Meeting Strategy</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.meeting_strategy}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Attendees</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.recommended_attendees.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Users className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500">{a}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-brand-400" />
              <CardTitle>Next Best Action</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.next_best_action}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-400" />
            <CardTitle>Post Meeting Recommendations</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recommendations.post_meeting_recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500 leading-relaxed">{r}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2 text-ink-500">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">Meeting Readiness</span>
          </div>
          <Badge tone={readinessTone as 'success' | 'brand' | 'warning' | 'neutral'} dot>{recommendations.meeting_readiness.replace(/_/g, ' ')}</Badge>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2 text-ink-500">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">AI Confidence</span>
          </div>
          <span className={cn('text-sm font-semibold', recommendations.confidence_score >= 80 ? 'text-success-400' : recommendations.confidence_score >= 60 ? 'text-brand-400' : 'text-warning-500')}>{recommendations.confidence_score}%</span>
        </Card>
      </div>
    </div>
  );
}
