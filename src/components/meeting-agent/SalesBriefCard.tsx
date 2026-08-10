import { Briefcase, BookOpen, DollarSign, Swords, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { MeetingPreparation } from '@/types/meeting-agent';

type Props = { preparation: MeetingPreparation | null };

export function SalesBriefCard({ preparation }: Props) {
  if (!preparation) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No sales preparation available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-400" />
            <CardTitle>Agenda</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {preparation.agenda.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 text-xs font-semibold shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-ink-500 leading-relaxed">{item}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-400" />
            <CardTitle>Case Studies</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {preparation.case_studies.map((cs, i) => (
              <div key={i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-ink-500">{cs.name}</p>
                  <span className="text-xs text-ink-500">{cs.industry}</span>
                </div>
                <p className="text-sm text-success-400 mb-1">{cs.result}</p>
                <p className="text-xs text-ink-500">{cs.relevance}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success-400" />
              <CardTitle>Pricing Guidance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{preparation.pricing_notes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-warning-500" />
              <CardTitle>Competitive Insights</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{preparation.competitive_notes}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success-400" />
              <CardTitle>Key Opportunities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {preparation.key_opportunities.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500 leading-relaxed">{o}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-error-500" />
              <CardTitle>Risks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {preparation.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-error-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500 leading-relaxed">{r}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
