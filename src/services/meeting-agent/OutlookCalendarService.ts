// ============================================================
// Microsoft Outlook Calendar Service — Interface Placeholder
// ============================================================
// Future integration: Microsoft Graph API
// No implementation. Architecture only.

export interface OutlookMeetingEvent {
  id: string;
  subject: string;
  start: string;
  end: string;
  attendees: string[];
  teams_link?: string;
}

export class OutlookCalendarService {
  async createMeeting(_params: {
    subject: string;
    start: string;
    end: string;
    attendees: string[];
    body?: string;
  }): Promise<OutlookMeetingEvent> {
    throw new Error('OutlookCalendarService.createMeeting() not implemented — architecture placeholder');
  }

  async updateMeeting(_eventId: string, _params: Partial<OutlookMeetingEvent>): Promise<OutlookMeetingEvent> {
    throw new Error('OutlookCalendarService.updateMeeting() not implemented — architecture placeholder');
  }

  async cancelMeeting(_eventId: string): Promise<void> {
    throw new Error('OutlookCalendarService.cancelMeeting() not implemented — architecture placeholder');
  }
}
