import { supabase } from '@/lib/supabase';
import type { CampaignMetricSet } from './campaign-metrics';

type MetricRow = CampaignMetricSet & { customer_campaign_id: string; prospects_contacted?: number; controlled_writes_excluded?: number };

export async function fetchCampaignMetrics(workspaceId: string): Promise<Record<string, MetricRow>> {
  const { data, error } = await supabase.rpc('get_linkedin_v1_campaign_metrics', { p_workspace_id: workspaceId });
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as Record<string, unknown>[]).map(row => {
    const metric: MetricRow = {
      customer_campaign_id: String(row.customer_campaign_id),
      prospects: Number(row.prospects ?? 0),
      prospects_contacted: Number(row.prospects_contacted ?? 0),
      connectionsSent: Number(row.connections_sent ?? 0),
      connectionsAccepted: Number(row.connections_accepted ?? 0),
      messagesSent: Number(row.messages_sent ?? 0),
      replies: Number(row.replies ?? 0),
      positiveReplies: Number(row.positive_replies ?? 0),
      qualifiedLeads: Number(row.qualified_leads ?? 0),
      meetingsBooked: Number(row.meetings_booked ?? 0),
      controlled_writes_excluded: Number(row.controlled_writes_excluded ?? 0),
    };
    return [metric.customer_campaign_id, metric];
  }));
}
