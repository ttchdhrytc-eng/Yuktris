// Pure classification helpers for the LinkedIn connection-request dialog.
// Kept free of Playwright types so the matching logic can be unit tested without a browser.

export type ConnectionProfileState = 'already_pending' | 'already_connected' | 'connect_available' | 'unavailable';

export interface ConnectionProfileFlags {
  hasPending: boolean;
  hasConnect: boolean;
  hasMessage: boolean;
}

export function classifyConnectionProfileState(flags: ConnectionProfileFlags): ConnectionProfileState {
  if (flags.hasPending) return 'already_pending';
  if (flags.hasConnect) return 'connect_available';
  if (flags.hasMessage) return 'already_connected';
  return 'unavailable';
}

export type PostClickOutcome = 'verified_sent' | 'connected' | 'outcome_unknown';

export function classifyPostClickOutcome(flags: {
  hasPending: boolean;
  hasSentEvidence: boolean;
  hasMessage: boolean;
}): PostClickOutcome {
  if (flags.hasPending || flags.hasSentEvidence) return 'verified_sent';
  if (flags.hasMessage) return 'connected';
  return 'outcome_unknown';
}

// Ordered by specificity — the first visible, enabled match wins. LinkedIn renders the no-note
// confirmation control under different labels depending on account type, locale and cohort.
export const NO_NOTE_CONFIRM_LABELS = ['Send without note', 'Send now', 'Send', 'Connect'] as const;

export function isNoNoteConfirmCandidate(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('add a note')) return false;
  return NO_NOTE_CONFIRM_LABELS.some(candidate => normalized.includes(candidate.toLowerCase()));
}

export function pickNoNoteConfirmLabel(visibleEnabledLabels: string[]): string | null {
  for (const label of NO_NOTE_CONFIRM_LABELS) {
    const match = visibleEnabledLabels.find(text => isNoNoteConfirmCandidate(text) && text.trim().toLowerCase().includes(label.toLowerCase()));
    if (match) return match;
  }
  return null;
}
