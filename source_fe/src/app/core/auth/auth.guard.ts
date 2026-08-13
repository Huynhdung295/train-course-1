import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';
import { TokenService } from './token.service';

/**
 * authGuard — Protects all authenticated routes.
 * Checks if user has a valid access token or refresh token to attempt restore.
 */
export const authGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authStore = inject(AuthStore);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  // User already authenticated in this session
  if (authStore.isAuthenticated()) {
    return true;
  }

  // Has a refresh token — will be restored by AuthInterceptor on first request
  if (tokenService.hasRefreshToken()) {
    return true;
  }

  // Not authenticated — redirect to login preserving return URL
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * guestGuard — Prevents authenticated users from accessing auth pages (login, etc.)
 */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
