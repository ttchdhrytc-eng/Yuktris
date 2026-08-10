// ============================================================
// Google Calendar Service — Interface Placeholder
// ============================================================
// Future integration: Google Calendar API
// No implementation. Architecture only.

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  meet_link?: string;
}

export class GoogleCalendarService {
  async createEvent(_params: {
    summary: string;
    start: string;
    end: string;
    attendees: string[];
    description?: string;
  }): Promise<GoogleCalendarEvent> {
    throw new Error('GoogleCalendarService.createEvent() not implemented — architecture placeholder');
  }

  async updateEvent(_eventId: string, _params: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent> {
    throw new Error('GoogleCalendarService.updateEvent() not implemented — architecture placeholder');
  }

  async cancelEvent(_eventId: string): Promise<void> {
    throw new Error('GoogleCalendarService.cancelEvent() not implemented — architecture placeholder');
  }
}
