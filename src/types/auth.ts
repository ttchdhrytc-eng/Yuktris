// ============================================================
// Authentication — Type Definitions
// ============================================================

import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================
// Roles & Permissions
// ============================================================

export type SystemRole = 'owner' | 'admin' | 'manager' | 'sales_rep' | 'viewer';

export type Permission =
  | 'workspace.view'
  | 'workspace.manage'
  | 'workspace.delete'
  | 'members.invite'
  | 'members.remove'
  | 'members.manage_roles'
  | 'agents.view'
  | 'agents.manage'
  | 'campaigns.view'
  | 'campaigns.manage'
  | 'prospects.view'
  | 'prospects.manage'
  | 'meetings.view'
  | 'meetings.manage'
  | 'analytics.view'
  | 'crm.view'
  | 'crm.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'billing.view'
  | 'billing.manage';

export type PermissionCheck = (permission: Permission) => boolean;

// ============================================================
// Entity Types
// ============================================================

export type ProfileStatus = 'active' | 'invited' | 'suspended' | 'deleted';

export type Profile = {
  id: string;
  workspace_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
  email: string;
  phone: string | null;
  timezone: string;
  role: SystemRole;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

export type WorkspacePlan = 'free' | 'starter' | 'growth' | 'enterprise';
export type WorkspaceStatus = 'active' | 'suspended' | 'deleted';

export type AuthWorkspace = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: WorkspacePlan;
  status: WorkspaceStatus;
  website: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  onboarding_completed: boolean;
  onboarding_welcome_completed?: boolean;
  onboarding_stage?: 'linkedin' | 'business_input' | 'business_research' | 'business_ready' | 'icp_generating' | 'icp_ready' | 'ai_review' | 'setup_ready' | 'completed';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: SystemRole;
  status: WorkspaceMemberStatus;
  joined_at: string;
  created_at: string;
  profile?: Profile | null;
};

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: SystemRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  workspace?: AuthWorkspace | null;
};

// ============================================================
// Auth User (composite — session user + profile)
// ============================================================

export type AuthUser = {
  id: string;
  email: string;
  profile: Profile | null;
};

// ============================================================
// Service Result Types
// ============================================================

export type SignUpResult = {
  user: SupabaseUser | null;
  session: Session | null;
  needsEmailVerification: boolean;
};

export type SignInResult = {
  user: SupabaseUser | null;
  session: Session | null;
};

export type AcceptInvitationResult = {
  accepted: boolean;
  workspace_id: string;
};

export type UpdateProfileInput = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone?: string;
  avatar?: string;
};

// ============================================================
// Role Permission Matrix
// ============================================================

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  owner: [
    'workspace.view', 'workspace.manage', 'workspace.delete',
    'members.invite', 'members.remove', 'members.manage_roles',
    'agents.view', 'agents.manage',
    'campaigns.view', 'campaigns.manage',
    'prospects.view', 'prospects.manage',
    'meetings.view', 'meetings.manage',
    'analytics.view',
    'crm.view', 'crm.manage',
    'settings.view', 'settings.manage',
    'billing.view', 'billing.manage',
  ],
  admin: [
    'workspace.view', 'workspace.manage',
    'members.invite', 'members.remove', 'members.manage_roles',
    'agents.view', 'agents.manage',
    'campaigns.view', 'campaigns.manage',
    'prospects.view', 'prospects.manage',
    'meetings.view', 'meetings.manage',
    'analytics.view',
    'crm.view', 'crm.manage',
    'settings.view', 'settings.manage',
    'billing.view', 'billing.manage',
  ],
  manager: [
    'workspace.view',
    'members.invite',
    'agents.view', 'agents.manage',
    'campaigns.view', 'campaigns.manage',
    'prospects.view', 'prospects.manage',
    'meetings.view', 'meetings.manage',
    'analytics.view',
    'crm.view', 'crm.manage',
    'settings.view',
    'billing.view',
  ],
  sales_rep: [
    'workspace.view',
    'agents.view',
    'campaigns.view',
    'prospects.view', 'prospects.manage',
    'meetings.view', 'meetings.manage',
    'analytics.view',
    'crm.view',
    'settings.view',
  ],
  viewer: [
    'workspace.view',
    'agents.view',
    'campaigns.view',
    'prospects.view',
    'meetings.view',
    'analytics.view',
    'crm.view',
    'settings.view',
  ],
};

export function hasPermission(role: SystemRole | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRoleRank(role: SystemRole): number {
  const ranks: Record<SystemRole, number> = { owner: 5, admin: 4, manager: 3, sales_rep: 2, viewer: 1 };
  return ranks[role] ?? 0;
}

export function canManageRole(managerRole: SystemRole, targetRole: SystemRole): boolean {
  return getRoleRank(managerRole) > getRoleRank(targetRole);
}
