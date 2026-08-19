import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '@shared/components/toast/toast.service';
import { ProblemDetail } from '@core/models/api.model';

/**
 * errorInterceptor — Global HTTP error handler.
 *
 * Maps all HTTP errors to ProblemDetail (RFC 7807) and shows toast notifications.
 * 401/403 are handled by authInterceptor — skipped here.
 *
 * Error propagation: rethrows ProblemDetail so components can
 * do further fine-grained handling if needed.
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const problem = toProblemDetail(error);

      // Show toast for server errors (5xx) and bad requests (400)
      // Skip 401/403 — handled by authInterceptor
      if (shouldShowToast(error.status)) {
        toast.error(problem.detail || problem.title, problem.traceId);
      }

      // Re-throw enriched ProblemDetail for component-level handling
      return throwError(() => problem);
    }),
  );
};

function toProblemDetail(error: HttpErrorResponse): ProblemDetail {
  if (error.error && typeof error.error === 'object') {
    // BE returned RFC 7807 structured error
    return {
      ...error.error,
      traceId: error.headers?.get('X-Trace-Id') ?? undefined,
    } as ProblemDetail;
  }

  // Network error or non-JSON response
  return {
    type: 'about:blank',
    title: getDefaultTitle(error.status),
    status: error.status,
    detail: error.message || 'Đã xảy ra lỗi không xác định',
    instance: error.url ?? '',
    traceId: error.headers?.get('X-Trace-Id') ?? undefined,
  };
}

function shouldShowToast(status: number): boolean {
  return status !== 401 && status !== 403 && status !== 0;
}

function getDefaultTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Dữ liệu không hợp lệ',
    404: 'Không tìm thấy',
    409: 'Xung đột dữ liệu',
    422: 'Không thể xử lý',
    429: 'Quá nhiều yêu cầu',
    500: 'Lỗi máy chủ',
    502: 'Cổng xấu',
    503: 'Dịch vụ không khả dụng',
    0: 'Lỗi mạng',
  };
  return titles[status] ?? `Lỗi HTTP ${status}`;
}
