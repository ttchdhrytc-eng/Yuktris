import { Mail, Linkedin, Video, Phone, UserPlus, MessageSquare, ArrowRight, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Touchpoint } from '@/types/outreach-strategy';

type Props = {
  touchpoints: Touchpoint[];
};

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin_connection: UserPlus,
  linkedin_message: MessageSquare,
  linkedin_followup: Linkedin,
  email: Mail,
  voice_note: Phone,
  video_message: Video,
  referral: ArrowRight,
  manual_task: FileText,
};

const channelLabels: Record<string, string> = {
  linkedin_connection: 'LinkedIn Connection',
  linkedin_message: 'LinkedIn Message',
  linkedin_followup: 'LinkedIn Follow-up',
  email: 'Email',
  voice_note: 'Voice Note',
  video_message: 'Video Message',
  referral: 'Referral',
  manual_task: 'Manual Task',
};

export function TouchpointTimeline({ touchpoints }: Props) {
  if (!touchpoints || touchpoints.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No touchpoints defined.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-400" />
          <CardTitle>Touchpoint Sequence</CardTitle>
          <Badge tone="brand">{touchpoints.length} touches</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {touchpoints.map((tp, i) => {
            const Icon = channelIcons[tp.channel] ?? Mail;
            return (
              <div key={tp.id ?? i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  {i < touchpoints.length - 1 && <div className="w-0.5 flex-1 min-h-[24px] bg-gradient-to-r from-gold-400 to-gold-300/30" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink-500">Touch {tp.sequence} — {channelLabels[tp.channel] ?? tp.channel}</span>
                    <Badge tone="neutral">{tp.timing ?? 'N/A'}</Badge>
                  </div>
                  <p className="text-xs text-ink-500 mb-1.5">{tp.purpose ?? 'N/A'}</p>
                  <div className="rounded-lg border border-gold-500/8 bg-card-900 px-3 py-1.5">
                    <span className="text-xs text-ink-500">CTA: </span>
                    <span className="text-xs text-ink-500">{tp.cta ?? 'N/A'}</span>
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
