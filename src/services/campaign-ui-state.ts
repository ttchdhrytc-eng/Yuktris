export type PersistedScheduleDraft = {
  campaignId: string;
  days: string[];
  start: string;
  end: string;
  timezone: string;
};

export type MessageTemplates = {
  connectionNote: string;
  firstMessage: string;
  followUp1: string;
  followUp2: string;
};

export type FollowUpDelays = {
  afterConnectionHours: number;
  afterFirstMessageHours: number;
  afterFollowUp1Hours: number;
};

export type CampaignUiState = {
  expandedCampaign: string | null;
  scheduleDraft: PersistedScheduleDraft | null;
  newCampaignTimezone: string | null;
  messageTemplates: MessageTemplates | null;
  followUpDelays: FollowUpDelays | null;
  messagesGenerated: boolean | null;
};

const storageKey = (workspaceId: string) => `yuktris:campaigns-ui:${workspaceId}`;

export function readCampaignUiState(workspaceId?: string): CampaignUiState {
  const fallback = { expandedCampaign: null, scheduleDraft: null, newCampaignTimezone: null, messageTemplates: null, followUpDelays: null, messagesGenerated: null };
  if (!workspaceId || typeof sessionStorage === 'undefined') return fallback;
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(workspaceId)) ?? 'null') as Partial<CampaignUiState> | null;
    return {
      expandedCampaign: typeof value?.expandedCampaign === 'string' ? value.expandedCampaign : null,
      scheduleDraft: validScheduleDraft(value?.scheduleDraft) ? value.scheduleDraft : null,
      newCampaignTimezone: typeof value?.newCampaignTimezone === 'string' ? value.newCampaignTimezone : null,
      messageTemplates: value?.messageTemplates && typeof value.messageTemplates === 'object' ? value.messageTemplates as MessageTemplates : null,
      followUpDelays: value?.followUpDelays && typeof value.followUpDelays === 'object' ? value.followUpDelays as FollowUpDelays : null,
      messagesGenerated: typeof value?.messagesGenerated === 'boolean' ? value.messagesGenerated : null,
    };
  } catch {
    return fallback;
  }
}

export function writeCampaignUiState(workspaceId: string | undefined, state: CampaignUiState): void {
  if (!workspaceId || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(storageKey(workspaceId), JSON.stringify(state));
}

function validScheduleDraft(value: unknown): value is PersistedScheduleDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.campaignId === 'string'
    && Array.isArray(draft.days)
    && draft.days.every((day) => typeof day === 'string')
    && typeof draft.start === 'string'
    && typeof draft.end === 'string'
    && typeof draft.timezone === 'string';
}
