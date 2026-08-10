import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Brain,
  Globe,
  Target,
  Search,
  TrendingUp,
  Sparkles,
  Linkedin,
  MessageSquare,
  Calendar,
  GraduationCap,
  Settings as SettingsIcon,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea, Label } from '@/components/ui/Field';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { timeAgo, cn } from '@/lib/utils';
import type { AIAgent, AIAgentStatus } from '@/types';

type AgentDef = {
  type: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const AGENT_DEFS: AgentDef[] = [
  {
    type: 'business_intelligence',
    name: 'Business Intelligence Agent',
    description: 'Analyzes your company data and market position to identify revenue opportunities and strategic gaps.',
    icon: Brain,
  },
  {
    type: 'market_intelligence',
    name: 'Market Intelligence Agent',
    description: 'Monitors market trends, competitor movements, and industry signals to inform your outreach strategy.',
    icon: Globe,
  },
  {
    type: 'icp',
    name: 'ICP Agent',
    description: 'Defines and refines your Ideal Customer Profile based on historical wins and firmographic data.',
    icon: Target,
  },
  {
    type: 'research',
    name: 'Research Agent',
    description: 'Deep-researches target companies and prospects to gather context for personalized outreach.',
    icon: Search,
  },
  {
    type: 'buying_intent',
    name: 'Buying Intent Agent',
    description: 'Detects buying signals from prospects to prioritize outreach when intent is highest.',
    icon: TrendingUp,
  },
  {
    type: 'personalization',
    name: 'Personalization Agent',
    description: 'Crafts highly personalized messages using prospect research and your value proposition.',
    icon: Sparkles,
  },
  {
    type: 'linkedin',
    name: 'LinkedIn Agent',
    description: 'Manages LinkedIn connection requests, messages, and follow-ups at scale within safety limits.',
    icon: Linkedin,
  },
  {
    type: 'conversation',
    name: 'Conversation Agent',
    description: 'Handles prospect replies with context-aware responses to nurture conversations toward meetings.',
    icon: MessageSquare,
  },
  {
    type: 'meeting',
    name: 'Meeting Agent',
    description: 'Coordinates scheduling by checking calendar availability and proposing optimal meeting times.',
    icon: Calendar,
  },
  {
    type: 'learning',
    name: 'Learning Agent',
    description: 'Continuously learns from campaign performance to improve messaging and targeting over time.',
    icon: GraduationCap,
  },
];

const statusTone: Record<AIAgentStatus, 'success' | 'neutral' | 'brand' | 'error'> = {
  active: 'success',
  inactive: 'neutral',
  running: 'brand',
  error: 'error',
};

export function AIAgentsPage() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [configAgent, setConfigAgent] = useState<AIAgent | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['ai-agents', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('workspace_id', workspace.id);
      return (data ?? []) as AIAgent[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      agentType: string;
      name: string;
      description: string;
      status: AIAgentStatus;
      config?: Record<string, unknown>;
    }) => {
      if (!workspace) throw new Error('No workspace');
      const existing = agents?.find((a) => a.agent_type === params.agentType);
      if (existing) {
        const { error } = await supabase
          .from('ai_agents')
          .update({ status: params.status, config: params.config ?? existing.config })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_agents').insert({
          workspace_id: workspace.id,
          agent_type: params.agentType,
          name: params.name,
          description: params.description,
          status: params.status,
          config: params.config ?? {},
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleAgent = (def: AgentDef, current?: AIAgent) => {
    const newStatus: AIAgentStatus = current?.status === 'active' ? 'inactive' : 'active';
    upsertMutation.mutate(
      { agentType: def.type, name: def.name, description: def.description, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`${def.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="AI Agents" description="Configure your autonomous revenue agents." />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="Configure your autonomous revenue agents. Each agent handles a specific stage of your outreach pipeline."
        actions={<Badge tone="brand">{agents?.filter((a) => a.status === 'active').length ?? 0} active</Badge>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AGENT_DEFS.map((def) => {
          const agent = agents?.find((a) => a.agent_type === def.type);
          const isActive = agent?.status === 'active';
          return (
            <Card key={def.type} className={cn('flex flex-col transition-all', isActive && 'border-brand-500/30')}>
              <CardContent className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border',
                    isActive
                      ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border-brand-500/20 text-brand-400'
                      : 'bg-card-900 border-gold-500/12 text-ink-500'
                  )}>
                    <def.icon className="h-5 w-5" />
                  </div>
                  <Badge tone={agent ? statusTone[agent.status] : 'neutral'} dot>
                    {agent ? agent.status : 'inactive'}
                  </Badge>
                </div>

                <h3 className="text-sm font-semibold text-ink-500">{def.name}</h3>
                <p className="text-xs text-ink-500 mt-1 leading-relaxed">{def.description}</p>

                <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-500">
                  <Clock className="h-3 w-3" />
                  <span>Last run: {agent?.last_run_at ? timeAgo(agent.last_run_at) : 'Never'}</span>
                </div>
              </CardContent>

              <div className="px-5 py-3 border-t border-gold-500/8 flex items-center gap-2">
                <Button
                  variant={isActive ? 'secondary' : 'primary'}
                  size="sm"
                  className="flex-1"
                  loading={upsertMutation.isPending}
                  onClick={() => toggleAgent(def, agent)}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!agent) {
                      upsertMutation.mutate(
                        { agentType: def.type, name: def.name, description: def.description, status: 'inactive' },
                        {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: ['ai-agents'] }).then(() => {
                              const created = queryClient.getQueryData<AIAgent[]>(['ai-agents', workspace?.id]);
                              setConfigAgent(created?.find((a) => a.agent_type === def.type) ?? null);
                            });
                          },
                        }
                      );
                    } else {
                      setConfigAgent(agent);
                    }
                  }}
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                  Configure
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfigModal
        agent={configAgent}
        onClose={() => setConfigAgent(null)}
        onSave={async (config) => {
          if (!configAgent || !workspace) return;
          const { error } = await supabase
            .from('ai_agents')
            .update({ config })
            .eq('id', configAgent.id);
          if (error) {
            toast.error(error.message);
          } else {
            toast.success('Agent configuration saved.');
            queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
            setConfigAgent(null);
          }
        }}
      />
    </div>
  );
}

function ConfigModal({
  agent,
  onClose,
  onSave,
}: {
  agent: AIAgent | null;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [configText, setConfigText] = useState('');

  if (agent) {
    const currentText = configText || JSON.stringify(agent.config ?? {}, null, 2);
    return (
      <Modal
        open={!!agent}
        onClose={onClose}
        title={`Configure ${agent.name}`}
        description="Edit the agent's configuration in JSON format."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => {
              try {
                const parsed = JSON.parse(currentText);
                onSave(parsed);
              } catch {
                toast.error('Invalid JSON configuration.');
              }
            }}>Save</Button>
          </>
        }
      >
        <div>
          <Label>Configuration (JSON)</Label>
          <Textarea
            value={currentText}
            onChange={(e) => setConfigText(e.target.value)}
            className="min-h-[240px] font-mono text-xs"
            placeholder='{}'
          />
        </div>
      </Modal>
    );
  }

  return null;
}
