// ============================================================
// MeetingSchedulerPage — Meeting booking & calendar management
// ============================================================

import { useState } from 'react';
import {
  Calendar, Video, Check, Clock, Plus,
  Mail, Building, User,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useCalendarConnections, useMeetingRequests,
  useMeetingSlots, useMeetingConfirmations,
} from '@/hooks/useLinkedInBrowser';

export function MeetingSchedulerPage() {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const connections = useCalendarConnections();
  const requests = useMeetingRequests();
  const confirmations = useMeetingConfirmations();

  return (
    <div>
      <PageHeader
        title="Meeting Scheduler"
        description="Find free slots, generate Google Meet links, send LinkedIn messages, and manage meeting reminders."
      />

      {/* Calendar Connections */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-ink-50 mb-3">Calendar Connections</h3>
        {connections.isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
        ) : (connections.data ?? []).length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-500">
            <Calendar className="h-6 w-6 text-ink-300 mx-auto mb-2" />
            No calendar connections yet. Connect Google Calendar or Outlook to get started.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(connections.data ?? []).map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-300/10">
                    <Calendar className="h-4 w-4 text-brand-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-50 truncate">{c.email}</p>
                    <p className="text-xs text-ink-400 capitalize">{c.provider}</p>
                  </div>
                  <Badge tone={c.status === 'active' ? 'success' : 'error'} size="sm">{c.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Meeting Requests */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50 mb-3">Meeting Requests</h3>
          {requests.isLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : (requests.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-ink-500">No meeting requests yet.</Card>
          ) : (
            <Card>
              <div className="divide-y divide-border-subtle">
                {(requests.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequestId(r.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-card-800 transition-colors',
                      selectedRequestId === r.id && 'bg-brand-300/10'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-50">{r.prospect_name}</span>
                      <Badge tone={meetingStatusTone(r.status)} size="sm">{r.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span>{r.meeting_type}</span>
                      <span>{r.duration_minutes} min</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Slots / Confirmations */}
        <div>
          {selectedRequestId ? (
            <MeetingSlotsView meetingRequestId={selectedRequestId} />
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-ink-50 mb-3">Confirmed Meetings</h3>
              {confirmations.isLoading ? (
                <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
              ) : (confirmations.data ?? []).length === 0 ? (
                <Card className="p-6 text-center text-sm text-ink-500">No confirmed meetings yet.</Card>
              ) : (
                <Card>
                  <div className="divide-y divide-border-subtle">
                    {(confirmations.data ?? []).map((c) => (
                      <div key={c.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Video className="h-3.5 w-3.5 text-brand-500" />
                          <span className="text-sm font-medium text-ink-50">
                            {new Date(c.confirmed_start).toLocaleString()}
                          </span>
                        </div>
                        {c.meeting_url && (
                          <a href={c.meeting_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-300 hover:underline truncate block">
                            {c.meeting_url}
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {c.prospect_confirmed && <Badge tone="success" size="sm"><Check className="h-3 w-3 inline" />Confirmed</Badge>}
                          {c.linkedin_notified && <Badge tone="brand" size="sm">LinkedIn notified</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MeetingSlotsView({ meetingRequestId }: { meetingRequestId: string }) {
  const slots = useMeetingSlots(meetingRequestId);
  const list = slots.data ?? [];

  if (slots.isLoading) return <Card className="p-12 flex justify-center"><Spinner className="h-6 w-6" /></Card>;

  const available = list.filter((s) => s.status === 'available');
  const confirmed = list.filter((s) => s.status === 'confirmed');

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-50 mb-3">Available Slots</h3>
      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-500">No slots generated yet.</Card>
      ) : (
        <Card>
          <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
            {list.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-ink-400" />
                  <span className="text-sm text-ink-200">
                    {new Date(s.start_time).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {s.conflict_detected && <Badge tone="error" size="sm">Conflict</Badge>}
                  <Badge tone={s.status === 'confirmed' ? 'success' : s.status === 'available' ? 'brand' : 'default'} size="sm">
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function meetingStatusTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'confirmed': case 'completed': return 'success';
    case 'slots_proposed': case 'slots_generated': return 'brand';
    case 'cancelled': case 'no_show': return 'error';
    default: return 'default';
  }
}
