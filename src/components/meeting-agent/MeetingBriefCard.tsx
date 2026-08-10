import { FileText, Building2, MessagesSquare, Lightbulb, HelpCircle, Package, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { MeetingBrief } from '@/types/meeting-agent';

type Props = { brief: MeetingBrief | null };

export function MeetingBriefCard({ brief }: Props) {
  if (!brief) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No meeting brief available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{brief.executive_summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-400" />
              <CardTitle>Company Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{brief.company_summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4 text-brand-400" />
              <CardTitle>Conversation Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{brief.conversation_summary}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Talking Points</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {brief.recommended_talking_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500 leading-relaxed">{point}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Questions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {brief.recommended_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <HelpCircle className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500 leading-relaxed">{q}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Services</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {brief.recommended_services.map((s, i) => (
                <span key={i} className="rounded-lg border border-gold-500/8 bg-card-900 px-2.5 py-1 text-xs text-ink-500">{s}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              <CardTitle>Potential Objections</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {brief.potential_objections.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500 leading-relaxed">{o}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-success-400" />
              <CardTitle>Expected Outcomes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {brief.expected_outcomes.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Target className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500 leading-relaxed">{o}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
