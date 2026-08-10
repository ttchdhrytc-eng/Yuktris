import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CommunicationProfile } from '@/types/personalization';

type Props = {
  profile: CommunicationProfile | null;
};

export function CommunicationProfileCard({ profile }: Props) {
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No communication profile available.</p>
        </CardContent>
      </Card>
    );
  }

  const traits = [
    { label: 'Tone', value: profile.tone.replace('_', ' '), bar: null },
    { label: 'Writing Style', value: profile.writing_style, bar: null },
    { label: 'Length Preference', value: profile.length_preference, bar: null },
    { label: 'Professionality', value: `${profile.professionality}%`, bar: profile.professionality },
    { label: 'Humor Level', value: `${profile.humor_level}%`, bar: profile.humor_level },
    { label: 'Directness', value: `${profile.directness}%`, bar: profile.directness },
    { label: 'Urgency', value: `${profile.urgency}%`, bar: profile.urgency },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-400" />
          <CardTitle>Communication Profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {traits.map((t) => (
            <div key={t.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block mb-1">{t.label}</span>
              <p className="text-sm font-medium text-ink-500 capitalize">{t.value}</p>
              {t.bar !== null && (
                <div className="mt-2 h-1.5 rounded-full bg-maroon-950 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', t.bar >= 75 ? 'bg-success-500' : t.bar >= 50 ? 'bg-warning-500' : 'bg-gray-500')}
                    style={{ width: `${t.bar}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
