import { Heart, Users, Eye, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/decision-maker-research';

type Props = {
  contact: Contact | null;
};

export function RelationshipScoreCard({ contact }: Props) {
  if (!contact) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No relationship data available.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { icon: Heart, label: 'Decision Power', value: contact.decision_power },
    { icon: Users, label: 'Influence', value: contact.influence_score },
    { icon: Eye, label: 'Public Visibility', value: contact.activity_score },
    { icon: Network, label: 'Relationship Score', value: contact.relationship_score },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-brand-400" />
          <CardTitle>Relationship Intelligence</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map((m) => {
            const tone = m.value >= 85 ? '#22c55e' : m.value >= 70 ? '#eab308' : '#ef4444';
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (m.value / 100) * circumference;
            return (
              <div key={m.label} className="flex items-center gap-3">
                <div className="relative flex h-16 w-16 items-center justify-center shrink-0">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#27272a" strokeWidth="5" />
                    <circle cx="50" cy="50" r={radius} fill="none" stroke={tone} strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
                  </svg>
                  <span className="relative text-sm font-semibold text-ink-500">{m.value}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <m.icon className="h-3.5 w-3.5 text-ink-500" />
                    <span className="text-xs text-ink-500">{m.label}</span>
                  </div>
                  <p className={cn('text-sm font-medium', m.value >= 85 ? 'text-success-400' : m.value >= 70 ? 'text-warning-500' : 'text-error-400')}>
                    {m.value >= 85 ? 'High' : m.value >= 70 ? 'Medium' : 'Low'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
