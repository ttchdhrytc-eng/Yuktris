import { Globe, Linkedin, Facebook, Instagram, Twitter, Youtube, Github, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { DigitalPresence } from '@/types/company-research';

type Props = {
  presence: DigitalPresence[];
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Website: Globe,
  Blog: Globe,
  LinkedIn: Linkedin,
  Facebook: Facebook,
  Instagram: Instagram,
  'X (Twitter)': Twitter,
  YouTube: Youtube,
  GitHub: Github,
};

export function DigitalPresenceCard({ presence }: Props) {
  if (presence.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No digital presence data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-400" />
          <CardTitle>Digital Presence</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {presence.map((item) => {
            const Icon = platformIcons[item.platform] ?? Star;
            return (
              <div key={item.id} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-brand-400" />
                  <span className="text-xs font-medium text-ink-500">{item.platform}</span>
                </div>
                {item.url && (
                  <a href={`https://${item.url}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-400 hover:text-brand-300 block mb-1.5 truncate">
                    {item.url}
                  </a>
                )}
                <div className="flex items-center justify-between">
                  {item.followers && item.followers !== '—' && (
                    <span className="text-[10px] text-ink-500">{item.followers}</span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-ink-500">Activity</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className={cn('h-1 w-3 rounded-full', n <= Math.ceil(item.activity_score / 20) ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-maroon-950')} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
