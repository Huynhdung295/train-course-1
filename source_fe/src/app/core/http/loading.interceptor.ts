import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { LoadingService } from '@core/loading/loading.service';

/**
 * loadingInterceptor — Tracks in-flight HTTP requests to show/hide global loading.
 *
 * Skips background polling and SSE/WebSocket requests.
 */
export const loadingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const loading = inject(LoadingService);

  // Skip loading indicator for background/silent requests
  const skipLoading = req.headers.has('X-Skip-Loading') || isBackgroundRequest(req.url);

  if (!skipLoading) {
    loading.increment();
  }

  return next(req).pipe(
    finalize(() => {
      if (!skipLoading) {
        loading.decrement();
      }
    }),
  );
};

function isBackgroundRequest(url: string): boolean {
  return url.includes('/events/stream') || url.includes('/actuator/health');
}
