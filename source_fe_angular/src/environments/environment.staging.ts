import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  staging: true,
  apiBaseUrl: 'https://api.staging.nexus.vn',
  keycloakUrl: 'https://auth.staging.nexus.vn',
  keycloakRealm: 'nexus',
  keycloakClientId: 'nexus-frontend',
  wsUrl: 'wss://api.staging.nexus.vn/ws',
  sseUrl: 'https://api.staging.nexus.vn/api/v1/events/stream',
  tenantMode: 'subdomain',
  enableDevTools: true,
  logLevel: 'info',
};
