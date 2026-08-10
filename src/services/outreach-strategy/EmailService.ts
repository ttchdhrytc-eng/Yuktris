// ============================================================
// EmailService — Outreach Strategy Agent
// ============================================================
//
// Interface placeholder for future Email integration.
// No implementation — architecture only.

import type { EmailTimingResult } from '@/types/outreach-strategy';

export interface IOutreachEmailService {
  recommendEmailTiming(prospectTimezone: string): Promise<EmailTimingResult>;
}

export class OutreachEmailService implements IOutreachEmailService {
  async recommendEmailTiming(_prospectTimezone: string): Promise<EmailTimingResult> {
    throw new Error('OutreachEmailService.recommendEmailTiming() not implemented');
  }
}
