import { supabase } from '@/lib/supabase';
import { isTestFixture } from '@/services/campaign-metrics';

type Row = Record<string, unknown>;

export type CampaignProspect = {
  campaignId: string;
  jobId: string;
  contactId: string;
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  source: string;
  status: string;
  lastAction: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  outreachTimezone: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCampaignProspects(workspaceId: string, campaignIds?: string[]): Promise<CampaignProspect[]> {
  const { data: jobs, error } = await supabase.from('linkedin_execution_jobs').select('*').eq('workspace_id', workspaceId);
  if (error) throw error;
  const correlated = (jobs ?? []).filter((job) => {
    if (isTestFixture(job as Row)) return false;
    const id = sourceCampaignId(job as Row);
    return id && (!campaignIds?.length || campaignIds.includes(id));
  });
  const contactIds = [...new Set(correlated.map((job) => String(job.contact_id ?? '')).filter(Boolean))];
  if (!contactIds.length) return [];
  const campaignIdList = [...new Set(correlated.map((job) => sourceCampaignId(job as Row)!).filter(Boolean))];
  const [{ data: contacts }, { data: history }, { data: campaigns }] = await Promise.all([
    supabase.from('contacts').select('id,full_name,first_name,last_name,title,company_id,linkedin_url,status,created_at,updated_at').eq('workspace_id', workspaceId).in('id', contactIds),
    supabase
      .from('linkedin_action_history')
      .select('execution_job_id,action_type,action_result,error_message,created_at')
      .eq('workspace_id', workspaceId)
      .in(
        'execution_job_id',
        correlated.map((job) => job.id),
      ),
    supabase.from('customer_campaigns').select('id,outreach_timezone').eq('workspace_id', workspaceId).in('id', campaignIdList),
  ]);
  const companyIds = [...new Set((contacts ?? []).map((contact) => String(contact.company_id ?? '')).filter(Boolean))];
  const { data: companies } = companyIds.length ? await supabase.from('companies').select('id,name').eq('workspace_id', workspaceId).in('id', companyIds) : { data: [] as Row[] };
  const contactMap = new Map((contacts ?? []).map((row) => [String(row.id), row]));
  const companyMap = new Map((companies ?? []).map((row) => [String(row.id), String(row.name)]));
  const timezoneMap = new Map((campaigns ?? []).map((row) => [String(row.id), row.outreach_timezone ? String(row.outreach_timezone) : null]));
  return correlated.map((job) => {
    const contact = contactMap.get(String(job.contact_id)) as Row | undefined;
    const latest = (history ?? []).filter((row) => row.execution_job_id === job.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const payload = job.action_payload && typeof job.action_payload === 'object' ? (job.action_payload as Row) : {};
    const campaignId = sourceCampaignId(job as Row)!;
    const outreachTimezone = timezoneMap.get(campaignId) ?? null;
    const nextActionAt = job.scheduled_at ? String(job.scheduled_at) : null;
    const status = customerStatus(String(job.status ?? ''), latest?.error_message ?? null);
    return {
      campaignId,
      jobId: String(job.id),
      contactId: String(job.contact_id),
      name: String(contact?.full_name ?? `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`).trim() || 'Unknown prospect',
      title: contact?.title ? String(contact.title) : null,
      company: contact?.company_id ? (companyMap.get(String(contact.company_id)) ?? null) : null,
      linkedinUrl: String(contact?.linkedin_url ?? payload.profile_url ?? '') || null,
      source: 'Campaign discovery',
      status,
      lastAction: latest ? `${String(latest.action_type).replaceAll('_', ' ')}: ${latest.error_message ? String(latest.error_message) : String(latest.action_result ?? 'processed')}` : null,
      nextAction: ['queued', 'scheduled', 'retry', 'pending'].includes(String(job.status)) ? (nextActionAt ? `Connection request scheduled for ${formatInTimezone(nextActionAt, outreachTimezone)}` : outreachTimezone ? 'Connection request awaiting the safety window' : 'Requires attention — configure outreach timezone') : null,
      nextActionAt,
      outreachTimezone,
      createdAt: String(job.created_at),
      updatedAt: String(job.updated_at ?? job.created_at),
    };
  });
}

function sourceCampaignId(row: Row): string | null {
  const payload = row.action_payload && typeof row.action_payload === 'object' ? (row.action_payload as Row) : {};
  return typeof payload.source_campaign_id === 'string' ? payload.source_campaign_id : null;
}

function customerStatus(status: string, error: unknown): string {
  if (status === 'completed') return 'Connection sent';
  if (status === 'failed') return error ? `Needs attention — ${String(error).replace('LinkedIn write denied: ', '')}` : 'Needs attention';
  if (['queued', 'scheduled', 'retry', 'pending'].includes(status)) return status === 'scheduled' ? 'Connection request scheduled' : 'Queued';
  if (status === 'running') return 'In progress';
  return 'Discovered';
}

function formatInTimezone(value: string, timezone: string | null): string {
  if (!timezone) return new Date(value).toLocaleString();
  try {
    return `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value))} (${timezone})`;
  } catch {
    return new Date(value).toLocaleString();
  }
}
