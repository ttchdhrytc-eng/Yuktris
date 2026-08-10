import { useState } from 'react';
import { Code, FileText, Download, Zap, Terminal, BookOpen, Webhook, Key, Package, Github, ExternalLink, CheckCircle2, Copy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useAPIPlatformDashboard, useGenerateSDK, useGenerateOpenAPISpec } from '@/hooks/useAPIPlatform';

const TABS = [
  { id: 'explorer', label: 'API Explorer', icon: Terminal },
  { id: 'docs', label: 'OpenAPI / Swagger', icon: FileText },
  { id: 'sdks', label: 'SDK Downloads', icon: Package },
  { id: 'webhooks', label: 'Webhook Testing', icon: Webhook },
  { id: 'quickstart', label: 'Quick Start', icon: BookOpen },
  { id: 'errors', label: 'Error Codes', icon: Code },
  { id: 'changelog', label: 'Changelog', icon: Github },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/companies', desc: 'List all companies' },
  { method: 'GET', path: '/api/v1/companies/:id', desc: 'Get company by ID' },
  { method: 'POST', path: '/api/v1/companies', desc: 'Create a company' },
  { method: 'PUT', path: '/api/v1/companies/:id', desc: 'Update a company' },
  { method: 'DELETE', path: '/api/v1/companies/:id', desc: 'Delete a company' },
  { method: 'GET', path: '/api/v1/contacts', desc: 'List all contacts' },
  { method: 'GET', path: '/api/v1/prospects', desc: 'List all prospects' },
  { method: 'POST', path: '/api/v1/prospects', desc: 'Create a prospect' },
  { method: 'GET', path: '/api/v1/campaigns', desc: 'List all campaigns' },
  { method: 'POST', path: '/api/v1/campaigns', desc: 'Create a campaign' },
  { method: 'GET', path: '/api/v1/outreach', desc: 'List outreach sequences' },
  { method: 'GET', path: '/api/v1/messages', desc: 'List all messages' },
  { method: 'GET', path: '/api/v1/meetings', desc: 'List all meetings' },
  { method: 'POST', path: '/api/v1/meetings', desc: 'Book a meeting' },
  { method: 'GET', path: '/api/v1/proposals', desc: 'List all proposals' },
  { method: 'POST', path: '/api/v1/proposals', desc: 'Create a proposal' },
  { method: 'GET', path: '/api/v1/customers', desc: 'List all customers' },
  { method: 'GET', path: '/api/v1/invoices', desc: 'List all invoices' },
  { method: 'GET', path: '/api/v1/revenue', desc: 'Get revenue summary' },
  { method: 'GET', path: '/api/v1/forecasts', desc: 'Get revenue forecasts' },
  { method: 'GET', path: '/api/v1/ai-ceo', desc: 'Get AI CEO dashboard' },
  { method: 'POST', path: '/api/v1/ai-ceo/analyze', desc: 'Run company analysis' },
  { method: 'GET', path: '/api/v1/agents', desc: 'List all AI agents' },
  { method: 'POST', path: '/api/v1/agents/tasks', desc: 'Assign task to agent' },
  { method: 'GET', path: '/api/v1/memory', desc: 'Query agent memory' },
  { method: 'GET', path: '/api/v1/knowledge-graph', desc: 'Query knowledge graph' },
  { method: 'GET', path: '/api/v1/reports', desc: 'List all reports' },
  { method: 'GET', path: '/api/v1/notifications', desc: 'List notifications' },
];

const ERROR_CODES = [
  { code: 200, name: 'OK', desc: 'Request succeeded' },
  { code: 201, name: 'Created', desc: 'Resource created successfully' },
  { code: 400, name: 'Bad Request', desc: 'Invalid request parameters' },
  { code: 401, name: 'Unauthorized', desc: 'Missing or invalid API key' },
  { code: 403, name: 'Forbidden', desc: 'Insufficient permissions for this resource' },
  { code: 404, name: 'Not Found', desc: 'Resource does not exist' },
  { code: 429, name: 'Rate Limited', desc: 'Too many requests. Check rate limits.' },
  { code: 500, name: 'Internal Server Error', desc: 'Something went wrong on our end' },
];

