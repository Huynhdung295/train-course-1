// ─── Environments interface — single source of truth ─────────────────────────
export interface Environment {
  production: boolean;
  staging: boolean;
  apiBaseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
  wsUrl: string;
  sseUrl: string;
  tenantMode: 'subdomain' | 'path' | 'header';
  enableDevTools: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
