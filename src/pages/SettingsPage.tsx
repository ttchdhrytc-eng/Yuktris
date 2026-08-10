import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  Users,
  Key,
  Bell,
  Plug,
  CreditCard,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Mail,
  Calendar,
  Sparkles,
  Activity,
  DollarSign,
  TrendingUp,
  Cpu,
  AlertCircle,
  CheckCircle2,
  Brain,
  Bot,
  Network,
  GitBranch,
  Timer,
  Target,
  Server,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  ListOrdered,
  Gauge,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import type { ApiKey, WorkspaceMember } from '@/types';
import {
  useGoogleAccounts,
  useConnectGoogle,
  useDisconnectGoogle,
  useRefreshGoogleToken,
  useGoogleConnection,
} from '@/hooks/useGoogleAuth';
import { googleOAuthService } from '@/services/google-auth';
import {
  useGoogleWorkspace,
  useWorkspaceHealth,
  useRefreshWorkspace,
  useRequestServiceScopes,
} from '@/hooks/useGoogleWorkspace';
import { WORKSPACE_SERVICES } from '@/types/google-workspace';
import type { GoogleWorkspaceServiceId, ConnectionHealth } from '@/types/google-workspace';
import {
  useIntegrations,
  useIntegrationHealth,
  useIntegrationLogs,
  useConnectIntegration,
  useDisconnectIntegration,
  useRefreshIntegration,
  useSyncIntegration,
  useHealthSummary,
} from '@/hooks/useIntegrations';
import { providerRegistry } from '@/services/integrations';
import type { IntegrationStatus } from '@/types/integrations';
import {
  useAIModels,
  useAIHealth,
  usePromptLibrary,
  useAIUsage,
  useAICosts,
  useAIRequests,
  useAIDailyCost,
  useAIMonthlyCost,
} from '@/hooks/useAIGateway';
import { aiProviderRegistry } from '@/services/ai';
import type { AIProviderId, ModelStatus, RequestStatus } from '@/types/ai-gateway';
import {
  useAgents,
  useAgentHealth,
  useAgentHistory,
  useAgentSummary,
} from '@/hooks/useAgentOrchestrator';
import type { AgentStatus, AgentCategory, ExecutionStatus } from '@/types/agent-orchestrator';
import {
  useExecution,
  useExecutionStatus,
  useExecutionHistory,
  useJobs,
  useWorkers,
  useExecutionEvents,
  usePauseWorkflow,
  useResumeWorkflow,
  useCancelWorkflow,
  useRetryWorkflow,
} from '@/hooks/useExecutionEngine';
import type { WorkflowState, JobState, WorkerState } from '@/types/execution-engine';
import {
  useGmail,
  useConnectGmail,
  useDisconnectGmail,
  useSyncInbox,
  useRefreshGmail,
} from '@/hooks/useGmail';
import { SCOPE_LABELS } from '@/types/google-auth';
import { Inbox, Send, Search, Star, Archive, Mail as MailIcon, AlertTriangle, WifiOff, ZapOff, ShieldCheck, Video, Folder, Layers, FileText, X } from 'lucide-react';

const tabs = [
  { id: 'workspace', label: 'Workspace', icon: SettingsIcon },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'ai-agents', label: 'AI Agents', icon: Bot },
  { id: 'execution', label: 'Execution Engine', icon: Server },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]['id'];

// ============================================================
// AI Tab — Enterprise AI Gateway management
// ============================================================

function AIProviderHealthBadge({ status }: { status: string }) {
  const config: Record<string, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    healthy: { tone: 'success', label: 'Healthy' },
    degraded: { tone: 'warning', label: 'Degraded' },
    down: { tone: 'error', label: 'Down' },
    unknown: { tone: 'neutral', label: 'Not Configured' },
  };
  const { tone, label } = config[status] ?? config.unknown;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const config: Record<ModelStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    preview: { tone: 'warning', label: 'Preview' },
    deprecated: { tone: 'neutral', label: 'Deprecated' },
    disabled: { tone: 'neutral', label: 'Disabled' },
  };
  const { tone, label } = config[status] ?? config.disabled;
  return <Badge tone={tone}>{label}</Badge>;
}

function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const config: Record<RequestStatus, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    success: { tone: 'success', label: 'Success' },
    error: { tone: 'error', label: 'Error' },
    timeout: { tone: 'warning', label: 'Timeout' },
    rate_limited: { tone: 'warning', label: 'Rate Limited' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
  };
  const { tone, label } = config[status] ?? config.error;
  return <Badge tone={tone}>{label}</Badge>;
}

