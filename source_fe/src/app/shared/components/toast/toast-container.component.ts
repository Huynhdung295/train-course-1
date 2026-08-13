import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { ToastService, Toast, ToastType } from './toast.service';

/**
 * ToastContainerComponent — Fixed-position toast notification container.
 * Renders toast list from ToastService signal in bottom-right corner.
 * Each toast has entrance/exit animation and an auto-close button.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      state('void', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('*', style({ transform: 'translateX(0)', opacity: 1 })),
      transition(':enter', animate('250ms ease-out')),
      transition(':leave', animate('200ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))),
    ]),
  ],
  templateUrl: './toast-container.component.html',
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 420px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      backdrop-filter: blur(8px);
      pointer-events: all;
      border-left: 4px solid;
      background: var(--surface-elevated);

      &--success { border-color: var(--color-success); .toast__icon { color: var(--color-success); } }
      &--error   { border-color: var(--color-danger);  .toast__icon { color: var(--color-danger); } }
      &--warning { border-color: var(--color-warning); .toast__icon { color: var(--color-warning); } }
      &--info    { border-color: var(--color-info);    .toast__icon { color: var(--color-info); } }
    }

    .toast__icon { font-size: 1.25rem; flex-shrink: 0; margin-top: 0.1rem; }

    .toast__body { flex: 1; min-width: 0; }

    .toast__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .toast__message {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0.25rem 0 0;
    }

    .toast__trace {
      font-size: 0.6875rem;
      color: var(--text-tertiary);
      font-family: var(--font-mono);
      margin: 0.375rem 0 0;
      opacity: 0.7;
      cursor: text;
      user-select: all;
    }

    .toast__close {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 0;
      font-size: 0.75rem;
      line-height: 1;
      flex-shrink: 0;
      transition: color 150ms ease;

      &:hover { color: var(--text-primary); }
    }
  `],
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);

  protected getIcon(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[type];
  }
}
