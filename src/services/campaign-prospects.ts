import { supabase } from '@/lib/supabase';
import { isTestFixture } from '@/services/campaign-metrics';
import { resolveCampaignProspectIdentitySafely } from '@/services/campaign-prospect-identity';

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
  acceptanceEligible: boolean;
  identityDiagnostic: string | null;
};

export async function fetchCampaignProspects(workspaceId: string, campaignIds?: string[]): Promise<CampaignProspect[]> {
  const [{ data: jobs, error }, { data: mappings, error: mappingError }] = await Promise.all([
    supabase.from('linkedin_execution_jobs').select('*').eq('workspace_id', workspaceId),
    supabase.from('customer_campaign_contacts').select('*').eq('workspace_id', workspaceId),
  ]);
  if (error) throw error;
  if (mappingError) throw mappingError;
  const correlated = (jobs ?? []).filter((job) => {
    if (isTestFixture(job as Row)) return false;
    const id = sourceCampaignId(job as Row);
    return id && (!campaignIds?.length || campaignIds.includes(id));
  });
  const selectedMappings = (mappings ?? []).filter((row) => !campaignIds?.length || campaignIds.includes(String(row.customer_campaign_id)));
  const contactIds = [...new Set([...correlated.map((job) => String(job.contact_id ?? '')), ...selectedMappings.map((row) => String(row.contact_id ?? ''))].filter(Boolean))];
  if (!contactIds.length) return [];
  const campaignIdList = [...new Set([...correlated.map((job) => sourceCampaignId(job as Row)!), ...selectedMappings.map((row) => String(row.customer_campaign_id))].filter(Boolean))];
  const [contactResult, historyResult, campaignResult] = await Promise.all([
    supabase.from('contacts').select('id,full_name,first_name,last_name,job_title,company_id,linkedin_url,status,created_at,updated_at').eq('workspace_id', workspaceId).in('id', contactIds),
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
  const identityQueryError = contactResult.error ?? historyResult.error ?? campaignResult.error;
  if (identityQueryError) {
    console.error('[campaign-prospect-query-failed]', { code: identityQueryError.code, contact_count: contactIds.length });
    throw new Error('Campaign prospect identities could not be loaded');
  }
  const contacts = contactResult.data;
  const history = historyResult.data;
  const campaigns = campaignResult.data;
  const companyIds = [...new Set((contacts ?? []).map((contact) => String(contact.company_id ?? '')).filter(Boolean))];
  const companyResult = companyIds.length ? await supabase.from('companies').select('id,name').eq('workspace_id', workspaceId).in('id', companyIds) : { data: [] as Row[], error: null };
  if (companyResult.error) {
    console.error('[campaign-prospect-query-failed]', { code: companyResult.error.code, company_count: companyIds.length });
    throw new Error('Campaign prospect identities could not be loaded');
  }
  const companies = companyResult.data;
  const contactMap = new Map((contacts ?? []).map((row) => [String(row.id), row]));
  const companyMap = new Map((companies ?? []).map((row) => [String(row.id), String(row.name)]));
  const timezoneMap = new Map((campaigns ?? []).map((row) => [String(row.id), row.outreach_timezone ? String(row.outreach_timezone) : null]));
  const rows = selectedMappings.map((mapping) => ({
    mapping,
    job: correlated.filter((job) => String(job.contact_id) === String(mapping.contact_id) && sourceCampaignId(job as Row) === String(mapping.customer_campaign_id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] as Row | undefined,
  }));
  for (const job of correlated) if (!rows.some((row) => row.job?.id === job.id)) rows.push({ mapping: { id: job.id, customer_campaign_id: sourceCampaignId(job as Row), contact_id: job.contact_id, source: 'campaign_discovery', discovered_at: job.created_at }, job: job as Row });
  return Promise.all(rows.map(async ({ mapping, job }) => {
    const actualContactId = String(job?.contact_id ?? mapping.contact_id);
    const identityResult = resolveCampaignProspectIdentitySafely(actualContactId, contactMap, companyMap);
    if (!identityResult.ok) console.error('[campaign-prospect-identity-missing]', { workspace_id: workspaceId, contact_id: actualContactId });
    const identity = identityResult.identity;
    const latest = job ? (history ?? []).filter((row) => row.execution_job_id === job.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] : null;
    const payload = job?.action_payload && typeof job.action_payload === 'object' ? (job.action_payload as Row) : {};
    const campaignId = String(mapping.customer_campaign_id);
    const outreachTimezone = timezoneMap.get(campaignId) ?? null;
    const nextActionAt = job?.scheduled_at ? String(job.scheduled_at) : null;
    const status = job ? customerStatus(String(job.status ?? ''), latest?.error_message ?? null) : 'Selected';
    const { data: eligibility } = identityResult.ok
      ? await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'check_acceptance_eligibility', workspace_id: workspaceId, campaign_id: campaignId, contact_id: String(mapping.contact_id) } })
      : { data: null };
    return {
      campaignId,
      jobId: String(job?.id ?? mapping.id),
      contactId: String(mapping.contact_id),
      name: identity.name,
      title: identity.title,
      company: identity.company,
      linkedinUrl: identity.linkedinUrl ?? (String(payload.profile_url ?? '') || null),
      source: mapping.source === 'existing_workspace_prospect' ? 'Existing workspace prospect' : 'Campaign discovery',
      status: identityResult.ok ? status : 'Needs attention — identity unavailable',
      lastAction: latest ? `${String(latest.action_type).replaceAll('_', ' ')}: ${latest.error_message ? String(latest.error_message) : String(latest.action_result ?? 'processed')}` : null,
      nextAction: job && ['queued', 'scheduled', 'retry', 'pending'].includes(String(job.status)) ? (nextActionAt ? `Connection request scheduled for ${formatInTimezone(nextActionAt, outreachTimezone)}` : outreachTimezone ? 'Connection request awaiting the safety window' : 'Requires attention — configure outreach timezone') : null,
      nextActionAt,
      outreachTimezone,
      createdAt: String(mapping.discovered_at ?? job?.created_at),
      updatedAt: String(job?.updated_at ?? mapping.created_at ?? mapping.discovered_at),
      acceptanceEligible: identityResult.ok && eligibility?.eligible === true,
      identityDiagnostic: identityResult.diagnostic,
    };
  }));
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
