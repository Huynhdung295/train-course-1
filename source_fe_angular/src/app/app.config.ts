import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';

import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { errorInterceptor } from '@core/http/error.interceptor';
import { loadingInterceptor } from '@core/http/loading.interceptor';
import { retryInterceptor } from '@core/http/retry.interceptor';
import { tenantInterceptor } from '@core/tenant/tenant.interceptor';

/**
 * App configuration — Angular 22 Standalone bootstrapApplication.
 *
 * Interceptor order (applied top to bottom, response handled bottom to top):
 * 1. loadingInterceptor   → shows/hides spinner
 * 2. tenantInterceptor    → adds X-Tenant-ID header
 * 3. authInterceptor      → adds Bearer token, handles 401 refresh
 * 4. retryInterceptor     → retry GET with backoff + 30s timeout
 * 5. errorInterceptor     → maps errors to RFC 7807, shows toasts
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(
      routes,
      withComponentInputBinding(),    // Route params as @Input()
      withViewTransitions(),           // Native View Transitions API
    ),

    provideHttpClient(
      withFetch(),                     // Use Fetch API (better SSR support)
      withInterceptors([
        loadingInterceptor,
        tenantInterceptor,
        authInterceptor,
        retryInterceptor,
        errorInterceptor,
      ]),
    ),

    provideAnimationsAsync(),

    // i18n — supports vi/en
    importProvidersFrom(TranslateModule.forRoot({
      defaultLanguage: 'vi',
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) =>
          new TranslateHttpLoader(http, '/assets/i18n/', '.json'),
        deps: [HttpClient],
      },
    })),
  ],
};
