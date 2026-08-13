import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  traceId?: string;
  duration?: number;
}

/**
 * ToastService — Global notification service.
 *
 * Usage:
 *   toast.success('Lưu thành công!');
 *   toast.error('Lỗi máy chủ', traceId);
 *   toast.warning('Cảnh báo tồn kho thấp', 'Chi tiết...');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly DEFAULT_DURATION = 5000;

  readonly toasts = signal<Toast[]>([]);

  success(title: string, message?: string): void {
    this.add({ type: 'success', title, message });
  }

  error(title: string, traceId?: string, message?: string): void {
    this.add({ type: 'error', title, message, traceId, duration: 8000 });
  }

  warning(title: string, message?: string): void {
    this.add({ type: 'warning', title, message });
  }

  info(title: string, message?: string): void {
    this.add({ type: 'info', title, message });
  }

  dismiss(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private add(toast: Omit<Toast, 'id'>): void {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? this.DEFAULT_DURATION;

    this.toasts.update((list) => [
      ...list,
      { ...toast, id },
    ]);

    // Auto-dismiss after duration
    setTimeout(() => this.dismiss(id), duration);
  }
}
