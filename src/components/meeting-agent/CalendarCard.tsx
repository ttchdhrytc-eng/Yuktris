import { Calendar, Clock, Check, X, Link2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { CalendarInfo, TimeSlot } from '@/types/meeting-agent';

type Props = { calendar: CalendarInfo };

export function CalendarCard({ calendar }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-400" />
          <CardTitle>Calendar</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-ink-500 block mb-2">Available Slots</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {calendar.available_slots.map((slot) => (
                <SlotButton key={slot.id} slot={slot} selected={calendar.selected_slot?.id === slot.id} />
              ))}
            </div>
          </div>

          {calendar.selected_slot && (
            <div className="rounded-lg border border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5 p-3">
              <span className="text-xs text-brand-400 block mb-1">Selected Slot</span>
              <p className="text-sm text-ink-500">{calendar.selected_slot.label}</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {new Date(calendar.selected_slot.start_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          )}

          <div>
            <span className="text-xs text-ink-500 block mb-2">Participants</span>
            <div className="space-y-2">
              {calendar.participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
                  <Users className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-500 truncate">{p.name}</p>
                    <p className="text-xs text-ink-500 truncate">{p.email}</p>
                  </div>
                  <Badge tone={p.required ? 'brand' : 'neutral'}>{p.role}</Badge>
                </div>
              ))}
            </div>
          </div>

          {calendar.meeting_link && (
            <div className="flex items-center gap-2 rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <Link2 className="h-3.5 w-3.5 text-brand-400 shrink-0" />
              <span className="text-xs text-ink-500">Meeting Link:</span>
              <span className="text-xs text-brand-400 truncate flex-1">{calendar.meeting_link}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <span className="text-xs text-ink-500">Calendar Sync</span>
            <Badge tone={calendar.calendar_synced ? 'success' : 'neutral'} dot>
              {calendar.calendar_synced ? 'Synced' : 'Pending'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SlotButton({ slot, selected }: { slot: TimeSlot; selected: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors',
        selected
          ? 'border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400'
          : slot.available
            ? 'border-gold-500/8 bg-card-900 text-ink-500'
            : 'border-gold-500/12 bg-maroon-950 text-ink-500 line-through',
      )}
    >
      {selected ? <Check className="h-3 w-3" /> : !slot.available ? <X className="h-3 w-3" /> : <Clock className="h-3 w-3 text-ink-500" />}
      {slot.label}
    </div>
  );
}
