import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError, BehaviorSubject, filter, switchMap, take } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  ResetPasswordRequest,
} from '@core/models/auth.model';
import { TokenService } from './token.service';
import { AuthStore } from './auth.store';

/**
 * AuthService — Handles all authentication flows:
 * - Login (password + Keycloak SSO)
 * - JWT refresh with concurrent request queuing
 * - MFA (TOTP verify + setup)
 * - Logout (clears tokens + redirects)
 * - Password management
 *
 * Design: Uses BehaviorSubject for refresh lock to prevent
 * multiple simultaneous refresh calls (concurrent 401 handling).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenService = inject(TokenService);
  private readonly authStore = inject(AuthStore);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/auth`;

  // Concurrent refresh token guard — prevents calling /refresh multiple times
  private isRefreshing = false;
  private readonly refreshTokenSubject$ = new BehaviorSubject<string | null>(null);

  // ─── Login ──────────────────────────────────────────────────────────────────

  login(request: LoginRequest, tenantId: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/login`, request, {
        headers: { 'X-Tenant-ID': tenantId },
      })
      .pipe(
        tap((response: LoginResponse) => {
          if (!response.mfaRequired) {
            this.handleLoginSuccess(response);
          }
          // If mfaRequired, caller handles MFA redirect
        }),
      );
  }

  loginWithKeycloak(tenantId: string): void {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const keycloakUrl = [
      `${environment.keycloakUrl}/realms/${environment.keycloakRealm}/protocol/openid-connect/auth`,
      `?client_id=${environment.keycloakClientId}`,
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
      `&response_type=code`,
      `&scope=openid profile email`,
      `&state=${tenantId}`,
      `&code_challenge_method=S256`,
      // PKCE code_challenge would be generated in a real implementation
    ].join('');
    window.location.href = keycloakUrl;
  }

  // ─── MFA ────────────────────────────────────────────────────────────────────

  verifyMfa(request: MfaVerifyRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/mfa/verify`, request, {
        headers: { 'X-Tenant-ID': request.tenantId },
      })
      .pipe(tap((response: LoginResponse) => this.handleLoginSuccess(response)));
  }

  setupMfa(): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${this.baseUrl}/mfa/setup`, {});
  }

  // ─── Token Refresh ──────────────────────────────────────────────────────────

  /**
   * Refresh access token. If a refresh is already in progress,
   * queue the request and wait for it to complete (prevents N refresh calls).
   */
  refreshToken(): Observable<string> {
    if (this.isRefreshing) {
      // Another request already started the refresh — wait for result
      return this.refreshTokenSubject$.pipe(
        filter((token): token is string => token !== null),
        take(1),
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject$.next(null);

    const refreshToken = this.tokenService.getRefreshToken();

    return this.http.post<LoginResponse>(`${this.baseUrl}/refresh`, { refreshToken }).pipe(
      tap((response: LoginResponse) => {
        this.isRefreshing = false;
        this.tokenService.saveTokens(response.accessToken, response.refreshToken);
        this.refreshTokenSubject$.next(response.accessToken);
      }),
      switchMap((response: LoginResponse) => [response.accessToken]),
      catchError((error: unknown) => {
        this.isRefreshing = false;
        this.logout();
        return throwError(() => error);
      }),
    );
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  logout(): void {
    const refreshToken = this.tokenService.getRefreshToken();

    if (refreshToken) {
      this.http.post(`${this.baseUrl}/logout`, { refreshToken }).subscribe({
        error: () => {}, // Swallow error — always clear locally
      });
    }

    this.tokenService.clearTokens();
    this.authStore.clearUser();
    this.router.navigate(['/auth/login']);
  }

  // ─── Password Management ────────────────────────────────────────────────────

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, request, {
      headers: { 'X-Tenant-ID': request.tenantId },
    });
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, request);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private handleLoginSuccess(response: LoginResponse): void {
    this.tokenService.saveTokens(response.accessToken, response.refreshToken);
    this.authStore.setUser(response.user);
  }
}
