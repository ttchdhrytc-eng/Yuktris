import { useState } from 'react';
import { Palette, Globe, Image, Zap, Check, Trash2, Building2, Type, Layout, Mail, Bell, FileText, Monitor } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import { useWhiteLabelDashboard, useUpdateWhiteLabelSettings, useAddCustomDomain, useDeleteCustomDomain, useUploadBrandingAsset } from '@/hooks/useWhiteLabel';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Palette },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'domains', label: 'Custom Domains', icon: Globe },
  { id: 'templates', label: 'Templates', icon: Layout },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function WhiteLabelPage() {
  const { data: dash, isLoading } = useWhiteLabelDashboard();
  const updateSettings = useUpdateWhiteLabelSettings();
  const addDomain = useAddCustomDomain();
  const deleteDomain = useDeleteCustomDomain();
  const uploadAsset = useUploadBrandingAsset();
  const [tab, setTab] = useState<TabId>('overview');
  const [platformName, setPlatformName] = useState('');
  const [customAiName, setCustomAiName] = useState('');
  const [domainInput, setDomainInput] = useState('');

  if (isLoading) return (<div><PageHeader title="White Label Platform" description="Custom branding, domains, themes, and terminology for your platform." /><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></div>);

  if (!dash || !dash.isWhiteLabeled) {
    return (<div><PageHeader title="White Label Platform" description="Custom branding, domains, themes, and terminology for your platform." /><Card className="p-6"><div className="flex flex-col items-center justify-center py-16 space-y-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Palette className="h-8 w-8 text-brand-400" /></div><div className="text-center space-y-2"><h3 className="text-lg font-semibold text-ink-500">White Label Platform</h3><p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Customize the platform with your own branding, custom domain, AI name, terminology, email templates, notification templates, and dashboard configuration.</p></div><button onClick={() => updateSettings.mutate({ isWhiteLabeled: true, platformName: platformName || 'Your Platform' })} disabled={updateSettings.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-4 w-4" />{updateSettings.isPending ? 'Enabling...' : 'Enable White Label'}</button></div></Card></div>);
  }

  const settings = dash.settings as Record<string, unknown> | null;

  return (
    <div>
      <PageHeader title="White Label Platform" description="Custom branding, domains, themes, and terminology for your platform." actions={<button onClick={() => updateSettings.mutate({ platformName: platformName || (settings?.platform_name as string ?? 'Yuktris'), customAiName: customAiName || undefined })} disabled={updateSettings.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Check className="h-3.5 w-3.5" />Save Changes</button>} />
      <Card>
        <div className="border-b border-gold-500/12 px-2"><div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">{TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}><t.icon className="h-3.5 w-3.5" />{t.label}</button>))}</div></div>
        <div className="p-4">
          {tab === 'overview' && (<div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[<Card key="d" className="p-4"><div className="flex items-center gap-2 mb-1"><Globe className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Custom Domains</span></div><p className="text-2xl font-bold text-ink-500">{dash.totalDomains}</p></Card>, <Card key="a" className="p-4"><div className="flex items-center gap-2 mb-1"><Image className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Branding Assets</span></div><p className="text-2xl font-bold text-ink-500">{dash.totalAssets}</p></Card>, <Card key="p" className="p-4"><div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Platform Name</span></div><p className="text-lg font-bold text-ink-500">{settings?.platform_name as string ?? 'Yuktris'}</p></Card>]}</div><div className="space-y-3"><div><label className="text-xs text-ink-500 mb-1 block">Platform Name</label><input value={platformName} onChange={(e) => setPlatformName(e.target.value)} placeholder={settings?.platform_name as string ?? 'Yuktris'} className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none" /></div><div><label className="text-xs text-ink-500 mb-1 block">Custom AI Name</label><input value={customAiName} onChange={(e) => setCustomAiName(e.target.value)} placeholder={settings?.custom_ai_name as string ?? 'AI CEO'} className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none" /></div></div></div>)}
          {tab === 'branding' && (<div className="space-y-2">{dash.assets.map((a) => { const asset = a as Record<string, unknown>; return (<Card key={asset.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Image className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{asset.asset_name as string}</p><p className="text-xs text-ink-500">{asset.asset_type as string} · {timeAgo(asset.created_at as string)}</p></div></div><Badge tone="brand">{asset.asset_type as string}</Badge></div></Card>); })}<button onClick={() => uploadAsset.mutate({ assetType: 'logo', assetName: 'Custom Logo' })} disabled={uploadAsset.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Upload Asset</button></div>)}
          {tab === 'domains' && (<div className="space-y-2">{dash.domains.map((d) => { const dom = d as Record<string, unknown>; return (<Card key={dom.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Globe className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{dom.domain as string}</p><p className="text-xs text-ink-500">SSL: {dom.ssl_status as string} · DNS: {dom.dns_verified ? 'Verified' : 'Pending'}</p></div></div><div className="flex items-center gap-2">{dom.is_primary && <Badge tone="brand">Primary</Badge>}<button onClick={() => deleteDomain.mutate(dom.id as string)} className="rounded-lg bg-error-500/10 px-2.5 py-1 text-xs text-error-400 hover:bg-error-500/20"><Trash2 className="h-3 w-3" /></button></div></div></Card>); })}<div className="flex items-center gap-2"><input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="app.yourcompany.com" className="flex-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none" /><button onClick={() => { if (domainInput) { addDomain.mutate(domainInput); setDomainInput(''); } }} disabled={addDomain.isPending || !domainInput} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add</button></div></div>)}
          {tab === 'templates' && (<div className="space-y-2">{[<Card key="email" className="p-3"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">Email Templates</p><p className="text-xs text-ink-500">Customize email notifications with your branding</p></div></div></Card>, <Card key="notif" className="p-3"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">Notification Templates</p><p className="text-xs text-ink-500">Customize in-app notification styles</p></div></div></Card>, <Card key="report" className="p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">Report Templates</p><p className="text-xs text-ink-500">Customize report headers and footers</p></div></div></Card>, <Card key="dash" className="p-3"><div className="flex items-center gap-2"><Monitor className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">Dashboard Configuration</p><p className="text-xs text-ink-500">Customize dashboard layout and widgets</p></div></div></Card>]}</div>)}
        </div>
      </Card>
    </div>
  );
}
