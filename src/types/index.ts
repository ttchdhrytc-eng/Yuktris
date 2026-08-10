export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type Workspace = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type LinkedInAccount = {
  id: string;
  workspace_id: string;
  profile_url: string | null;
  display_name: string | null;
  headline: string | null;
  status: 'connected' | 'disconnected' | 'error';
  last_synced_at: string | null;
  created_at: string;
};

export type Company = {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  linkedin_url: string | null;
  description: string | null;
  created_at: string;
};

export type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'meeting_booked'
  | 'qualified'
  | 'disqualified';

export type Prospect = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  status: ProspectStatus;
  created_at: string;
  company?: Company | null;
};

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type Campaign = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type MessageDirection = 'sent' | 'received';
export type MessageChannel = 'linkedin' | 'email' | 'other';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'replied' | 'failed';

export type Message = {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  prospect_id: string | null;
  linkedin_account_id: string | null;
  direction: MessageDirection;
  channel: MessageChannel;
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  sent_at: string | null;
  created_at: string;
  prospect?: Prospect | null;
};

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type Meeting = {
  id: string;
  workspace_id: string;
  prospect_id: string | null;
  campaign_id: string | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: MeetingStatus;
  location: string | null;
  created_at: string;
  prospect?: Prospect | null;
};

export type AIAgentStatus = 'active' | 'inactive' | 'running' | 'error';

export type AIAgent = {
  id: string;
  workspace_id: string;
  agent_type: string;
  name: string;
  description: string | null;
  status: AIAgentStatus;
  config: Record<string, unknown>;
  last_run_at: string | null;
  created_at: string;
};

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export type Integration = {
  id: string;
  workspace_id: string;
  provider: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  connected_at: string | null;
  created_at: string;
};

export type ApiKey = {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string | null;
  provider: string;
  last_used_at: string | null;
  created_at: string;
};

export type Setting = {
  id: string;
  workspace_id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};

export type AuthUser = {
  id: string;
  email: string;
};
