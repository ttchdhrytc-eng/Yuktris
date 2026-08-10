// ============================================================
// Email Service — Interface Placeholder
// ============================================================
// Future integration: SendGrid / AWS SES / Postmark
// No implementation. Architecture only.

export interface EmailResult {
  message_id: string;
  sent: boolean;
  recipient: string;
}

export class EmailService {
  async sendReminder(_params: {
    to: string;
    meeting_id: string;
    meeting_time: string;
    meeting_link: string;
    agenda?: string;
  }): Promise<EmailResult> {
    throw new Error('EmailService.sendReminder() not implemented — architecture placeholder');
  }

  async sendMeetingBrief(_params: {
    to: string;
    meeting_id: string;
    brief_content: string;
  }): Promise<EmailResult> {
    throw new Error('EmailService.sendMeetingBrief() not implemented — architecture placeholder');
  }
}
