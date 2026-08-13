import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { timeout, catchError, retry, throwError, timer } from 'rxjs';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

/**
 * retryInterceptor — Retries failed GET requests with exponential backoff.
 *
 * Strategy:
 * - Only retries GET requests (safe, idempotent)
 * - Skips 4xx errors (client errors — retrying won't help)
 * - Applies timeout of 30s per request
 * - Exponential backoff: 1s, 2s, 4s
 */
export const retryInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const isRetryable = req.method === 'GET' && !req.headers.has('X-No-Retry');

  const request$ = next(req).pipe(
    timeout(DEFAULT_TIMEOUT_MS),
  );

  if (!isRetryable) {
    return request$;
  }

  return request$.pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error, retryIndex) => {
        // Don't retry client errors (4xx)
        if (error?.status >= 400 && error?.status < 500) {
          return throwError(() => error);
        }
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = RETRY_DELAY_MS * Math.pow(2, retryIndex - 1);
        return timer(delayMs);
      },
    }),
  );
};
