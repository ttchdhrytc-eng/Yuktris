// ============================================================
// Auth Hooks — React Query + Context Bridge
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import type { Profile, Permission, SystemRole, UpdateProfileInput } from '@/types/auth';

// ============================================================
// Query Keys
// ============================================================

export const authKeys = {
  all: ['auth'] as const,
  profile: (userId: string) => [...authKeys.all, 'profile', userId] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

// ============================================================
// useCurrentUser — current auth user from context
// ============================================================

export function useCurrentUser() {
  const { user, profile, loading } = useAuth();
  return { user, profile, loading };
}

// ============================================================
// useSession — current session from context
// ============================================================

export function useSession() {
  const { session, loading } = useAuth();
  return { session, loading };
}

// ============================================================
// usePermissions — permission checker from context
// ============================================================

export function usePermissions() {
  const { hasPermission, role } = useAuth();

  const can = (permission: Permission): boolean => hasPermission(permission);
  const canAny = (permissions: Permission[]): boolean => permissions.some((p) => hasPermission(p));
  const canAll = (permissions: Permission[]): boolean => permissions.every((p) => hasPermission(p));
  const isAtLeast = (minRole: SystemRole): boolean => {
    const ranks: Record<SystemRole, number> = { owner: 5, admin: 4, manager: 3, sales_rep: 2, viewer: 1 };
    return (ranks[role ?? 'viewer'] ?? 0) >= (ranks[minRole] ?? 0);
  };

  return { can, canAny, canAll, isAtLeast, role };
}

// ============================================================
// useUpdateProfile — mutation to update user profile
// ============================================================

export function useUpdateProfile() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateProfileInput): Promise<Profile> => {
      if (!user) throw new Error('No authenticated user');
      return authService.updateProfile(user.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
      refreshUser();
      toast.success('Profile updated successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update profile.');
    },
  });
}

// ============================================================
// useInviteMember — invite a member to current workspace
// ============================================================

export function useInviteMember() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; role: SystemRole }): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      await authService.inviteMember({
        workspaceId: workspace.id,
        email: params.email,
        role: params.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Invitation sent successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to send invitation.');
    },
  });
}

// ============================================================
// useAcceptInvitation — accept a workspace invitation
// ============================================================

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { token: string; userId: string; email: string }) => {
      return authService.acceptInvitation(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
      toast.success('Invitation accepted. Welcome to the workspace!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to accept invitation.');
    },
  });
}

// ============================================================
// useRemoveMember — remove a workspace member
// ============================================================

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      await authService.removeMember(memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Member removed.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove member.');
    },
  });
}

// ============================================================
// useUpdateMemberRole — update a member's role
// ============================================================

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { memberId: string; role: SystemRole }): Promise<void> => {
      await authService.updateMemberRole(params.memberId, params.role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Member role updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update role.');
    },
  });
}

// ============================================================
// useWorkspaceMembers — load members for current workspace
// ============================================================

export function useWorkspaceMembers() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-members', workspace?.id ?? ''],
    enabled: !!workspace?.id,
    queryFn: async (): Promise<WorkspaceMember[]> => {
      if (!workspace) return [];
      return authService.getWorkspaceMembers(workspace.id);
    },
  });
}

// ============================================================
// useInvitations — load pending invitations for current workspace
// ============================================================

export function useInvitations() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-invitations', workspace?.id ?? ''],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('workspace_id', workspace.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

// Re-export context hooks for convenience
export { useAuth } from '@/contexts/AuthContext';
export { useWorkspace } from '@/contexts/WorkspaceContext';
