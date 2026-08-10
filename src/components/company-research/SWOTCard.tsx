import { TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Shield, Crosshair } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { CompanyBusinessAnalysis } from '@/types/company-research';

type Props = {
  analysis: CompanyBusinessAnalysis | null;
};

export function SWOTCard({ analysis }: Props) {
  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No business analysis available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SWOTSection icon={TrendingUp} label="Strengths" items={analysis.strengths} iconColor="text-success-400" bgClass="border-success-500/20 bg-success-500/5" />
        <SWOTSection icon={TrendingDown} label="Weaknesses" items={analysis.weaknesses} iconColor="text-error-400" bgClass="border-error-500/20 bg-error-500/5" />
        <SWOTSection icon={Lightbulb} label="Opportunities" items={analysis.opportunities} iconColor="text-brand-400" bgClass="border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5" />
        <SWOTSection icon={AlertTriangle} label="Threats" items={analysis.threats} iconColor="text-warning-500" bgClass="border-warning-500/20 bg-warning-500/5" />
      </div>

      {analysis.business_risks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-error-400" />
              <CardTitle>Business Risks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.business_risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-3">
                  <AlertTriangle className="h-3.5 w-3.5 text-error-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-ink-500 leading-relaxed">{risk}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-brand-400" />
            <CardTitle>Market Position & Competitive Advantages</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {analysis.market_position && (
            <p className="text-sm text-ink-500 leading-relaxed mb-4">{analysis.market_position}</p>
          )}
          {analysis.competitive_advantages.length > 0 && (
            <div>
              <span className="text-xs font-medium text-ink-500 block mb-2">Competitive Advantages</span>
              <div className="space-y-2">
                {analysis.competitive_advantages.map((adv, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <TrendingUp className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-ink-500 leading-relaxed">{adv}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SWOTSection({ icon: Icon, label, items, iconColor, bgClass }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
  iconColor: string;
  bgClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-sm font-semibold text-ink-500">{label}</h4>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <p key={i} className="text-xs text-ink-500 leading-relaxed">{item}</p>
        ))}
      </div>
    </div>
  );
}
