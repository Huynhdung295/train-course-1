// ═══════════════════════════════════════════════════════════════
// @nexus/auth – Auth State Management & Guards
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useMemo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  User,
  AuthTokens,
  PermissionResource,
  PermissionAction,
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
} from '@nexus/types';
import { apiClient } from '@nexus/api-client';

// ── Auth Store (Zustand Singleton) ────────────────────────────

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, tokens: AuthTokens, tenantId: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  refreshTokens: () => Promise<boolean>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        tokens: null,
        tenantId: null,
        isAuthenticated: false,
        isLoading: true,

        setAuth: (user, tokens, tenantId) => {
          apiClient.setAuthToken(tokens.accessToken);
          apiClient.setTenantId(tenantId);
          set({
            user,
            tokens,
            tenantId,
            isAuthenticated: true,
            isLoading: false,
          });
        },

        clearAuth: () => {
          apiClient.clearAuthToken();
          apiClient.clearTenantId();
          set({
            user: null,
            tokens: null,
            tenantId: null,
            isAuthenticated: false,
            isLoading: false,
          });
        },

        updateUser: (partial) => {
          const current = get().user;
          if (current) {
            set({ user: { ...current, ...partial } });
          }
        },

        refreshTokens: async () => {
          const { tokens, clearAuth } = get();
          if (!tokens?.refreshToken) {
            clearAuth();
            return false;
          }
          try {
            const newTokens = await apiClient.post<AuthTokens>(
              '/api/v1/auth/refresh',
              { refreshToken: tokens.refreshToken },
            );
            apiClient.setAuthToken(newTokens.accessToken);
            set({ tokens: newTokens });
            return true;
          } catch {
            clearAuth();
            return false;
          }
        },

        setLoading: (loading) => set({ isLoading: loading }),
      }),
      {
        name: 'nexus-auth',
        skipHydration: true,
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          tenantId: state.tenantId,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
);

// ── Auth Hydration Hook ───────────────────────────────────────

export const useAuthHydration = () => {
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    const { tokens, tenantId, setLoading } = useAuthStore.getState();
    if (tokens?.accessToken) {
      apiClient.setAuthToken(tokens.accessToken);
    }
    if (tenantId) {
      apiClient.setTenantId(tenantId);
    }
    setLoading(false);
  }, []);
};

// ── Token Refresh Listener ────────────────────────────────────

export const useTokenRefreshListener = () => {
  useEffect(() => {
    const handler = async () => {
      const success = await useAuthStore.getState().refreshTokens();
      if (!success && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('nexus:token-expired', handler);
    return () => window.removeEventListener('nexus:token-expired', handler);
  }, []);
};

// ── ABAC Guard Hook ──────────────────────────────────────────

export const useGuard = (
  resource: PermissionResource,
  action: PermissionAction,
  context?: { createdBy?: string },
): boolean => {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    if (!user) return false;

    // Superadmin bypasses all checks
    if (user.roles.includes('superadmin')) return true;

    const perm = user.permissions.find(
      (p) => p.resource === resource && p.action === action,
    );
    if (!perm) return false;

    // ABAC condition: owner-only
    if (perm.conditions?.ownerId === 'SELF' && context?.createdBy) {
      return context.createdBy === user.id;
    }

    return true;
  }, [user, resource, action, context]);
};

// ── Guard Component ──────────────────────────────────────────

interface GuardProps {
  resource: PermissionResource;
  action: PermissionAction;
  context?: { createdBy?: string };
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Guard = ({
  resource,
  action,
  context,
  fallback = null,
  children,
}: GuardProps): React.ReactNode => {
  const allowed = useGuard(resource, action, context);
  return allowed ? children : fallback;
};

// ── Auth Mutations ───────────────────────────────────────────

export const useLoginMutation = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (req: LoginRequest) =>
      apiClient.post<LoginResponse>('/api/v1/auth/login', req),
    onSuccess: (data) => {
      if (!data.mfaRequired) {
        setAuth(data.user, data.tokens, data.user.tenantId);
      }
    },
  });
};

export const useMfaVerifyMutation = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (req: MfaVerifyRequest) =>
      apiClient.post<LoginResponse>('/api/v1/auth/mfa/verify', req),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens, data.user.tenantId);
    },
  });
};

export const useLogoutMutation = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: () => apiClient.post('/api/v1/auth/logout'),
    onSettled: () => {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
  });
};

// ── Selectors ────────────────────────────────────────────────

export const useCurrentUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useTenantId = () => useAuthStore((s) => s.tenantId);
export const useAuthLoading = () => useAuthStore((s) => s.isLoading);
export const useUserRoles = () => useAuthStore((s) => s.user?.roles ?? []);
