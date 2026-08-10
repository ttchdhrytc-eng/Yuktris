import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthWorkspace, WorkspaceMember, SystemRole } from '@/types/auth';

type WorkspaceContextValue = {
  workspace: AuthWorkspace | null;
  workspaces: AuthWorkspace[];
  members: WorkspaceMember[];
  loading: boolean;
  selectedCompany: string | null;
  setSelectedCompany: (company: string | null) => void;
  refresh: () => Promise<void>;
  setWorkspace: (ws: AuthWorkspace) => void;
  switchWorkspace: (ws: AuthWorkspace) => Promise<void>;
  createWorkspace: (params: {
    name: string;
    website?: string;
    industry?: string;
    country?: string;
    timezone?: string;
  }) => Promise<AuthWorkspace>;
  inviteMember: (params: { email: string; role: SystemRole }) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: SystemRole) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<AuthWorkspace[]>([]);
  const [workspace, setWorkspaceState] = useState<AuthWorkspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(() => {
    return localStorage.getItem('revenueai_selected_company');
  });

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('revenueai_selected_company', selectedCompany);
    } else {
      localStorage.removeItem('revenueai_selected_company');
    }
  }, [selectedCompany]);

  const refresh = async () => {
    if (!user) {
      setWorkspaces([]);
      setWorkspaceState(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const list = await authService.getWorkspaces(user.id);
    setWorkspaces(list);

    const stored = localStorage.getItem('revenueai_workspace_id');
    const found = stored ? list.find((w) => w.id === stored) : null;
    const current = found ?? list[0] ?? null;
    setWorkspaceState(current);

    if (current) {
      localStorage.setItem('revenueai_workspace_id', current.id);
      const m = await authService.getWorkspaceMembers(current.id);
      setMembers(m);
    } else {
      setMembers([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setWorkspace = (ws: AuthWorkspace) => {
    localStorage.setItem('revenueai_workspace_id', ws.id);
    setWorkspaceState(ws);
  };

  const switchWorkspace = async (ws: AuthWorkspace) => {
    if (!user) return;
    setWorkspace(ws);
    await authService.switchWorkspace(user.id, ws.id);
    const m = await authService.getWorkspaceMembers(ws.id);
    setMembers(m);
  };

  const createWorkspace = async (params: {
    name: string;
    website?: string;
    industry?: string;
    country?: string;
    timezone?: string;
  }) => {
    if (!user) throw new Error('No authenticated user');
    const ws = await authService.createWorkspace({ ...params, ownerId: user.id });
    await refresh();
    return ws;
  };

  const inviteMember = async (params: { email: string; role: SystemRole }) => {
    if (!workspace) throw new Error('No active workspace');
    await authService.inviteMember({
      workspaceId: workspace.id,
      email: params.email,
      role: params.role,
    });
    await refresh();
  };

  const removeMember = async (memberId: string) => {
    await authService.removeMember(memberId);
    await refresh();
  };

  const updateMemberRole = async (memberId: string, role: SystemRole) => {
    await authService.updateMemberRole(memberId, role);
    await refresh();
  };

  const completeOnboarding = async () => {
    if (!workspace) return;
    await authService.completeOnboarding(workspace.id);
    await refresh();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces,
        members,
        loading,
        selectedCompany,
        setSelectedCompany,
        refresh,
        setWorkspace,
        switchWorkspace,
        createWorkspace,
        inviteMember,
        removeMember,
        updateMemberRole,
        completeOnboarding,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
