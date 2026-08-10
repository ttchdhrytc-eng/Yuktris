import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { EnterpriseAdminDashboard } from '@/types/enterprise-admin';

export const enterpriseAdminKeys = {
  all: ['enterprise-admin'] as const,
  dashboard: (wsId: string) => ['enterprise-admin', 'dashboard', wsId] as const,
};

export function useEnterpriseAdminDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: enterpriseAdminKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [orgs, depts, regions, bus, teams, audit, sso, policies, compliance] = await Promise.all([
        supabase.from('enterprise_organizations').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_departments').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_regions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_business_units').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_teams').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_audit_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('enterprise_sso_configs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_security_policies').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('enterprise_compliance').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      ]);
      const allCompliance = (compliance.data ?? []) as Array<Record<string, unknown>>;
      const avgComplianceScore = allCompliance.length > 0 ? allCompliance.reduce((s, c) => s + (c.compliance_score as number ?? 0), 0) / allCompliance.length : 0;
      return {
        organizations: (orgs.data ?? []) as never[], departments: (depts.data ?? []) as never[],
        regions: (regions.data ?? []) as never[], businessUnits: (bus.data ?? []) as never[],
        teams: (teams.data ?? []) as never[], auditLogs: (audit.data ?? []) as never[],
        ssoConfigs: (sso.data ?? []) as never[], securityPolicies: (policies.data ?? []) as never[],
        compliance: allCompliance as never[],
        totalOrganizations: (orgs.data ?? []).length, totalDepartments: (depts.data ?? []).length,
        totalRegions: (regions.data ?? []).length, totalTeams: (teams.data ?? []).length,
        totalAuditEvents: (audit.data ?? []).length,
        activeSSOConfigs: (sso.data ?? []).filter((s) => (s as Record<string, unknown>).is_active).length,
        enforcedPolicies: (policies.data ?? []).filter((p) => (p as Record<string, unknown>).is_enforced).length,
        complianceScore: avgComplianceScore,
      } as EnterpriseAdminDashboard;
    },
    refetchInterval: 20000,
  });
}

export function useCreateEnterpriseOrg() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; contractType?: string; seatCount?: number }) => {
      if (!workspace) throw new Error('No workspace');
      const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data, error } = await supabase.from('enterprise_organizations').insert({ workspace_id: workspace.id, org_name: params.name, org_slug: slug, org_type: 'enterprise', status: 'active', contract_type: params.contractType ?? 'annual', seat_count: params.seatCount ?? 10 }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I created the enterprise organization.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateDepartment() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; orgId?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('enterprise_departments').insert({ workspace_id: workspace.id, enterprise_org_id: params.orgId ?? null, department_name: params.name, is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I created the department.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateTeam() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; description?: string; departmentId?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('enterprise_teams').insert({ workspace_id: workspace.id, team_name: params.name, team_description: params.description ?? null, department_id: params.departmentId ?? null, is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I created the team.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConfigureSSO() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { orgId?: string; ssoType?: string; entityId?: string; loginUrl?: string; certificate?: string; metadataUrl?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('enterprise_sso_configs').insert({ workspace_id: workspace.id, enterprise_org_id: params.orgId ?? null, sso_type: params.ssoType ?? 'saml', sso_entity_id: params.entityId ?? null, sso_login_url: params.loginUrl ?? null, sso_certificate: params.certificate ?? null, sso_metadata_url: params.metadataUrl ?? null, is_active: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I configured SSO/SAML.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateSecurityPolicy() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { policyType: string; policyName: string; config?: Record<string, unknown> }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('enterprise_security_policies').insert({ workspace_id: workspace.id, policy_type: params.policyType, policy_name: params.policyName, policy_config: params.config ?? {}, is_enforced: true }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I created the security policy.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCompliance() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { complianceType: string; status?: string; score?: number; dataResidency?: string; retentionDays?: number }) => {
      if (!workspace) throw new Error('No workspace');
      const { data: existing } = await supabase.from('enterprise_compliance').select('id').eq('workspace_id', workspace.id).eq('compliance_type', params.complianceType).maybeSingle();
      const updateData: Record<string, unknown> = { workspace_id: workspace.id, compliance_type: params.complianceType, compliance_status: params.status ?? 'in_progress', is_active: true };
      if (params.score !== undefined) updateData.compliance_score = params.score;
      if (params.dataResidency !== undefined) updateData.data_residency_region = params.dataResidency;
      if (params.retentionDays !== undefined) updateData.retention_policy_days = params.retentionDays;
      if (existing) { const { error } = await supabase.from('enterprise_compliance').update(updateData).eq('id', (existing as Record<string, string>).id); if (error) throw new Error(error.message); }
      else { const { error } = await supabase.from('enterprise_compliance').insert(updateData); if (error) throw new Error(error.message); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: enterpriseAdminKeys.all }); toast.success('I updated the compliance status.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
