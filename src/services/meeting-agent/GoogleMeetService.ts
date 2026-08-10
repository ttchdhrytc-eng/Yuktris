// ============================================================
// Google Meet Service — Interface Placeholder
// ============================================================
// Future integration: Google Meet / Google Calendar API
// No implementation. Architecture only.

export interface GoogleMeetMeeting {
  id: string;
  meet_link: string;
  conference_id: string;
  host_email: string;
}

export class GoogleMeetService {
  async createMeeting(_params: {
    calendar_event_id: string;
    host_email: string;
  }): Promise<GoogleMeetMeeting> {
    throw new Error('GoogleMeetService.createMeeting() not implemented — architecture placeholder');
  }

  async getMeeting(_conferenceId: string): Promise<GoogleMeetMeeting> {
    throw new Error('GoogleMeetService.getMeeting() not implemented — architecture placeholder');
  }
}
