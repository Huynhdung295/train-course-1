import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';
import { TenantConfig } from '@core/models/tenant.model';
import { TenantStore } from './tenant.store';

/**
 * TenantService — Resolves and manages tenant context.
 *
 * Tenant resolution order:
 * 1. Subdomain: nike.nexus.com → tenantId = 'nike'
 * 2. URL path: /t/nike/dashboard → tenantId = 'nike'
 * 3. Header: X-Tenant-Override (dev mode only)
 * 4. Fallback to 'default'
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly tenantStore = inject(TenantStore);

  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/tenant`;

  // ─── Resolution ─────────────────────────────────────────────────────────────

  resolveTenantId(): string {
    switch (environment.tenantMode) {
      case 'subdomain':
        return this.resolveFromSubdomain();
      case 'path':
        return this.resolveFromPath();
      default:
        return this.resolveFromSubdomain();
    }
  }

  getTenantId(): string {
    return this.tenantStore.tenantId() || this.resolveTenantId();
  }

  // ─── Config Loading ─────────────────────────────────────────────────────────

  loadConfig(tenantId: string): Observable<TenantConfig> {
    return this.http
      .get<TenantConfig>(`${this.baseUrl}/config`, {
        headers: { 'X-Tenant-ID': tenantId },
      })
      .pipe(
        tap((config) => {
          this.tenantStore.setConfig(config);
          this.applyBranding(config);
        }),
      );
  }

  // ─── Branding ────────────────────────────────────────────────────────────────

  private applyBranding(config: TenantConfig): void {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.primaryColor);
    root.style.setProperty('--color-secondary', config.secondaryColor);
    root.style.setProperty('--color-accent', config.accentColor);

    // Update favicon
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && config.favicon) {
      favicon.href = config.favicon;
    }

    // Update document title
    document.title = `${config.companyName} — Nexus ERP`;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private resolveFromSubdomain(): string {
    const hostname = window.location.hostname;
    // nike.nexus.com → ['nike', 'nexus', 'com'] → 'nike'
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return 'default';
  }

  private resolveFromPath(): string {
    // /t/nike/dashboard → 'nike'
    const match = window.location.pathname.match(/^\/t\/([^/]+)/);
    return match?.[1] ?? 'default';
  }
}
