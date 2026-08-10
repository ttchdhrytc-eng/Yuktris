// ============================================================
// Slack Service — Interface Placeholder
// ============================================================
// Future integration: Slack API
// No implementation. Architecture only.

export interface SlackNotification {
  channel: string;
  message: string;
  ts?: string;
}

export class SlackService {
  async notifySalesRep(_params: {
    channel: string;
    rep_email: string;
    meeting_id: string;
    message: string;
  }): Promise<SlackNotification> {
    throw new Error('SlackService.notifySalesRep() not implemented — architecture placeholder');
  }

  async sendMeetingAlert(_params: {
    channel: string;
    meeting_summary: string;
    meeting_time: string;
  }): Promise<SlackNotification> {
    throw new Error('SlackService.sendMeetingAlert() not implemented — architecture placeholder');
  }
}
