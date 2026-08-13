import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, finalize } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { TenantService } from '@core/tenant/tenant.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { mapServerErrors } from '@shared/validators/form.validators';
import { ProblemDetail } from '@core/models/api.model';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.component.html',
})
export default class ForgotPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);

    this.authService
      .forgotPassword({
        email: this.form.value.email!,
        tenantId: this.tenantService.getTenantId(),
      })
      .pipe(
        catchError((problem: ProblemDetail) => {
          this.toast.error(problem.detail || 'Không thể gửi email');
          return EMPTY;
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe(() => this.sent.set(true));
  }
}
