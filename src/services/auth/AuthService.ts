// ============================================================
// AuthService — Production Authentication Orchestrator
// ============================================================
//
// Wraps Supabase Auth with workspace-aware logic:
//   - Email/password + magic link sign-up and sign-in
//   - Password reset flow
//   - Session refresh and recovery
//   - Profile loading and updating
//   - Workspace creation, switching, and member management
//   - Invitation creation and acceptance
//
// All methods use the Supabase client singleton from @/lib/supabase.

import { supabase } from '@/lib/supabase';
import type {
  SignUpResult,
  SignInResult,
  AcceptInvitationResult,
  UpdateProfileInput,
  Profile,
  AuthWorkspace,
  WorkspaceMember,
  Invitation,
  SystemRole,
  AuthUser,
} from '@/types/auth';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

class AuthService {
  // ============================================================
  // Sign Up — email + password
  // ============================================================

  async signUp(params: { email: string; password: string; fullName: string }): Promise<SignUpResult> {
    const { email, password, fullName } = params;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) throw new Error(this.mapAuthError(error.message));

    const needsEmailVerification = !data.session && !!data.user;

    return {
      user: data.user,
      session: data.session,
      needsEmailVerification,
    };
  }

  // ============================================================
  // Sign In — email + password
  // ============================================================

  async signIn(params: { email: string; password: string }): Promise<SignInResult> {
    const { email, password } = params;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(this.mapAuthError(error.message));

    return { user: data.user, session: data.session };
  }

  // ============================================================
  // Sign In with Magic Link
  // ============================================================

  async signInWithMagicLink(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });

    if (error) throw new Error(this.mapAuthError(error.message));
  }

  // ============================================================
  // Sign Out
  // ============================================================

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(this.mapAuthError(error.message));
  }

  // ============================================================
  // Forgot Password — send reset email
  // ============================================================

  async forgotPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw new Error(this.mapAuthError(error.message));
  }

  // ============================================================
  // Reset Password — update password after receiving token
  // ============================================================

  async resetPassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(this.mapAuthError(error.message));
  }

  // ============================================================
  // Refresh Session
  // ============================================================

  async refreshSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw new Error(this.mapAuthError(error.message));
    return data.session;
  }

  // ============================================================
  // Get Current User — session + profile
  // ============================================================

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;

    const user = session.user;
    const profile = await this.loadProfile(user.id);

    return {
      id: user.id,
      email: user.email ?? '',
      profile,
    };
  }

  // ============================================================
  // Load Profile
  // ============================================================

  async loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data as Profile | null;
  }

  // ============================================================
  // Update Profile
  // ============================================================

  async updateProfile(userId: string, updates: UpdateProfileInput): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return data as Profile;
  }

  // ============================================================
  // Get Workspaces for current user
  // ============================================================

  async getWorkspaces(userId: string): Promise<AuthWorkspace[]> {
    const { data: members, error: mError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (mError) throw new Error(`Failed to load workspaces: ${mError.message}`);
    if (!members || members.length === 0) return [];

    const wsIds = members.map((m) => m.workspace_id);
    const { data: wsData, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .in('id', wsIds)
      .order('created_at', { ascending: true });

    if (wsError) throw new Error(`Failed to load workspaces: ${wsError.message}`);
    return (wsData ?? []) as AuthWorkspace[];
  }

  // ============================================================
  // Get Workspace by ID
  // ============================================================

  async getWorkspace(workspaceId: string): Promise<AuthWorkspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load workspace: ${error.message}`);
    return data as AuthWorkspace | null;
  }

  // ============================================================
  // Create Workspace + add creator as owner
  // ============================================================

  async createWorkspace(params: {
    name: string;
    website?: string;
    industry?: string;
    country?: string;
    timezone?: string;
    ownerId: string;
  }): Promise<AuthWorkspace> {
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: params.name,
        website: params.website || null,
        industry: params.industry || null,
        country: params.country || null,
        timezone: params.timezone || 'America/New_York',
        onboarding_completed: false,
        owner_id: params.ownerId,
      })
      .select('*')
      .single();

    if (wsError || !ws) throw new Error(wsError?.message ?? 'Failed to create workspace.');
    const workspace = ws as AuthWorkspace;

    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: params.ownerId,
      role: 'owner',
      status: 'active',
    });

    if (memberError) throw new Error(memberError.message);

    await supabase
      .from('profiles')
      .update({ workspace_id: workspace.id, role: 'owner' })
      .eq('id', params.ownerId);

    return workspace;
  }

  // ============================================================
  // Switch Workspace — update profile workspace_id
  // ============================================================

  async switchWorkspace(userId: string, workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ workspace_id: workspaceId })
      .eq('id', userId);

    if (error) throw new Error(`Failed to switch workspace: ${error.message}`);
  }

  // ============================================================
  // Get Workspace Members
  // ============================================================

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        *,
        profile:profiles!workspace_members_user_id_profiles_fkey(*)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (error) throw new Error(`Failed to load members: ${error.message}`);
    return (data ?? []) as WorkspaceMember[];
  }

  // ============================================================
  // Invite Member — create invitation record
  // ============================================================

  async inviteMember(params: {
    workspaceId: string;
    email: string;
    role: SystemRole;
  }): Promise<Invitation> {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: params.workspaceId,
        email: params.email,
        role: params.role,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create invitation: ${error.message}`);
    return data as Invitation;
  }

  // ============================================================
  // Get Invitation by Token
  // ============================================================

  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        workspace:workspaces!invitations_workspace_id_fkey(*)
      `)
      .eq('token', token)
      .maybeSingle();

    if (error) throw new Error(`Failed to load invitation: ${error.message}`);
    return data as Invitation | null;
  }

  // ============================================================
  // Accept Invitation — link user to workspace
  // ============================================================

  async acceptInvitation(params: { token: string; userId: string; email: string }): Promise<AcceptInvitationResult> {
    const invitation = await this.getInvitationByToken(params.token);
    if (!invitation) throw new Error('Invitation not found.');
    if (invitation.accepted_at) throw new Error('This invitation has already been accepted.');
    if (new Date(invitation.expires_at) < new Date()) throw new Error('This invitation has expired.');

    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: invitation.workspace_id,
      user_id: params.userId,
      role: invitation.role,
      status: 'active',
    });

    if (memberError) {
      if (memberError.message.includes('duplicate')) {
        throw new Error('You are already a member of this workspace.');
      }
      throw new Error(memberError.message);
    }

    const { error: updateError } = await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) throw new Error(updateError.message);

    await supabase
      .from('profiles')
      .update({ workspace_id: invitation.workspace_id, role: invitation.role })
      .eq('id', params.userId);

    return { accepted: true, workspace_id: invitation.workspace_id };
  }

  // ============================================================
  // Remove Member
  // ============================================================

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .update({ status: 'removed' })
      .eq('id', memberId);

    if (error) throw new Error(`Failed to remove member: ${error.message}`);
  }

  // ============================================================
  // Update Member Role
  // ============================================================

  async updateMemberRole(memberId: string, role: SystemRole): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId);

    if (error) throw new Error(`Failed to update role: ${error.message}`);
  }

  // ============================================================
  // Complete Onboarding
  // ============================================================

  async completeOnboarding(workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('workspaces')
      .update({ onboarding_completed: true })
      .eq('id', workspaceId);

    if (error) throw new Error(`Failed to complete onboarding: ${error.message}`);
  }

  // ============================================================
  // Resend Email Verification
  // ============================================================

  async resendVerification(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) throw new Error(this.mapAuthError(error.message));
  }

  // ============================================================
  // Get Current Session
  // ============================================================

  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  // ============================================================
  // Get Raw Supabase User
  // ============================================================

  async getRawUser(): Promise<SupabaseUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  // ============================================================
  // Error Mapping
  // ============================================================

  private mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Invalid email or password.';
    if (lower.includes('email not confirmed')) return 'Please verify your email before signing in.';
    if (lower.includes('user already registered')) return 'An account with this email already exists.';
    if (lower.includes('password should be at least')) return 'Password must be at least 6 characters.';
    if (lower.includes('rate limit')) return 'Too many attempts. Please try again in a moment.';
    if (lower.includes('session not found') || lower.includes('session expired')) return 'Your session has expired. Please sign in again.';
    return message;
  }
}

export const authService = new AuthService();
