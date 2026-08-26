export type PersistedScheduleDraft = {
  campaignId: string;
  days: string[];
  start: string;
  end: string;
  timezone: string;
};

export type CampaignUiState = {
  expandedCampaign: string | null;
  scheduleDraft: PersistedScheduleDraft | null;
};

const storageKey = (workspaceId: string) => `yuktris:campaigns-ui:${workspaceId}`;

export function readCampaignUiState(workspaceId?: string): CampaignUiState {
  const fallback = { expandedCampaign: null, scheduleDraft: null };
  if (!workspaceId || typeof sessionStorage === 'undefined') return fallback;
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(workspaceId)) ?? 'null') as Partial<CampaignUiState> | null;
    return {
      expandedCampaign: typeof value?.expandedCampaign === 'string' ? value.expandedCampaign : null,
      scheduleDraft: validScheduleDraft(value?.scheduleDraft) ? value.scheduleDraft : null,
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
