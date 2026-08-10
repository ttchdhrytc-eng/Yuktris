export type WhiteLabelSettings = {
  id: string; workspace_id: string; is_white_labeled: boolean;
  platform_name: string; platform_tagline: string | null;
  custom_ai_name: string | null; custom_ceo_name: string | null;
  custom_agent_prefix: string | null;
  custom_terminology: Record<string, string>;
  custom_navigation: Array<Record<string, unknown>>;
  custom_theme: Record<string, unknown>;
  custom_footer: string | null; custom_header: string | null;
  login_page_config: Record<string, unknown>;
  email_template_config: Record<string, unknown>;
  notification_template_config: Record<string, unknown>;
  report_template_config: Record<string, unknown>;
  dashboard_config: Record<string, unknown>;
  is_active: boolean; created_at: string; updated_at: string;
};
export type CustomDomain = {
  id: string; workspace_id: string; domain: string;
  domain_type: string; ssl_status: string;
  dns_verified: boolean; dns_records: Array<Record<string, unknown>>;
  is_primary: boolean; is_active: boolean;
  created_at: string; updated_at: string;
};
export type BrandingAsset = {
  id: string; workspace_id: string; asset_type: string;
  asset_name: string; asset_url: string | null;
  asset_data: Record<string, unknown> | null;
  is_active: boolean; created_at: string; updated_at: string;
};
export type WhiteLabelDashboard = {
  settings: WhiteLabelSettings | null; domains: CustomDomain[];
  assets: BrandingAsset[];
  isWhiteLabeled: boolean; primaryDomain: string | null;
  totalDomains: number; totalAssets: number;
};
