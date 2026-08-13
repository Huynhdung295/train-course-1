import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';
import { PermissionResource, PermissionAction } from '@core/models/auth.model';

/**
 * permissionGuard — Factory guard for ABAC permission checks.
 *
 * Usage in routes:
 * ```ts
 * {
 *   path: 'products/new',
 *   canActivate: [permissionGuard('PRODUCT', 'CREATE')],
 *   component: ProductCreateComponent,
 * }
 * ```
 */
export function permissionGuard(
  resource: PermissionResource,
  action: PermissionAction,
): CanActivateFn {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (authStore.can(resource, action)) {
      return true;
    }

    return router.createUrlTree(['/forbidden']);
  };
}

/**
 * roleGuard — Factory guard for role-based checks.
 *
 * Usage in routes:
 * ```ts
 * {
 *   path: 'admin',
 *   canActivate: [roleGuard('ROLE_ADMIN')],
 *   component: AdminComponent,
 * }
 * ```
 */
export function roleGuard(...roles: string[]): CanActivateFn {
  return () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    const hasAnyRole = roles.some((role) => authStore.hasRole(role));

    if (hasAnyRole) return true;

    return router.createUrlTree(['/forbidden']);
  };
}
