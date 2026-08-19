import { Injectable, signal, computed } from '@angular/core';

/**
 * LoadingService — Tracks the number of in-flight HTTP requests.
 * Used by loadingInterceptor and global loading spinner component.
 *
 * Pattern: Reference counting (increment on request start, decrement on finish).
 * When count > 0: show spinner. When count = 0: hide spinner.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly count = signal(0);

  /** True when any HTTP request is in flight */
  readonly isLoading = computed(() => this.count() > 0);

  increment(): void {
    this.count.update((n) => n + 1);
  }

  decrement(): void {
    this.count.update((n) => Math.max(0, n - 1));
  }

  reset(): void {
    this.count.set(0);
  }
}
