export const CAMPAIGN_SENDING_DAYS = [
  ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'],
  ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun'],
] as const;

export const CAMPAIGN_WEEKDAYS = CAMPAIGN_SENDING_DAYS.slice(0, 5).map(([value]) => value);

const TIMEZONE_ALIASES: Record<string, string> = { 'Asia/Calcutta': 'Asia/Kolkata' };

export function normalizeIanaTimezone(value: string): string {
  const trimmed = value.trim();
  return TIMEZONE_ALIASES[trimmed] ?? trimmed;
}

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalizeIanaTimezone(value) }).format();
    return Boolean(value.trim());
  } catch {
    return false;
  }
}

export function parseCampaignDays(value: unknown): string[] {
  const text = String(value ?? '').trim().toLowerCase();
  if (/^monday\s*(?:-|\u2013|\u2014|â€“)\s*friday$/i.test(text)) return [...CAMPAIGN_WEEKDAYS];
  return text.split(',').map((day) => day.trim()).filter((day) => CAMPAIGN_SENDING_DAYS.some(([candidate]) => candidate === day));
}

export function parseCampaignHours(value: unknown): [string, string] {
  const match = String(value ?? '').trim().match(/^(\d{2}:\d{2})\s*(?:-|\u2013|\u2014|â€“)\s*(\d{2}:\d{2})$/);
  return match ? [match[1], match[2]] : ['09:00', '17:00'];
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: normalizeIanaTimezone(timezone), weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: get('weekday').toLowerCase(), time: `${get('hour')}:${get('minute')}` };
}

export function nextCampaignSendingWindow(days: string[], start: string, end: string, timezone: string, from = new Date()): Date | null {
  if (!days.length || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end || !isIanaTimezone(timezone)) return null;
  const candidate = new Date(Math.floor(from.getTime() / 60000) * 60000);
  for (let minute = 0; minute <= 20160; minute += 1) {
    const local = localParts(candidate, timezone);
    if (days.includes(local.day) && local.time >= start && local.time < end) return new Date(candidate);
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  return null;
}

export function formatCampaignWindow(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone: normalizeIanaTimezone(timezone), weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
