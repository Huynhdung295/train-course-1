import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  staging: false,
  apiBaseUrl: 'https://api.nexus.vn',
  keycloakUrl: 'https://auth.nexus.vn',
  keycloakRealm: 'nexus',
  keycloakClientId: 'nexus-frontend',
  wsUrl: 'wss://api.nexus.vn/ws',
  sseUrl: 'https://api.nexus.vn/api/v1/events/stream',
  tenantMode: 'subdomain',
  enableDevTools: false,
  logLevel: 'error',
};
