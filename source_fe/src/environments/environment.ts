import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  staging: false,
  apiBaseUrl: 'http://localhost:8080',
  keycloakUrl: 'http://localhost:8180',
  keycloakRealm: 'nexus',
  keycloakClientId: 'nexus-frontend',
  wsUrl: 'ws://localhost:8080/ws',
  sseUrl: 'http://localhost:8080/api/v1/events/stream',
  tenantMode: 'subdomain',
  enableDevTools: true,
  logLevel: 'debug',
};
