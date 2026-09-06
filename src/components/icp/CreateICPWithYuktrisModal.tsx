import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { icpService } from '@/services/icp-intelligence';
import type { GeneratedICP } from '@/services/icp-intelligence/icpValidation';

type Draft = {
  name: string;
  offer: string;
  market: string;
  subIndustry: string;
  companySize: string;
  geography: string;
  roles: string;
  painPoints: string;
  keywords: string;
  exclusions: string;
  valueProposition: string;
  website: string;
};

const emptyDraft: Draft = { name: '', offer: '', market: '', subIndustry: '', companySize: '', geography: '', roles: '', painPoints: '', keywords: '', exclusions: '', valueProposition: '', website: '' };
const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export function CreateICPWithYuktrisModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (icpId: string) => void | Promise<void> }) {
  const { workspace } = useWorkspace();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [generated, setGenerated] = useState<GeneratedICP | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraft(emptyDraft);
      setGenerated(null);
      setAdvanced(false);
    }
  }, [open]);

  const update = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));

  async function generate() {
    if (!workspace || draft.offer.trim().length < 20) return toast.error('Describe what you are selling in a little more detail.');
    setGenerating(true);
    try {
      const proposal = await icpService.generateICPFromOffer({ workspaceId: workspace.id, offer: draft.offer.trim(), geography: draft.geography.trim(), website: draft.website.trim() });
      setGenerated(proposal);
      setDraft((current) => ({
        ...current,
        name: proposal.name,
        market: proposal.company_profile.industry,
        subIndustry: proposal.company_profile.sub_industry ?? '',
        companySize: proposal.company_profile.company_size,
        geography: [proposal.company_profile.country, proposal.company_profile.region].filter(Boolean).join(', '),
        roles: proposal.decision_makers.map((item) => item.job_title).join(', '),
        painPoints: proposal.pain_points.map((item) => item.pain_point).join(', '),
        keywords: proposal.sales_navigator_filters.keywords.join(', '),
        exclusions: proposal.negative_filters.map((item) => item.value).join(', '),
        valueProposition: proposal.description,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yuktris could not generate this ICP. No data was saved.');
    } finally {
      setGenerating(false);
    }
  }

  async function persistManual(): Promise<string> {
    if (!workspace) throw new Error('No active workspace');
    const { data: icp, error } = await supabase.from('icps').insert({
      workspace_id: workspace.id,
      name: draft.name.trim(),
      description: draft.valueProposition.trim() || `${draft.offer.trim()} for ${draft.market.trim()}`,
      offer_context: { offer: draft.offer.trim(), target_market: draft.market.trim(), target_geography: draft.geography.trim() || null, product_page: draft.website.trim() || null, value_proposition: draft.valueProposition.trim() || null },
      status: 'completed',
      priority: 'secondary',
      prospecting_status: 'queued',
    }).select('id').single();
    if (error) throw error;
    const roles = list(draft.roles);
    const pains = list(draft.painPoints);
    const exclusions = list(draft.exclusions);
    const writes = [
      supabase.from('icp_company_profile').insert({ icp_id: icp.id, industry: draft.market.trim(), sub_industry: draft.subIndustry.trim() || null, company_size: draft.companySize.trim(), country: draft.geography.trim() || null }),
      supabase.from('icp_decision_makers').insert(roles.map((job_title, index) => ({ icp_id: icp.id, job_title, priority: index === 0 ? 'high' : 'medium' }))),
      supabase.from('icp_pain_points').insert(pains.map((pain_point) => ({ icp_id: icp.id, pain_point, severity: 'medium', urgency: 'medium' }))),
      supabase.from('sales_navigator_filters').insert({ icp_id: icp.id, industry: [draft.market.trim()], company_size: [draft.companySize.trim()], location: list(draft.geography), keywords: list(draft.keywords), titles: roles, departments: [], technology: [] }),
      exclusions.length ? supabase.from('icp_negative_filters').insert(exclusions.map((value) => ({ icp_id: icp.id, filter_type: 'industry', value }))) : Promise.resolve({ error: null }),
    ];
    const results = await Promise.all(writes);
    const childError = results.find((result) => result.error)?.error;
    if (childError) throw childError;
    const { data: account } = await supabase.from('linkedin_accounts').select('id').eq('workspace_id', workspace.id).eq('connection_state', 'connected').in('health_status', ['healthy', 'degraded']).limit(1).maybeSingle();
    if (account?.id) await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'request_replenishment', workspace_id: workspace.id, icp_id: icp.id, linkedin_account_id: account.id, reason: 'icp_activated' } });
    return icp.id;
  }

  async function save() {
    if (!workspace || !draft.name.trim() || !draft.offer.trim() || !draft.market.trim() || !draft.companySize.trim() || !list(draft.roles).length || !list(draft.painPoints).length) return toast.error('Complete the required review fields before saving.');
    setSaving(true);
    try {
      let icpId: string;
      if (generated) {
        const roles = list(draft.roles);
        const pains = list(draft.painPoints);
        const countries = list(draft.geography);
        const edited: GeneratedICP = {
          ...generated,
          name: draft.name.trim(),
          description: draft.valueProposition.trim() || generated.description,
          company_profile: { ...generated.company_profile, industry: draft.market.trim(), sub_industry: draft.subIndustry.trim() || null, company_size: draft.companySize.trim(), country: countries[0] || generated.company_profile.country, region: countries.slice(1).join(', ') || null },
          decision_makers: roles.map((job_title, index) => ({ ...(generated.decision_makers[index] ?? generated.decision_makers[0]), job_title })),
          pain_points: pains.map((pain_point, index) => ({ ...(generated.pain_points[index] ?? generated.pain_points[0]), pain_point })),
          negative_filters: list(draft.exclusions).map((value, index) => ({ ...(generated.negative_filters[index] ?? generated.negative_filters[0]), value })),
          sales_navigator_filters: { ...generated.sales_navigator_filters, industry: [draft.market.trim()], company_size: [draft.companySize.trim()], location: countries, keywords: list(draft.keywords), titles: roles },
        };
        icpId = await icpService.persistGeneratedICP(workspace.id, null, null, edited, null, { offerContext: { offer: draft.offer.trim(), target_market: draft.market.trim(), target_geography: draft.geography.trim() || null, product_page: draft.website.trim() || null, value_proposition: edited.description }, discoveryReason: 'icp_activated' });
      } else {
        icpId = await persistManual();
      }
      await onCreated(icpId);
      toast.success('ICP saved. Yuktris has started prospecting in the background.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ICP could not be saved. No prospecting was started.');
    } finally {
      setSaving(false);
    }
  }

  const reviewing = Boolean(generated) || advanced;
  return <Modal open={open} onClose={onClose} size="lg" title={reviewing ? 'Review your ICP' : 'Create ICP with Yuktris'} description={reviewing ? 'Review and edit the targeting before prospecting starts.' : 'Tell Yuktris what you sell. Yuktris will propose the audience and targeting.'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>{reviewing ? <Button loading={saving} onClick={() => void save()}>Save & Start Prospecting</Button> : <Button loading={generating} onClick={() => void generate()}><Sparkles className="h-4 w-4" />Generate ICP</Button>}</>}>
    {!reviewing ? <div className="space-y-4"><div><Label>What are you selling?</Label><Textarea className="min-h-32" value={draft.offer} onChange={(event) => update('offer', event.target.value)} placeholder="AI-powered LinkedIn outbound service that helps B2B IT companies generate qualified sales conversations." /></div><div><Label>Target geography (optional)</Label><Input value={draft.geography} onChange={(event) => update('geography', event.target.value)} placeholder="United States, United Kingdom" /></div><div><Label>Website or product page (optional)</Label><Input value={draft.website} onChange={(event) => update('website', event.target.value)} placeholder="https://example.com/product" /></div><button type="button" className="text-sm text-gold-400 hover:underline" onClick={() => setAdvanced(true)}>Advanced / Build manually</button></div> : <div className="grid gap-4 md:grid-cols-2"><ReviewField label="ICP name" value={draft.name} onChange={(value) => update('name', value)} /><ReviewField label="Offer" value={draft.offer} onChange={(value) => update('offer', value)} /><ReviewField label="Target industry/company type" value={draft.market} onChange={(value) => update('market', value)} /><ReviewField label="Sub-industry" value={draft.subIndustry} onChange={(value) => update('subIndustry', value)} /><ReviewField label="Company size" value={draft.companySize} onChange={(value) => update('companySize', value)} /><ReviewField label="Geography" value={draft.geography} onChange={(value) => update('geography', value)} /><ReviewField label="Decision-maker titles" value={draft.roles} onChange={(value) => update('roles', value)} /><ReviewField label="Keywords" value={draft.keywords} onChange={(value) => update('keywords', value)} /><ReviewField label="Pain points" value={draft.painPoints} onChange={(value) => update('painPoints', value)} textarea /><ReviewField label="Exclusions" value={draft.exclusions} onChange={(value) => update('exclusions', value)} textarea /><div className="md:col-span-2"><ReviewField label="Value proposition" value={draft.valueProposition} onChange={(value) => update('valueProposition', value)} textarea /></div></div>}
  </Modal>;
}

function ReviewField({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return <div><Label>{label}</Label>{textarea ? <Textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <Input value={value} onChange={(event) => onChange(event.target.value)} />}</div>;
}
