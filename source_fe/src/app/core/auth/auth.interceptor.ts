import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

/**
 * authInterceptor — Functional HTTP interceptor for JWT auth.
 *
 * Responsibilities:
 * 1. Attach Bearer token to every outgoing request
 * 2. On 401: trigger token refresh and retry original request
 * 3. On 403: redirect to /forbidden
 *
 * Uses Angular's functional interceptor pattern (no class, no DI ceremony).
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  const token = tokenService.getAccessToken();
  const authReq = token ? addAuthHeader(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint(req.url)) {
        return authService.refreshToken().pipe(
          switchMap((newToken) => next(addAuthHeader(req, newToken))),
          catchError(() => throwError(() => error)),
        );
      }

      if (error.status === 403) {
        // Lazy import to avoid circular dependency with Router
        import('@angular/router').then(({ Router }) => {
          inject(Router).navigate(['/forbidden']);
        });
      }

      return throwError(() => error);
    }),
  );
};

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}
