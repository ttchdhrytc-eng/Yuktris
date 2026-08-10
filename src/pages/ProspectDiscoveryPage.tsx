import { useState } from 'react';
import {
  Radar, Building2, Users, Brain, Activity, Radio, Target, Layers, Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useDiscoveryDashboard, useDiscoveryCompanies, useDiscoveryContacts,
  useDiscoveryJobs, useDiscoveryProviders, useDiscoveryLists,
  useRunDiscovery, useCreateProspectList,
} from '@/hooks/useProspectDiscoveryEngine';
import {
  DiscoveryDashboardSection, CompaniesSection, DecisionMakersSection,
  DiscoveryJobsSection, ProviderStatusSection, SavedListsSection,
  SmartFiltersSection, LiveDiscoveryFeedSection, RecommendationsSection,
  DiscoveryEmpty,
} from '@/components/prospect-discovery-engine';
import type { SmartFilters } from '@/types/prospect-discovery-engine';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Radar },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'contacts', label: 'Decision Makers', icon: Users },
  { id: 'recommendations', label: 'Recommendations', icon: Brain },
  { id: 'jobs', label: 'Discovery Jobs', icon: Activity },
  { id: 'providers', label: 'Provider Status', icon: Radio },
  { id: 'lists', label: 'Saved Lists', icon: Target },
  { id: 'feed', label: 'Live Feed', icon: Zap },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ProspectDiscoveryPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useDiscoveryDashboard();
  const { data: providers } = useDiscoveryProviders();
  const { data: jobs } = useDiscoveryJobs();
  const { data: lists } = useDiscoveryLists();
  const runDiscovery = useRunDiscovery();
  const createList = useCreateProspectList();

  const [tab, setTab] = useState<TabId>('dashboard');
  const [filters, setFilters] = useState<SmartFilters>({});

  const { data: companies } = useDiscoveryCompanies(filters);
  const { data: contacts } = useDiscoveryContacts(filters);

  if (dashboardLoading) {
    return (
      <div>
        <PageHeader title="Prospect Discovery" description="AI-powered multi-provider prospect discovery engine." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || (dashboard.totalCompanies === 0 && dashboard.recentJobs.length === 0)) {
    return (
      <div>
        <PageHeader title="Prospect Discovery" description="AI-powered multi-provider prospect discovery engine." />
        <Card className="p-6">
          <DiscoveryEmpty onRun={() => runDiscovery.mutate()} isRunning={runDiscovery.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Prospect Discovery"
        description="AI-powered multi-provider prospect discovery engine."
        actions={
          <Button variant="glow" size="sm" onClick={() => runDiscovery.mutate()} loading={runDiscovery.isPending}>
            <Radar className="h-3.5 w-3.5" />
            Run Discovery
          </Button>
        }
      />

      {/* Status banner */}
      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Activity className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalCompanies}</span> companies discovered
            {' · '}<span className="font-semibold text-ink-500">{dashboard.totalContacts}</span> decision makers
            {' · '}<span className="font-semibold text-ink-500">{dashboard.totalQualified}</span> qualified
            {' · '}Avg score: <span className="font-semibold text-ink-500">{dashboard.avgScore}</span>
          </p>
        </div>
        {dashboard.activeJobs > 0 && <Badge tone="brand" dot>{dashboard.activeJobs} active</Badge>}
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                  tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500',
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'dashboard' && (
            <DiscoveryDashboardSection
              dashboard={dashboard}
              onRunDiscovery={() => runDiscovery.mutate()}
              isRunning={runDiscovery.isPending}
            />
          )}
          {tab === 'companies' && (
            <div className="space-y-4">
              <SmartFiltersSection filters={filters} onChange={setFilters} />
              <CompaniesSection companies={companies ?? []} />
            </div>
          )}
          {tab === 'contacts' && (
            <div className="space-y-4">
              <SmartFiltersSection filters={filters} onChange={setFilters} />
              <DecisionMakersSection contacts={contacts ?? []} />
            </div>
          )}
          {tab === 'recommendations' && <RecommendationsSection companies={companies ?? []} />}
          {tab === 'jobs' && <DiscoveryJobsSection jobs={jobs ?? []} />}
          {tab === 'providers' && <ProviderStatusSection providers={providers ?? []} />}
          {tab === 'lists' && (
            <SavedListsSection
              lists={lists ?? []}
              onCreateList={(name, desc) => createList.mutate({ name, description: desc })}
            />
          )}
          {tab === 'feed' && <LiveDiscoveryFeedSection jobs={jobs ?? []} />}
        </div>
      </Card>
    </div>
  );
}

import { Badge } from '@/components/ui/Badge';
