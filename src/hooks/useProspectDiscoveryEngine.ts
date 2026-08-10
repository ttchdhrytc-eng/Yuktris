import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { prospectDiscoveryService } from '@/services/prospect-discovery-engine';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { SmartFilters } from '@/types/prospect-discovery-engine';

export const discoveryKeys = {
  all: ['prospect-discovery'] as const,
  dashboard: (wsId: string) => ['prospect-discovery', 'dashboard', wsId] as const,
  companies: (wsId: string, filters?: SmartFilters) => ['prospect-discovery', 'companies', wsId, filters ?? {}] as const,
  contacts: (wsId: string, filters?: SmartFilters) => ['prospect-discovery', 'contacts', wsId, filters ?? {}] as const,
  jobs: (wsId: string) => ['prospect-discovery', 'jobs', wsId] as const,
  providers: (wsId: string) => ['prospect-discovery', 'providers', wsId] as const,
  syncLogs: (wsId: string) => ['prospect-discovery', 'sync-logs', wsId] as const,
  lists: (wsId: string) => ['prospect-discovery', 'lists', wsId] as const,
};

export function useDiscoveryDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return prospectDiscoveryService.loadDashboard(workspace.id);
    },
    refetchInterval: 5000,
  });
}

export function useDiscoveryCompanies(filters?: SmartFilters) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.companies(workspace?.id ?? '', filters),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadCompanies(workspace.id, filters);
    },
  });
}

export function useDiscoveryContacts(filters?: SmartFilters) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.contacts(workspace?.id ?? '', filters),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadContacts(workspace.id, filters);
    },
  });
}

export function useDiscoveryJobs() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.jobs(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadJobs(workspace.id);
    },
    refetchInterval: 5000,
  });
}

export function useDiscoveryProviders() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.providers(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadProviders(workspace.id);
    },
  });
}

export function useDiscoverySyncLogs() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.syncLogs(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadSyncLogs(workspace.id);
    },
  });
}

export function useDiscoveryLists() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: discoveryKeys.lists(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return prospectDiscoveryService.loadProspectLists(workspace.id);
    },
  });
}

export function useRunDiscovery() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId?: string) => {
      if (!workspace) throw new Error('No workspace');
      return prospectDiscoveryService.runDiscovery(workspace.id, strategyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discoveryKeys.all });
      toast.success('Discovery pipeline started.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to start discovery.'),
  });
}

export function useCreateProspectList() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!workspace) throw new Error('No workspace');
      return prospectDiscoveryService.createProspectList(workspace.id, name, description);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discoveryKeys.all });
      toast.success('Prospect list created.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddToProspectList() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async ({ listId, companyId, contactId }: { listId: string; companyId?: string; contactId?: string }) => {
      if (!workspace) throw new Error('No workspace');
      return prospectDiscoveryService.addToProspectList(workspace.id, listId, companyId, contactId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discoveryKeys.all });
      toast.success('Added to prospect list.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
