import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, catchError, finalize, interval, takeWhile } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { TenantService } from '@core/tenant/tenant.service';
import { ProblemDetail } from '@core/models/api.model';

/**
 * MfaVerifyComponent — 6-digit OTP verification.
 *
 * Features:
 * - Individual digit inputs with auto-advance
 * - 30s countdown for OTP expiry
 * - Paste handler for full code paste
 */
@Component({
  selector: 'app-mfa-verify',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mfa-verify.component.html',
  styles: [`
    .mfa {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);

      &__countdown {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
      }

      &__countdown-ring {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: hsla(239, 84%, 67%, 0.12);
        color: var(--color-primary);
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        font-variant-numeric: tabular-nums;
      }

      &__form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      &__inputs {
        display: flex;
        gap: var(--space-2);
        justify-content: center;
      }

      &__input {
        width: 48px;
        height: 56px;
        text-align: center;
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        background: var(--bg-base);
        border: 2px solid var(--border-default);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        transition: border-color var(--transition-fast);
        outline: none;

        &:focus { border-color: var(--color-primary); box-shadow: var(--focus-ring); }
        &:not(:placeholder-shown) { border-color: var(--color-primary); }
      }
    }
  `],
})
export default class MfaVerifyComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly countdown = signal(30);

  protected readonly form = this.fb.group({});

  protected readonly otpControls = Array.from({ length: 6 }, () =>
    this.fb.control('', [Validators.required, Validators.pattern('[0-9]')]),
  );

  protected isComplete = signal(false);

  constructor() {
    interval(1000)
      .pipe(
        takeWhile(() => this.countdown() > 0),
        takeUntilDestroyed()
      )
      .subscribe(() => this.countdown.update((n) => n - 1));

    // Update isComplete when any input changes
    this.otpControls.forEach((ctrl) => {
      ctrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        this.isComplete.set(this.otpControls.every((c) => c.value?.length === 1));
      });
    });
  }

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    this.otpControls[index].setValue(value.slice(-1), { emitEvent: false });

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpControls[index].value && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (pasted.length === 6) {
      pasted.split('').forEach((char, i) => this.otpControls[i].setValue(char));
      this.isComplete.set(true);
    }
    event.preventDefault();
  }

  protected onSubmit(): void {
    if (!this.isComplete() || this.submitting()) return;

    const otp = this.otpControls.map((c) => c.value).join('');
    const email = this.authStore.mfaPendingEmail() ?? '';
    const tenantId = this.tenantService.getTenantId();

    this.serverError.set(null);
    this.submitting.set(true);

    this.authService
      .verifyMfa({ email, otp, tenantId })
      .pipe(
        catchError((problem: ProblemDetail) => {
          this.serverError.set(problem.detail || 'Mã OTP không hợp lệ');
          this.otpControls.forEach((c) => c.setValue(''));
          document.getElementById('otp-0')?.focus();
          return EMPTY;
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe(() => this.router.navigate(['/dashboard']));
  }

  protected goBack(): void {
    this.router.navigate(['/auth/login']);
  }
}
