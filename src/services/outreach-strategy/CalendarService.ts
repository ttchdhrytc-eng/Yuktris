// ============================================================
// CalendarService — Outreach Strategy Agent
// ============================================================
//
// Interface placeholder for future Calendar integration.
// No implementation — architecture only.

import type { CalendarScheduleResult } from '@/types/outreach-strategy';

export interface IOutreachCalendarService {
  recommendSchedule(userTimezone: string): Promise<CalendarScheduleResult>;
}

export class OutreachCalendarService implements IOutreachCalendarService {
  async recommendSchedule(_userTimezone: string): Promise<CalendarScheduleResult> {
    throw new Error('OutreachCalendarService.recommendSchedule() not implemented');
  }
}
