// =============================================================================
// Auth Domain Models — Matches BE Spring Security + Keycloak contracts
// =============================================================================

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;        // seconds
  mfaRequired: boolean;
  tenantId: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roles: string[];
  permissions: Permission[];
  tenantId: string;
}

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
  conditions?: Record<string, unknown>;
}

export type PermissionResource =
  | 'ORDER'
  | 'PRODUCT'
  | 'USER'
  | 'INVENTORY'
  | 'REPORT'
  | 'SETTINGS'
  | 'TENANT';

export type PermissionAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT';

export interface MfaVerifyRequest {
  email: string;
  otp: string;
  tenantId: string;
}

export interface MfaSetupResponse {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
  tenantId: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// ─── Permission helper ─────────────────────────────────────────────────────────
export function hasPermission(
  permissions: Permission[],
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  return permissions.some((p) => p.resource === resource && p.action === action);
}

export function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}
