import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { TenantService } from '@core/tenant/tenant.service';

/**
 * tenantInterceptor — Automatically injects X-Tenant-ID header
 * into every outgoing HTTP request to the API.
 *
 * Skips: requests to external domains (Keycloak, CDN, etc.)
 */
export const tenantInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const tenantService = inject(TenantService);
  const tenantId = tenantService.getTenantId();

  if (!tenantId || !isApiRequest(req.url)) {
    return next(req);
  }

  const tenantReq = req.clone({
    setHeaders: { 'X-Tenant-ID': tenantId },
  });

  return next(tenantReq);
};

function isApiRequest(url: string): boolean {
  // Only add header to our own API — skip external calls
  return url.includes('/api/v1/') || url.includes('/actuator/');
}