const SDK_LANGUAGES = ['javascript', 'typescript', 'python', 'node', 'php', 'java', 'go', 'csharp'];

const CHANGELOG = [
  { version: 'v1.0.0', date: '2026-07-30', changes: 'Initial public API release. All modules exposed.' },
];

export function DeveloperPortalPage() {
  const { data: dash, isLoading } = useAPIPlatformDashboard();
  const genSDK = useGenerateSDK();
  const genOpenAPI = useGenerateOpenAPISpec();
  const [tab, setTab] = useState<TabId>('explorer');
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);

  if (isLoading) return (<div><PageHeader title="Developer Portal" description="API explorer, SDK downloads, webhook testing, and documentation." /><div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div></div>);

  return (
    <div>
      <PageHeader title="Developer Portal" description="API explorer, SDK downloads, webhook testing, and documentation." actions={<button onClick={() => genOpenAPI.mutate()} disabled={genOpenAPI.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50"><FileText className="h-3.5 w-3.5" />Generate Docs</button>} />
      <Card>
        <div className="border-b border-gold-500/12 px-2"><div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">{TABS.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}><t.icon className="h-3.5 w-3.5" />{t.label}</button>))}</div></div>
        <div className="p-4">
          {tab === 'explorer' && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">{ENDPOINTS.map((e, i) => (<button key={i} onClick={() => setSelectedEndpoint(e)} className={cn('w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors', selectedEndpoint === e ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-300' : 'hover:bg-card-800 text-ink-500')}><Badge tone={e.method === 'GET' ? 'success' : e.method === 'POST' ? 'brand' : e.method === 'PUT' ? 'warning' : 'error'}>{e.method}</Badge><span className="text-xs font-mono truncate">{e.path}</span></button>))}</div><div className="md:col-span-2 space-y-3"><Card className="p-4"><div className="flex items-center gap-2 mb-3"><Badge tone={selectedEndpoint.method === 'GET' ? 'success' : selectedEndpoint.method === 'POST' ? 'brand' : selectedEndpoint.method === 'PUT' ? 'warning' : 'error'}>{selectedEndpoint.method}</Badge><code className="text-sm text-ink-500 font-mono">{selectedEndpoint.path}</code></div><p className="text-sm text-ink-500">{selectedEndpoint.desc}</p><div className="mt-4 space-y-2"><p className="text-xs text-ink-500">Try it out</p><div className="flex items-center gap-2"><input placeholder="API Key" className="flex-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none font-mono" /><button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15"><Zap className="h-3.5 w-3.5" />Send</button></div><div className="rounded-lg bg-maroon-950 border border-gold-500/12 p-3"><p className="text-xs text-ink-500 mb-1">Response</p><pre className="text-xs text-ink-500 font-mono overflow-x-auto">{`{\n  "status": "success",\n  "data": []\n}`}</pre></div></div></Card></div></div>)}
          {tab === 'docs' && (<div className="space-y-3"><Card className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">OpenAPI 3.0 Specification</p></div><button onClick={() => genOpenAPI.mutate()} disabled={genOpenAPI.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50"><Zap className="h-3 w-3" />{genOpenAPI.isPending ? 'Generating...' : 'Regenerate'}</button></div><p className="text-xs text-ink-500 mt-2">Full OpenAPI 3.0 spec covering all {ENDPOINTS.length} endpoints. Compatible with Swagger UI, Postman, and any OpenAPI-compatible tool.</p></Card>{dash?.documentation && dash.documentation.length > 0 && (<div className="space-y-2">{dash.documentation.map((d) => { const doc = d as Record<string, unknown>; return (<Card key={doc.id as string} className="p-3"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">Version {doc.doc_version as string}</span><Badge tone={doc.is_published ? 'success' : 'neutral'}>{doc.is_published ? 'Published' : 'Draft'}</Badge></div></Card>); })}</div>)}</div>)}
          {tab === 'sdks' && (<div className="space-y-4"><Card className="p-4"><p className="text-sm text-ink-500 mb-3">Generate SDKs for {SDK_LANGUAGES.length} languages. Each SDK includes type definitions, retry logic, and pagination helpers.</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{SDK_LANGUAGES.map((lang) => (<button key={lang} onClick={() => genSDK.mutate(lang)} disabled={genSDK.isPending} className="flex items-center gap-2 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2.5 text-sm text-ink-500 hover:border-brand-500 hover:text-brand-300 transition-colors disabled:opacity-50"><Download className="h-3.5 w-3.5" />{lang}</button>))}</div></Card>{dash?.sdkVersions && dash.sdkVersions.length > 0 && (<div className="space-y-2">{dash.sdkVersions.map((s) => { const sdk = s as Record<string, unknown>; return (<Card key={sdk.id as string} className="p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-brand-400" /><span className="text-sm text-ink-500">{sdk.language as string} v{sdk.version as string}</span></div><Badge tone={sdk.is_stable ? 'success' : 'neutral'}>{sdk.is_stable ? 'Stable' : 'Preview'}</Badge></div></Card>); })}</div>)}</div>)}
          {tab === 'webhooks' && (<div className="space-y-3"><Card className="p-4"><div className="flex items-center gap-2 mb-2"><Webhook className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">Webhook Testing</p></div><p className="text-xs text-ink-500">Test your webhook endpoints by sending sample events from the platform.</p><div className="mt-3 space-y-2"><input placeholder="https://your-endpoint.com/webhook" className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none" /><select className="w-full rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500 focus:border-brand-500 focus:outline-none"><option>lead.created</option><option>meeting.booked</option><option>proposal.sent</option><option>invoice.paid</option><option>customer.created</option></select><button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15"><Send className="h-3.5 w-3.5" />Send Test Event</button></div></Card></div>)}
          {tab === 'quickstart' && (<div className="space-y-3"><Card className="p-4 space-y-3"><div className="flex items-center gap-2"><Key className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">1. Get your API key</p></div><p className="text-xs text-ink-500">Create an API key from the API Platform page.</p></Card><Card className="p-4 space-y-3"><div className="flex items-center gap-2"><Code className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">2. Make your first request</p></div><div className="rounded-lg bg-maroon-950 border border-gold-500/12 p-3"><div className="flex items-center justify-between mb-2"><span className="text-xs text-ink-500">bash</span><Copy className="h-3 w-3 text-ink-500 cursor-pointer hover:text-ink-500" /></div><pre className="text-xs text-ink-500 font-mono overflow-x-auto">{`curl -X GET https://api.revenueai.com/api/v1/companies \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre></div></Card><Card className="p-4 space-y-3"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">3. Install the SDK</p></div><div className="rounded-lg bg-maroon-950 border border-gold-500/12 p-3"><pre className="text-xs text-ink-500 font-mono overflow-x-auto">{`npm install @revenueai/sdk\n# or\npip install revenueai`}</pre></div></Card></div>)}
          {tab === 'errors' && (<div className="space-y-2">{ERROR_CODES.map((e) => (<Card key={e.code} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Badge tone={e.code < 300 ? 'success' : e.code < 500 ? 'warning' : 'error'}>{e.code}</Badge><div><p className="text-sm font-medium text-ink-500">{e.name}</p><p className="text-xs text-ink-500">{e.desc}</p></div></div></div></Card>))}</div>)}
          {tab === 'changelog' && (<div className="space-y-2">{CHANGELOG.map((c) => (<Card key={c.version} className="p-3"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-ink-500">{c.version}</p><p className="text-xs text-ink-500">{c.date}</p></div><Badge tone="brand">{c.version}</Badge></div><p className="text-xs text-ink-500 mt-1">{c.changes}</p></Card>))}</div>)}
        </div>
      </Card>
    </div>
  );
}