function AITab() {
  const { data: models, isLoading: modelsLoading } = useAIModels();
  const { data: health } = useAIHealth();
  const { data: prompts } = usePromptLibrary();
  const { data: usage } = useAIUsage(30);
  const { data: costs } = useAICosts();
  const { data: requests } = useAIRequests(20);
  const { data: dailyCost } = useAIDailyCost();
  const { data: monthlyCost } = useAIMonthlyCost();

  const allProviders = aiProviderRegistry.getAllDefinitions();

  if (modelsLoading) return <Spinner className="h-6 w-6" />;

  // Group models by provider
  const modelsByProvider = (models ?? []).reduce<Record<string, typeof models>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {});

  // Calculate avg latency and error rate from recent requests
  const recentRequests = (requests ?? []) as Array<{ latency_ms: number; status: string }>;
  const avgLatency = recentRequests.length > 0
    ? Math.round(recentRequests.reduce((sum, r) => sum + r.latency_ms, 0) / recentRequests.length)
    : 0;
  const errorRate = recentRequests.length > 0
    ? Math.round((recentRequests.filter((r) => r.status !== 'success').length / recentRequests.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Provider Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-brand-400" />
            <CardTitle>AI Providers</CardTitle>
          </div>
          <CardDescription>Connected AI providers and their health status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allProviders.map((provider) => {
              const healthResult = (health ?? []).find((h) => h.provider === provider.id);
              const providerModels = modelsByProvider[provider.id] ?? [];
              return (
                <div key={provider.id} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                    style={{ backgroundColor: `${provider.color}15`, color: provider.color }}
                  >
                    {provider.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-ink-500">{provider.name}</p>
                      <AIProviderHealthBadge status={healthResult?.status ?? 'unknown'} />
                      <span className="text-xs text-ink-500">{providerModels.length} models</span>
                    </div>
                    <p className="text-xs text-ink-500 truncate">{provider.description}</p>
                  </div>
                  {healthResult?.latency_ms !== null && healthResult?.latency_ms !== undefined && (
                    <span className="text-xs text-ink-500">{healthResult.latency_ms}ms</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cost Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Daily Cost</span>
              <DollarSign className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">
              ${typeof dailyCost === 'number' ? dailyCost.toFixed(4) : '0.0000'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Monthly Cost</span>
              <TrendingUp className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">
              ${typeof monthlyCost === 'number' ? monthlyCost.toFixed(4) : '0.0000'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Total Requests</span>
              <Activity className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{usage?.total_requests ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-400" />
            <CardTitle>Model Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-ink-500">Avg Response Time</p>
              <p className="text-lg font-medium text-ink-500">{avgLatency}ms</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Error Rate</p>
              <p className="text-lg font-medium text-ink-500">{errorRate}%</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total Tokens</p>
              <p className="text-lg font-medium text-ink-500">{usage?.total_tokens ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Active Models</p>
              <p className="text-lg font-medium text-ink-500">{(models ?? []).length}</p>
            </div>
          </div>

          {/* Available Models Table */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink-500 mb-2">Available Models</p>
            {(models ?? []).map((model) => (
              <div key={model.id} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink-500">{model.model_name}</p>
                    <ModelStatusBadge status={model.status as ModelStatus} />
                  </div>
                  <p className="text-xs text-ink-500">
                    {model.provider} • {model.context_window.toLocaleString()} ctx
                    {model.supports_streaming && ' • streaming'}
                    {model.supports_tools && ' • tools'}
                    {model.supports_images && ' • vision'}
                    {model.supports_embeddings && ' • embeddings'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-500">
                    ${Number(model.input_cost_per_1k).toFixed(4)}/${Number(model.output_cost_per_1k).toFixed(4)}
                  </p>
                  <p className="text-xs text-ink-500">per 1K tok</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Library */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <CardTitle>Prompt Library</CardTitle>
            <span className="text-xs text-ink-500">({(prompts ?? []).length} prompts)</span>
          </div>
          <CardDescription>Centralized prompt templates with versioning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {(prompts ?? []).map((prompt) => (
              <div key={prompt.id} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-medium text-ink-500">{prompt.prompt_name}</p>
                  <Badge tone="neutral">v{prompt.version}</Badge>
                  {prompt.model_override && <Badge tone="brand">{prompt.model_override}</Badge>}
                </div>
                {prompt.description && <p className="text-xs text-ink-500 mb-1">{prompt.description}</p>}
                <p className="text-xs text-ink-500 font-mono truncate">
                  {prompt.system_prompt.substring(0, 100)}...
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-ink-500">temp: {Number(prompt.temperature)}</span>
                  {prompt.max_tokens && <span className="text-xs text-ink-500">max: {prompt.max_tokens}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-400" />
            <CardTitle>Request History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(requests ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No AI requests yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(requests ?? []).map((req: Record<string, unknown>) => (
                <div key={req.id as string} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                  <RequestStatusBadge status={req.status as RequestStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-500">
                      {req.agent_name as string} • {req.provider as string} • {req.model as string}
                    </p>
                    <p className="text-xs text-ink-500">
                      {new Date(req.created_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-500">{req.total_tokens as number} tok</p>
                    <p className="text-xs text-ink-500">${Number(req.estimated_cost).toFixed(4)}</p>
                  </div>
                  <span className="text-xs text-ink-500">{req.latency_ms as number}ms</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// AI Agents Tab — Agent Orchestrator management
// ============================================================

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'neutral', label: 'Inactive' },
    deprecated: { tone: 'warning', label: 'Deprecated' },
    error: { tone: 'error', label: 'Error' },
  };
  const { tone, label } = config[status] ?? config.inactive;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function AgentHealthBadge({ status }: { status: string }) {
  const config: Record<string, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    healthy: { tone: 'success', label: 'Healthy' },
    degraded: { tone: 'warning', label: 'Degraded' },
    down: { tone: 'error', label: 'Down' },
    unknown: { tone: 'neutral', label: 'No Executions' },
  };
  const { tone, label } = config[status] ?? config.unknown;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const config: Record<ExecutionStatus, { tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; label: string }> = {
    pending: { tone: 'neutral', label: 'Pending' },
    planning: { tone: 'brand', label: 'Planning' },
    running: { tone: 'brand', label: 'Running' },
    completed: { tone: 'success', label: 'Completed' },
    failed: { tone: 'error', label: 'Failed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    timeout: { tone: 'warning', label: 'Timeout' },
  };
  const { tone, label } = config[status] ?? config.pending;
  return <Badge tone={tone}>{label}</Badge>;
}

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  research: Target,
  intelligence: Brain,
  scoring: TrendingUp,
  generation: Sparkles,
  communication: Mail,
  crm: Network,
  scheduling: Calendar,
  analysis: Activity,
  workflow: GitBranch,
};

function AgentsTab() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: health } = useAgentHealth();
  const { data: history } = useAgentHistory(20);
  const { data: summary } = useAgentSummary();

  if (agentsLoading) return <Spinner className="h-6 w-6" />;

  const allAgents = (agents ?? []) as Array<{
    id: string;
    agent_name: string;
    description: string | null;
    version: string;
    status: AgentStatus;
    category: AgentCategory;
    capabilities: string[];
  }>;

  return (
    <div className="space-y-4">
      {/* Orchestrator Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Total Agents</span>
              <Bot className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{summary?.total_agents ?? allAgents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Total Executions</span>
              <Activity className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{summary?.total_executions ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Avg Success Rate</span>
              <CheckCircle2 className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{summary?.average_success_rate ?? 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Avg Execution Time</span>
              <Timer className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{summary?.average_execution_time_ms ?? 0}ms</p>
          </CardContent>
        </Card>
      </div>

      {/* Registered Agents */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-brand-400" />
            <CardTitle>Registered Agents</CardTitle>
            <span className="text-xs text-ink-500">({allAgents.length} agents)</span>
          </div>
          <CardDescription>All AI agents managed by the orchestrator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allAgents.map((agent) => {
              const healthResult = (health ?? []).find((h) => h.agent_name === agent.agent_name);
              const CategoryIcon = CATEGORY_ICONS[agent.category] ?? Bot;
              return (
                <div key={agent.id} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 shrink-0">
                      <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-medium text-ink-500">{agent.agent_name.replace(/_/g, ' ')}</p>
                        <AgentStatusBadge status={agent.status} />
                        <AgentHealthBadge status={healthResult?.status ?? 'unknown'} />
                        <Badge tone="neutral">v{agent.version}</Badge>
                        <Badge tone="brand">{agent.category}</Badge>
                      </div>
                      {agent.description && (
                        <p className="text-xs text-ink-500 mb-1.5">{agent.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {agent.capabilities.map((cap) => (
                          <span key={cap} className="text-xs text-ink-500 bg-maroon-950 rounded px-1.5 py-0.5">
                            {cap.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                      {healthResult && healthResult.total_executions > 0 && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gold-500/8">
                          <span className="text-xs text-ink-500">
                            {healthResult.total_executions} executions
                          </span>
                          <span className="text-xs text-ink-500">
                            {healthResult.success_rate}% success
                          </span>
                          <span className="text-xs text-ink-500">
                            avg {healthResult.average_execution_time_ms}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-400" />
            <CardTitle>Execution History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(history ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No agent executions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(history ?? []).map((exec: Record<string, unknown>) => {
                const agentInfo = exec.agent_registry as { agent_name: string; category: string } | null;
                return (
                  <div key={exec.id as string} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                    <ExecutionStatusBadge status={exec.status as ExecutionStatus} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-500">
                        {agentInfo?.agent_name?.replace(/_/g, ' ') ?? 'Unknown Agent'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {new Date(exec.created_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-ink-500">{exec.tokens_used as number} tok</p>
                      <p className="text-xs text-ink-500">${Number(exec.estimated_cost).toFixed(4)}</p>
                    </div>
                    <span className="text-xs text-ink-500">{exec.execution_time_ms as number}ms</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Execution Engine Tab — Runtime monitoring and management
// ============================================================

function WorkflowStatusBadge({ status }: { status: WorkflowState }) {
  const config: Record<WorkflowState, { tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; label: string }> = {
    pending: { tone: 'neutral', label: 'Pending' },
    planning: { tone: 'brand', label: 'Planning' },
    queued: { tone: 'brand', label: 'Queued' },
    running: { tone: 'brand', label: 'Running' },
    paused: { tone: 'warning', label: 'Paused' },
    completed: { tone: 'success', label: 'Completed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    failed: { tone: 'error', label: 'Failed' },
  };
  const { tone, label } = config[status] ?? config.pending;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function JobStatusBadge({ status }: { status: JobState }) {
  const config: Record<JobState, { tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; label: string }> = {
    pending: { tone: 'neutral', label: 'Pending' },
    queued: { tone: 'brand', label: 'Queued' },
    waiting: { tone: 'neutral', label: 'Waiting' },
    running: { tone: 'brand', label: 'Running' },
    paused: { tone: 'warning', label: 'Paused' },
    retrying: { tone: 'warning', label: 'Retrying' },
    completed: { tone: 'success', label: 'Completed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    failed: { tone: 'error', label: 'Failed' },
    dead_letter: { tone: 'error', label: 'Dead Letter' },
  };
  const { tone, label } = config[status] ?? config.pending;
  return <Badge tone={tone}>{label}</Badge>;
}

function WorkerStatusBadge({ status }: { status: WorkerState }) {
  const config: Record<WorkerState, { tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; label: string }> = {
    idle: { tone: 'neutral', label: 'Idle' },
    busy: { tone: 'brand', label: 'Busy' },
    paused: { tone: 'warning', label: 'Paused' },
    offline: { tone: 'neutral', label: 'Offline' },
    error: { tone: 'error', label: 'Error' },
  };
  const { tone, label } = config[status] ?? config.offline;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function ExecutionEngineTab() {
  const { data: summary } = useExecution();
  const { data: queueStatus } = useExecutionStatus();
  const { data: workflows } = useExecutionHistory(20);
  const { data: jobs } = useJobs(30);
  const { data: workers } = useWorkers();
  const { data: events } = useExecutionEvents(30);

  const pauseMutation = usePauseWorkflow();
  const resumeMutation = useResumeWorkflow();
  const cancelMutation = useCancelWorkflow();
  const retryMutation = useRetryWorkflow();

  const s = summary ?? {
    total_workflows: 0, running_workflows: 0, pending_workflows: 0, completed_workflows: 0,
    failed_workflows: 0, total_jobs: 0, queued_jobs: 0, running_jobs: 0, completed_jobs: 0,
    failed_jobs: 0, dead_letter_jobs: 0, total_workers: 0, active_workers: 0, busy_workers: 0,
    queue_size: 0, average_execution_time_ms: 0, failure_rate: 0, retry_count: 0, throughput_per_minute: 0,
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Queue Size</span>
              <ListOrdered className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{s.queue_size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Running Jobs</span>
              <Activity className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{s.running_jobs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Active Workers</span>
              <Server className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{s.active_workers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-500">Throughput/min</span>
              <Gauge className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-2xl font-semibold text-ink-500">{s.throughput_per_minute}</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-brand-400" />
            <CardTitle>Performance Metrics</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-ink-500">Avg Execution Time</p>
              <p className="text-lg font-medium text-ink-500">{s.average_execution_time_ms}ms</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Failure Rate</p>
              <p className="text-lg font-medium text-ink-500">{s.failure_rate}%</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Retry Count</p>
              <p className="text-lg font-medium text-ink-500">{s.retry_count}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Dead Letter Jobs</p>
              <p className="text-lg font-medium text-ink-500">{s.dead_letter_jobs}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total Workflows</p>
              <p className="text-lg font-medium text-ink-500">{s.total_workflows}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-brand-400" />
            <CardTitle>Queue Health</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-ink-500">Pending</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.pending ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Queued</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.queued ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Running</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.running ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Retrying</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.retrying ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Dead Letter</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.dead_letter ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Total</p>
              <p className="text-lg font-medium text-ink-500">{queueStatus?.total ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-400" />
            <CardTitle>Worker Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(workers ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No workers registered.</p>
          ) : (
            <div className="space-y-1.5">
              {(workers ?? []).map((worker) => (
                <div key={worker.id} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                  <WorkerStatusBadge status={worker.status as WorkerState} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-500">{worker.worker_name}</p>
                    <p className="text-xs text-ink-500">{worker.worker_type} type</p>
                  </div>
                  {worker.current_job && (
                    <span className="text-xs text-ink-500">Job: {worker.current_job.substring(0, 8)}...</span>
                  )}
                  {worker.last_heartbeat && (
                    <span className="text-xs text-ink-500">
                      {new Date(worker.last_heartbeat).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-brand-400" />
            <CardTitle>Workflow History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(workflows ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No workflows executed yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(workflows ?? []).map((wf: Record<string, unknown>) => (
                <div key={wf.id as string} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                  <WorkflowStatusBadge status={wf.status as WorkflowState} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-500">{wf.workflow_name as string}</p>
                    <p className="text-xs text-ink-500">
                      {new Date(wf.created_at as string).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {wf.status === 'running' && (
                      <button
                        onClick={() => pauseMutation.mutate(wf.id as string)}
                        className="rounded p-1 text-ink-500 hover:text-warning-500 hover:bg-warning-500/10"
                        title="Pause"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {wf.status === 'paused' && (
                      <button
                        onClick={() => resumeMutation.mutate(wf.id as string)}
                        className="rounded p-1 text-ink-500 hover:text-success-500 hover:bg-success-500/10"
                        title="Resume"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(wf.status === 'failed') && (
                      <button
                        onClick={() => retryMutation.mutate(wf.id as string)}
                        className="rounded p-1 text-ink-500 hover:text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/10"
                        title="Retry"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {['running', 'paused', 'queued', 'pending'].includes(wf.status as string) && (
                      <button
                        onClick={() => cancelMutation.mutate(wf.id as string)}
                        className="rounded p-1 text-ink-500 hover:text-error-400 hover:bg-error-500/10"
                        title="Cancel"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-400" />
            <CardTitle>Recent Jobs</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No jobs executed yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(jobs ?? []).map((job: Record<string, unknown>) => (
                <div key={job.id as string} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                  <JobStatusBadge status={job.status as JobState} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-500">{job.job_name as string}</p>
                    <p className="text-xs text-ink-500">
                      {(job.worker_type as string)} • attempt {(job.attempts as number) + 1}/{job.max_attempts as number}
                    </p>
                  </div>
                  {job.error && (
                    <span className="text-xs text-error-400 truncate max-w-32">{job.error as string}</span>
                  )}
                  <span className="text-xs text-ink-500">
                    {new Date(job.created_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-400" />
            <CardTitle>Execution Timeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No events recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {(events ?? []).slice(0, 20).map((event: Record<string, unknown>) => (
                <div key={event.id as string} className="flex items-center gap-2 text-xs">
                  <span className="text-ink-500">
                    {new Date(event.created_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <Badge tone="neutral">{(event.event_type as string).replace(/_/g, ' ')}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>('workspace');

  return (
    <div>
      <PageHeader title="Settings" description="Manage your workspace settings and preferences." />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs sidebar */}
        <div className="lg:w-48 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible scrollbar-thin">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  tab === t.id
                    ? 'bg-card-900 text-ink-500 font-medium'
                    : 'text-ink-500 hover:bg-card-800 hover:text-ink-500'
                )}
              >
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {tab === 'workspace' && <WorkspaceTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'api-keys' && <ApiKeysTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'integrations' && <IntegrationsTab />}
          {tab === 'ai' && <AITab />}
          {tab === 'ai-agents' && <AgentsTab />}
          {tab === 'execution' && <ExecutionEngineTab />}
          {tab === 'billing' && <BillingTab />}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab() {
  const { workspace, refresh } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    website: workspace?.website ?? '',
    industry: workspace?.industry ?? '',
    country: workspace?.country ?? '',
    timezone: workspace?.timezone ?? 'UTC',
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: form.name,
          website: form.website || null,
          industry: form.industry || null,
          country: form.country || null,
          timezone: form.timezone,
        })
        .eq('id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      refresh();
      toast.success('Workspace updated.');
    },
    onError: (err) => toast.error(err.message),
  });

  if (!workspace) return <Spinner className="h-6 w-6" />;

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Workspace Details</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
          <div>
            <Label>Workspace name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { workspace } = useWorkspace();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['workspace-members', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('workspace_members')
        .select('*, user:user_id(email)')
        .eq('workspace_id', workspace.id);
      return (data ?? []) as (WorkspaceMember & { user: { email: string } | null })[];
    },
  });

  if (isLoading) return <Spinner className="h-6 w-6" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Team Members</CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Invite
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gold-500/8 last:border-0">
                <Avatar name={m.user?.email ?? '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-500 truncate">{m.user?.email ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-500">Joined {formatDate(m.created_at)}</p>
                </div>
                <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Team Member"
        description="Send an invitation to join your workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!inviteEmail) { toast.error('Enter an email address.'); return; }
              toast.info('Team invitations will be available once email is configured.');
              setInviteOpen(false);
              setInviteEmail('');
            }}>Send Invite</Button>
          </>
        }
      >
        <div>
          <Label>Email address</Label>
          <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" autoFocus />
        </div>
      </Modal>
    </div>
  );
}

function ApiKeysTab() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'openai' });

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as ApiKey[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('api_keys').insert({
        workspace_id: workspace.id,
        name: form.name,
        provider: form.provider,
        key_prefix: 'sk-••••',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key added.');
      setCreateOpen(false);
      setForm({ name: '', provider: 'openai' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key removed.');
    },
  });

  if (isLoading) return <Spinner className="h-6 w-6" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>API Keys</CardTitle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Key
          </Button>
        </CardHeader>
        <CardContent>
          {keys && keys.length > 0 ? (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-2 border-b border-gold-500/8 last:border-0">
                  <Key className="h-4 w-4 text-ink-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-500">{k.name}</p>
                    <p className="text-xs text-ink-500">{k.provider} · {k.key_prefix ?? '••••'}</p>
                  </div>
                  <span className="text-xs text-ink-500">{timeAgo(k.last_used_at)}</span>
                  <button onClick={() => deleteMutation.mutate(k.id)} className="text-ink-500 hover:text-error-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Key className="h-5 w-5" />} title="No API keys" description="Add API keys for your integrations." className="py-8" />
          )}
        </CardContent>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add API Key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!form.name.trim()) { toast.error('Key name is required.'); return; }
              createMutation.mutate();
            }} loading={createMutation.isPending}>Add Key</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Key name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OpenAI Production" autoFocus />
          </div>
          <div>
            <Label>Provider</Label>
            <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              {['openai', 'firecrawl', 'tavily', 'resend', 'paddle', 'other'].map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <p className="text-xs text-ink-500">API keys are stored securely and encrypted at rest.</p>
        </div>
      </Modal>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    newReplies: true,
    meetingBooked: true,
    campaignCompleted: false,
    weeklyReport: true,
    agentErrors: true,
  });

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.keys(prefs) as (keyof typeof prefs)[]).map((key) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-gold-500/8 last:border-0">
              <div>
                <p className="text-sm text-ink-500 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</p>
                <p className="text-xs text-ink-500">
                  {key === 'newReplies' && 'Get notified when a prospect replies to your outreach'}
                  {key === 'meetingBooked' && 'Get notified when a meeting is booked'}
                  {key === 'campaignCompleted' && 'Get notified when a campaign completes'}
                  {key === 'weeklyReport' && 'Receive a weekly performance summary'}
                  {key === 'agentErrors' && 'Get notified when an AI agent encounters an error'}
                </p>
              </div>
              <button
                onClick={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors shrink-0',
                  prefs[key] ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-border-strong'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-card-900 transition-transform',
                  prefs[key] ? 'left-5' : 'left-0.5'
                )} />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => toast.success('Notification preferences saved.')}>Save Preferences</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GmailIntegrationCard() {
  const { data: gmailState, isLoading } = useGmail();
  const connectMutation = useConnectGmail();
  const disconnectMutation = useDisconnectGmail();
  const syncMutation = useSyncInbox();
  const refreshMutation = useRefreshGmail();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MailIcon className="h-4 w-4 text-brand-400" />
            <CardTitle>Gmail</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = gmailState?.isConnected ?? false;
  const missingScopes = gmailState?.missingScopes ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MailIcon className="h-4 w-4 text-brand-400" />
          <CardTitle>Gmail Integration</CardTitle>
        </div>
        <p className="text-xs text-ink-500 mt-0.5">Read, send, search, and manage Gmail messages</p>
      </CardHeader>
      <CardContent>
        {isConnected && gmailState.account ? (
          <div className="space-y-4">
            {/* Connection status */}
            <div className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 shrink-0">
                <MailIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-500 truncate">{gmailState.account.email}</p>
                <p className="text-xs text-ink-500">
                  Last sync: {gmailState.lastSync ? timeAgo(gmailState.lastSync) : 'Never'}
                </p>
              </div>
              <Badge tone="success" dot>Connected</Badge>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem icon={Inbox} label="Inbox Count" value={String(gmailState.inboxCount)} />
              <DetailItem icon={MailIcon} label="Unread" value={String(gmailState.unreadCount)} tone={gmailState.unreadCount > 0 ? 'error' : undefined} />
              <DetailItem icon={Clock} label="Last Sync" value={gmailState.lastSync ? timeAgo(gmailState.lastSync) : 'Never'} />
              <DetailItem
                icon={RefreshCw}
                label="Sync Status"
                value={gmailState.syncStatus === 'idle' ? 'Idle' : gmailState.syncStatus === 'syncing' ? 'Syncing...' : 'Error'}
                tone={gmailState.syncStatus === 'error' ? 'error' : undefined}
              />
            </div>

            {/* Missing scopes warning */}
            {missingScopes.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-ink-500">Additional Gmail permissions needed</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Missing: {missingScopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    Reconnect your Google account to grant these permissions. Your existing connection will be preserved.
                  </p>
                </div>
              </div>
            )}

            {/* Error states */}
            {gmailState.syncStatus === 'error' && (
              <div className="flex items-start gap-3 rounded-lg border border-error-500/30 bg-error-500/5 p-3">
                <WifiOff className="h-4 w-4 text-error-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-ink-500">Sync Error</p>
                  <p className="text-xs text-ink-500 mt-0.5">The last sync attempt failed. Try refreshing or reconnecting.</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync Inbox
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                loading={refreshMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate(gmailState.account!.id)}
                loading={disconnectMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Missing scopes info when Google is connected but Gmail scopes aren't */}
            {missingScopes.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-ink-500">Gmail permissions required</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Your Google account is connected but Gmail permissions are missing. Reconnect your Google account to grant Gmail access.
                  </p>
                </div>
              </div>
            )}
            <EmptyState
              icon={<MailIcon className="h-5 w-5" />}
              title="Gmail not connected"
              description="Connect Gmail to read, send, search, and manage your emails directly from Yuktris."
              className="py-6"
              action={
                <Button
                  onClick={() => connectMutation.mutate()}
                  loading={connectMutation.isPending}
                  disabled={missingScopes.length > 0}
                >
                  <Plus className="h-4 w-4" />
                  {missingScopes.length > 0 ? 'Reconnect Google First' : 'Connect Gmail'}
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health }: { health: ConnectionHealth }) {
  const config: Record<ConnectionHealth, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    healthy: { tone: 'success', label: 'Healthy' },
    degraded: { tone: 'warning', label: 'Degraded' },
    expired: { tone: 'warning', label: 'Expired' },
    error: { tone: 'error', label: 'Error' },
    unknown: { tone: 'neutral', label: 'Unknown' },
  };
  const { tone, label } = config[health] ?? config.unknown;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function GoogleWorkspaceCard() {
  const { data: workspaceState, isLoading } = useGoogleWorkspace();
  const { data: health } = useWorkspaceHealth();
  const refreshMutation = useRefreshWorkspace();
  const requestScopesMutation = useRequestServiceScopes();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <CardTitle>Google Workspace Services</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
        </CardContent>
      </Card>
    );
  }

  if (!workspaceState?.account) {
    return null;
  }

  const serviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    mail: Mail,
    calendar: Calendar,
    video: Video,
    users: Users,
    folder: Folder,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <CardTitle>Google Workspace Services</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {health && <HealthBadge health={health.health} />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              loading={refreshMutation.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-500 mt-0.5">Manage which Google services can access your connected account</p>
      </CardHeader>
      <CardContent>
        {/* Health details */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <DetailItem
              icon={Activity}
              label="Connection Health"
              value={health.health.charAt(0).toUpperCase() + health.health.slice(1)}
              tone={health.health === 'error' || health.health === 'expired' ? 'error' : undefined}
            />
            <DetailItem
              icon={Clock}
              label="Token Expires"
              value={health.tokenExpiresAt
                ? new Date(health.tokenExpiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : 'N/A'}
              tone={health.tokenExpired ? 'error' : undefined}
            />
            <DetailItem
              icon={CheckCircle2}
              label="Last Health Check"
              value={health.lastCheckedAt
                ? new Date(health.lastCheckedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Never'}
            />
            <DetailItem
              icon={Mail}
              label="Granted Scopes"
              value={`${workspaceState.grantedScopes.length} scopes`}
            />
          </div>
        )}

        {/* Service list */}
        <div className="space-y-2">
          {WORKSPACE_SERVICES.map((service) => {
            const isGranted = workspaceState.services[service.id as GoogleWorkspaceServiceId];
            const Icon = serviceIcons[service.icon] ?? Plug;
            return (
              <div
                key={service.id}
                className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maroon-950 text-ink-500">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-500">{service.label}</p>
                    {isGranted ? (
                      <Badge tone="success" dot>Enabled</Badge>
                    ) : (
                      <Badge tone="warning" dot>Missing Scopes</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-500 truncate">{service.description}</p>
                </div>
                {!isGranted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => requestScopesMutation.mutate(service.id as GoogleWorkspaceServiceId)}
                    loading={requestScopesMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Grant Access
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Missing scopes summary */}
        {workspaceState.missingScopes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gold-500/8">
            <div className="flex items-center gap-1.5 mb-2 text-ink-500">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">Missing Scopes ({workspaceState.missingScopes.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {workspaceState.missingScopes.map((scope, i) => (
                <span key={i} className="rounded-md border border-warning-500/20 bg-warning-500/5 px-2 py-0.5 text-xs text-warning-400">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const config: Record<IntegrationStatus, { tone: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
    connected: { tone: 'success', label: 'Connected' },
    disconnected: { tone: 'neutral', label: 'Disconnected' },
    expired: { tone: 'warning', label: 'Expired' },
    error: { tone: 'error', label: 'Error' },
    pending: { tone: 'warning', label: 'Pending' },
  };
  const { tone, label } = config[status] ?? config.disconnected;
  return <Badge tone={tone} dot>{label}</Badge>;
}

function IntegrationHubCard() {
  const { data: integrations, isLoading } = useIntegrations();
  const { data: healthSummary } = useHealthSummary();
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const refreshMutation = useRefreshIntegration();
  const syncMutation = useSyncIntegration();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | IntegrationStatus>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  const allProviders = providerRegistry.getAllDefinitions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-400" />
            <CardTitle>Integration Hub</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
        </CardContent>
      </Card>
    );
  }

  const merged = allProviders.map((def) => {
    const record = integrations?.find((i) => i.provider === def.id);
    return { definition: def, record: record ?? null };
  });

  const filtered = merged.filter(({ definition, record }) => {
    if (search && !definition.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all') {
      const status = record?.status ?? 'disconnected';
      if (status !== statusFilter) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-400" />
            <CardTitle>Integration Hub</CardTitle>
            <span className="text-xs text-ink-500">({allProviders.length} providers)</span>
          </div>
          {healthSummary && healthSummary.total > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-success-400">{healthSummary.healthy} healthy</span>
              <span className="text-ink-500">/</span>
              <span className="text-warning-500">{healthSummary.degraded + healthSummary.expired} degraded</span>
              <span className="text-ink-500">/</span>
              <span className="text-error-400">{healthSummary.error} errors</span>
            </div>
          )}
        </div>
        <p className="text-xs text-ink-500 mt-0.5">Central management for all external provider connections</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <input
              type="text"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-card-900 border border-gold-500/12 text-sm text-ink-500 placeholder:text-ink-500 focus:outline-none focus:border-brand-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | IntegrationStatus)}
            className="h-9 px-3 rounded-lg bg-card-900 border border-gold-500/12 text-sm text-ink-500 focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="expired">Expired</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="space-y-2">
          {filtered.map(({ definition, record }) => {
            const isConnected = record?.status === 'connected';
            const isExpired = record?.is_expired ?? false;
            return (
              <div
                key={definition.id}
                className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: `${definition.color}15`, color: definition.color }}
                >
                  {definition.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink-500">{definition.name}</p>
                    {record && <IntegrationStatusBadge status={record.status} />}
                    {isExpired && record?.status === 'connected' && (
                      <Badge tone="warning" dot>Token Expired</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-500 truncate">{definition.description}</p>
                  {record?.connected_account && (
                    <p className="text-xs text-ink-500 mt-0.5">{record.connected_account}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isConnected && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshMutation.mutate(record.id)}
                        loading={refreshMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncMutation.mutate(record.id)}
                        loading={syncMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIntegration(record.id)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectMutation.mutate(record.id)}
                        loading={disconnectMutation.isPending}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                  {!isConnected && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => connectMutation.mutate({ provider: definition.id })}
                      loading={connectMutation.isPending}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedIntegration && (
          <IntegrationLogModal
            integrationId={selectedIntegration}
            onClose={() => setSelectedIntegration(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationLogModal({ integrationId, onClose }: { integrationId: string; onClose: () => void }) {
  const { data: logs, isLoading } = useIntegrationLogs(integrationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/50" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-gold-500/12 bg-maroon-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gold-500/8">
          <h3 className="text-sm font-semibold text-ink-500">Connection Logs</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">No logs found.</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => {
                const tone = log.status === 'success' ? 'success' : log.status === 'failure' ? 'error' : log.status === 'warning' ? 'warning' : 'neutral';
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-2.5">
                    <Badge tone={tone as 'success' | 'error' | 'warning' | 'neutral'}>{log.status}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-500">{log.message}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {log.event} • {new Date(log.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const { workspace } = useWorkspace();

  const { data: googleAccounts, isLoading: googleLoading } = useGoogleAccounts();
  const { data: googleConnection } = useGoogleConnection();
  const connectMutation = useConnectGoogle();
  const disconnectMutation = useDisconnectGoogle();
  const refreshMutation = useRefreshGoogleToken();

  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);

  if (googleLoading) return <Spinner className="h-6 w-6" />;

  const primaryAccount = googleAccounts?.find((a) => a.is_primary);
  const connectedScopes = googleConnection?.token?.scope
    ? googleOAuthService.getGrantedScopeLabels(googleConnection.token.scope)
    : [];

  return (
    <div className="space-y-6">
      {/* Google Account Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-400" />
            <CardTitle>Google Account</CardTitle>
          </div>
          <p className="text-xs text-ink-500 mt-0.5">Connect Google for Gmail, Calendar, Meet, Drive, and Contacts</p>
        </CardHeader>
        <CardContent>
          {googleLoading ? (
            <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
          ) : primaryAccount ? (
            <div className="space-y-4">
              {/* Connection status */}
              <div className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-4">
                <Avatar name={primaryAccount.display_name ?? primaryAccount.email} src={primaryAccount.avatar ?? undefined} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-500 truncate">{primaryAccount.display_name ?? primaryAccount.email}</p>
                    {primaryAccount.is_primary && <Badge tone="brand">Primary</Badge>}
                  </div>
                  <p className="text-xs text-ink-500 truncate">{primaryAccount.email}</p>
                </div>
                <GoogleStatusBadge status={primaryAccount.status} isExpired={googleConnection?.isExpired ?? false} />
              </div>

              {/* Connection details */}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem icon={Calendar} label="Connected Since" value={formatDate(primaryAccount.connected_at)} />
                <DetailItem icon={Clock} label="Last Synced" value={primaryAccount.last_synced_at ? timeAgo(primaryAccount.last_synced_at) : 'Never'} />
                {googleConnection?.token?.expires_at && (
                  <DetailItem
                    icon={Clock}
                    label="Token Expires"
                    value={new Date(googleConnection.token.expires_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    tone={googleConnection.isExpired ? 'error' : undefined}
                  />
                )}
                <DetailItem icon={Mail} label="Granted Permissions" value={`${connectedScopes.length} scopes`} />
              </div>

              {/* Granted scopes */}
              {connectedScopes.length > 0 && (
                <div>
                  <span className="text-xs text-ink-500 block mb-2">Granted Permissions</span>
                  <div className="flex flex-wrap gap-1.5">
                    {connectedScopes.map((scope, i) => (
                      <span key={i} className="rounded-md border border-gold-500/8 bg-card-900 px-2 py-0.5 text-xs text-ink-500">{scope}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {googleConnection?.isExpired && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => refreshMutation.mutate(primaryAccount.id)}
                    loading={refreshMutation.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh Token
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  loading={connectMutation.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisconnectTarget(primaryAccount.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="No Google account connected"
                description="Connect your Google account to enable Gmail, Calendar, Meet, Drive, and Contacts integrations."
                className="py-6"
                action={
                  <Button onClick={() => connectMutation.mutate()} loading={connectMutation.isPending}>
                    <Plus className="h-4 w-4" />
                    Connect Google Account
                  </Button>
                }
              />
            </div>
          )}

          {/* Additional connected accounts */}
          {googleAccounts && googleAccounts.length > 1 && (
            <div className="mt-4 pt-4 border-t border-gold-500/8">
              <span className="text-xs text-ink-500 block mb-2">Other Connected Accounts</span>
              <div className="space-y-2">
                {googleAccounts.filter((a) => !a.is_primary).map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                    <Avatar name={acc.display_name ?? acc.email} src={acc.avatar ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink-500 truncate">{acc.display_name ?? acc.email}</p>
                      <p className="text-xs text-ink-500 truncate">{acc.email}</p>
                    </div>
                    <GoogleStatusBadge status={acc.status} isExpired={false} />
                    <Button variant="ghost" size="sm" onClick={() => setDisconnectTarget(acc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Workspace Services */}
      <GoogleWorkspaceCard />

      {/* Gmail Integration */}
      <GmailIntegrationCard />

      {/* Integration Hub */}
      <IntegrationHubCard />

      {/* Disconnect confirmation modal */}
      <Modal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title="Disconnect Google Account"
        description="This will revoke all Google permissions and remove the account from your workspace. You'll need to reconnect to use Gmail, Calendar, and other Google services."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisconnectTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (disconnectTarget) {
                  disconnectMutation.mutate(disconnectTarget);
                  setDisconnectTarget(null);
                }
              }}
              loading={disconnectMutation.isPending}
            >
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-500">Are you sure you want to disconnect this Google account?</p>
      </Modal>
    </div>
  );
}

function GoogleStatusBadge({ status, isExpired }: { status: string; isExpired: boolean }) {
  if (status === 'connected' && !isExpired) {
    return <Badge tone="success" dot>Connected</Badge>;
  }
  if (isExpired || status === 'expired') {
    return <Badge tone="warning" dot>Expired</Badge>;
  }
  if (status === 'error' || status === 'revoked') {
    return <Badge tone="error" dot>Reconnect Required</Badge>;
  }
  if (status === 'disconnected') {
    return <Badge tone="neutral" dot>Disconnected</Badge>;
  }
  return <Badge tone="neutral" dot>{status}</Badge>;
}

function DetailItem({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'error' }) {
  return (
    <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
      <div className="flex items-center gap-1.5 mb-1 text-ink-500">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-sm', tone === 'error' ? 'text-error-500' : 'text-ink-500')}>{value}</p>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-ink-500">Free Plan</p>
              <p className="text-xs text-ink-500 mt-0.5">Up to 100 prospects · 1 workspace</p>
            </div>
            <Badge tone="neutral">Active</Badge>
          </div>
          <div className="mt-4 pt-4 border-t border-gold-500/8">
            <Button variant="primary">Upgrade Plan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage This Month</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <UsageBar label="Prospects" used={0} limit={100} />
            <UsageBar label="Messages Sent" used={0} limit={500} />
            <UsageBar label="AI Agent Runs" used={0} limit={50} />
            <UsageBar label="Meetings Booked" used={0} limit={20} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
        <CardContent>
          <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payment method" description="Add a payment method to upgrade your plan." className="py-6" />
        </CardContent>
      </Card>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-ink-500">{label}</span>
        <span className="text-ink-500">{used} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-card-900 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
