// =============================================================================
// Tenant Domain Models
// =============================================================================

export interface TenantConfig {
  tenantId: string;
  code: string;
  companyName: string;
  logo: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  plan: TenantPlan;
  timezone: string;
  locale: string;         // vi, en
  currency: string;       // VND, USD
  features: TenantFeature[];
}

export type TenantPlan = 'basic' | 'professional' | 'enterprise' | 'custom';

export type TenantFeature =
  | 'POS'
  | 'INVENTORY'
  | 'ANALYTICS'
  | 'MULTI_WAREHOUSE'
  | 'API_ACCESS'
  | 'WHITE_LABEL';

export function isFeatureEnabled(config: TenantConfig, feature: TenantFeature): boolean {
  return config.features.includes(feature);
}
