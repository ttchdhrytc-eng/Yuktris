// ============================================================
// Zoom Service — Interface Placeholder
// ============================================================
// Future integration: Zoom API
// No implementation. Architecture only.

export interface ZoomMeeting {
  id: string;
  join_url: string;
  password: string;
  host_email: string;
  topic: string;
  start_time: string;
  duration: number;
}

export class ZoomService {
  async createMeeting(_params: {
    topic: string;
    start_time: string;
    duration: number;
    host_email: string;
    agenda?: string;
  }): Promise<ZoomMeeting> {
    throw new Error('ZoomService.createMeeting() not implemented — architecture placeholder');
  }

  async getMeeting(_meetingId: string): Promise<ZoomMeeting> {
    throw new Error('ZoomService.getMeeting() not implemented — architecture placeholder');
  }

  async deleteMeeting(_meetingId: string): Promise<void> {
    throw new Error('ZoomService.deleteMeeting() not implemented — architecture placeholder');
  }
}
