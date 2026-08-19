import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { AuthUser, Permission, PermissionAction, PermissionResource, hasPermission, hasRole } from '@core/models/auth.model';

// ─── State shape ──────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  mfaPendingEmail: string | null;  // When MFA is required mid-login
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  mfaPendingEmail: null,
};

/**
 * AuthStore — NgRx SignalStore for authentication state.
 *
 * Single source of truth for:
 * - Current authenticated user
 * - Permissions (ABAC) — used by PermissionDirective and Guards
 * - MFA flow state
 *
 * Pattern: Facade over complex auth state.
 * Components never access TokenService directly.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),

  withComputed(({ user }) => ({
    currentUser: computed(() => user()),
    permissions: computed(() => user()?.permissions ?? []),
    roles: computed(() => user()?.roles ?? []),
    fullName: computed(() => {
      const u = user();
      return u ? `${u.firstName} ${u.lastName}` : '';
    }),
    tenantId: computed(() => user()?.tenantId ?? ''),
    avatar: computed(() => user()?.avatar ?? null),
  })),

  withMethods((store) => ({
    setUser(user: AuthUser): void {
      patchState(store, { user, isAuthenticated: true, mfaPendingEmail: null });
    },

    clearUser(): void {
      patchState(store, initialState);
    },

    setMfaPending(email: string): void {
      patchState(store, { mfaPendingEmail: email });
    },

    can(resource: PermissionResource, action: PermissionAction): boolean {
      return hasPermission(store.permissions(), resource, action);
    },

    hasRole(role: string): boolean {
      return hasRole(store.roles(), role);
    },

    isAdmin(): boolean {
      return hasRole(store.roles(), 'ROLE_ADMIN');
    },
  })),
);

export type AuthStoreType = InstanceType<typeof AuthStore>;
