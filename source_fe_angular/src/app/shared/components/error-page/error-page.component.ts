import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * ErrorPageComponent — Reusable 403/404 error display.
 * Route data: { errorCode: 403 | 404 }
 */
@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-page.component.html',
  styles: [`
    .error-page {
      min-height: calc(100dvh - var(--header-height));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
      background: radial-gradient(ellipse at 50% 100%, hsla(239, 84%, 67%, 0.08) 0%, transparent 60%);
    }

    .error-page__content {
      text-align: center;
      max-width: 500px;
    }

    .error-page__code {
      font-size: 7rem;
      font-weight: var(--font-bold);
      line-height: 1;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: var(--space-4);
    }

    .error-page__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      margin-bottom: var(--space-3);
    }

    .error-page__message {
      font-size: var(--text-base);
      color: var(--text-secondary);
      margin-bottom: var(--space-8);
      line-height: var(--leading-relaxed);
    }

    .error-page__actions {
      display: flex;
      gap: var(--space-3);
      justify-content: center;
    }
  `],
})
export default class ErrorPageComponent {
  readonly errorCode = input<403 | 404>(404);

  readonly title = computed(() => 
    this.errorCode() === 403 ? 'Không có quyền truy cập' : 'Trang không tìm thấy'
  );

  readonly message = computed(() => 
    this.errorCode() === 403
      ? 'Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ quản trị viên.'
      : 'Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.'
  );

  protected goBack(): void {
    window.history.back();
  }
}
