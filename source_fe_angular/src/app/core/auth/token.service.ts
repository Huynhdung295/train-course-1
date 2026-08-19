import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'nexus_at'; // Short key — obfuscated slightly
const REFRESH_TOKEN_KEY = 'nexus_rt';

/**
 * TokenService — Manages JWT token storage.
 *
 * Security model:
 * - Access token: Stored in memory (module-level variable, not localStorage).
 *   Lost on page refresh — by design (forces re-auth or refresh flow).
 * - Refresh token: Stored in sessionStorage (not localStorage).
 *   sessionStorage is cleared on tab close.
 *
 * NOTE: Production systems should use HttpOnly cookies via BFF.
 * This is a client-side fallback for simpler deployment.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  // In-memory access token (not persisted to storage)
  private accessToken: string | null = null;

  // ─── Access Token ───────────────────────────────────────────────────────────

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ─── Refresh Token ──────────────────────────────────────────────────────────

  getRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  // ─── Save / Clear ───────────────────────────────────────────────────────────

  saveTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    try {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // sessionStorage unavailable (private mode) — gracefully degraded
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Ignore
    }
  }

  // ─── Token Decoding ─────────────────────────────────────────────────────────

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Add 30s buffer to avoid edge cases
      return Date.now() >= payload.exp * 1000 - 30_000;
    } catch {
      return true;
    }
  }

  isAccessTokenValid(): boolean {
    const token = this.accessToken;
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  hasRefreshToken(): boolean {
    return !!this.getRefreshToken();
  }
}
