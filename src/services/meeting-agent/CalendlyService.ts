// ============================================================
// Calendly Service — Interface Placeholder
// ============================================================
// Future integration: Calendly API
// No implementation. Architecture only.

export interface CalendlyBookingLink {
  id: string;
  url: string;
  event_type: string;
  expires_at?: string;
}

export class CalendlyService {
  async generateBookingLink(_params: {
    event_type: string;
    invitee_email: string;
    invitee_name: string;
    custom_questions?: Record<string, string>;
  }): Promise<CalendlyBookingLink> {
    throw new Error('CalendlyService.generateBookingLink() not implemented — architecture placeholder');
  }

  async getBooking(_bookingId: string): Promise<unknown> {
    throw new Error('CalendlyService.getBooking() not implemented — architecture placeholder');
  }
}
