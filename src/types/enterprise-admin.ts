export type EnterpriseOrganization = {
  id: string; workspace_id: string; org_name: string; org_slug: string;
  org_type: string; parent_org_id: string | null; status: string;
  contract_type: string | null; contract_start_date: string | null;
  contract_end_date: string | null; seat_count: number;
  created_at: string; updated_at: string;
};
export type EnterpriseDepartment = {
  id: string; workspace_id: string; enterprise_org_id: string | null;
  department_name: string; department_head_id: string | null;
  budget_allocation: number | null; is_active: boolean;
  created_at: string; updated_at: string;
};
export type EnterpriseRegion = {
  id: string; workspace_id: string; enterprise_org_id: string | null;
  region_name: string; region_code: string | null;
  countries: string[]; is_active: boolean;
  created_at: string; updated_at: string;
};
export type EnterpriseBusinessUnit = {
  id: string; workspace_id: string; enterprise_org_id: string | null;
  bu_name: string; bu_code: string | null; is_active: boolean;
  created_at: string; updated_at: string;
};
export type EnterpriseTeam = {
  id: string; workspace_id: string; team_name: string;
  team_description: string | null; team_lead_id: string | null;
  department_id: string | null; is_active: boolean;
  created_at: string; updated_at: string;
};
export type EnterpriseAuditLog = {
  id: string; workspace_id: string; user_id: string | null;
  action: string; resource_type: string | null; resource_id: string | null;
  ip_address: string | null; user_agent: string | null;
  severity: string; metadata: Record<string, unknown> | null;
  created_at: string;
};
export type EnterpriseSSOConfig = {
  id: string; workspace_id: string; enterprise_org_id: string | null;
  sso_type: string; sso_entity_id: string | null;
  sso_login_url: string | null; sso_logout_url: string | null;
  sso_certificate: string | null; sso_metadata_url: string | null;
  scim_endpoint_url: string | null; scim_bearer_token_hash: string | null;
  is_active: boolean; created_at: string; updated_at: string;
};
export type EnterpriseSecurityPolicy = {
  id: string; workspace_id: string; policy_type: string;
  policy_name: string; policy_config: Record<string, unknown>;
  is_enforced: boolean; created_at: string; updated_at: string;
};
export type EnterpriseCompliance = {
  id: string; workspace_id: string; compliance_type: string;
  compliance_status: string; compliance_score: number | null;
  last_audit_date: string | null; next_audit_date: string | null;
  findings: Array<Record<string, unknown>>;
  remediation_plan: Record<string, unknown> | null;
  data_residency_region: string | null;
  retention_policy_days: number | null;
  is_active: boolean; created_at: string; updated_at: string;
};
export type EnterpriseAdminDashboard = {
  organizations: EnterpriseOrganization[]; departments: EnterpriseDepartment[];
  regions: EnterpriseRegion[]; businessUnits: EnterpriseBusinessUnit[];
  teams: EnterpriseTeam[]; auditLogs: EnterpriseAuditLog[];
  ssoConfigs: EnterpriseSSOConfig[]; securityPolicies: EnterpriseSecurityPolicy[];
  compliance: EnterpriseCompliance[];
  totalOrganizations: number; totalDepartments: number;
  totalRegions: number; totalTeams: number;
  totalAuditEvents: number; activeSSOConfigs: number;
  enforcedPolicies: number; complianceScore: number;
};
