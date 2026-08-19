import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EMPTY, catchError, finalize } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { TenantService } from '@core/tenant/tenant.service';
import { mapServerErrors } from '@shared/validators/form.validators';
import { ProblemDetail } from '@core/models/api.model';
import { LoginResponse } from '@core/models/auth.model';

/**
 * LoginComponent — Email/password + Keycloak SSO login page.
 *
 * Features:
 * - Reactive form with validation
 * - Submitting state prevents double-submit
 * - RFC 7807 server error → form field mapping
 * - MFA redirect if required
 * - ReturnUrl support after login
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export default class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  constructor() {
    // Auto-redirect if already logged in
    if (this.authStore.isAuthenticated()) {
      this.redirectAfterLogin();
    }
  }

  protected get emailErrors(): string | null {
    const ctrl = this.form.get('email')!;
    if (!ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Email là bắt buộc';
    if (ctrl.hasError('email')) return 'Email không hợp lệ';
    if (ctrl.hasError('serverError')) return ctrl.getError('serverError');
    return null;
  }

  protected get passwordErrors(): string | null {
    const ctrl = this.form.get('password')!;
    if (!ctrl.touched || ctrl.valid) return null;
    if (ctrl.hasError('required')) return 'Mật khẩu là bắt buộc';
    if (ctrl.hasError('minlength')) return 'Mật khẩu phải có ít nhất 6 ký tự';
    if (ctrl.hasError('serverError')) return ctrl.getError('serverError');
    return null;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;

    this.form.markAllAsTouched();
    this.serverError.set(null);
    this.submitting.set(true);

    const { email, password, rememberMe } = this.form.getRawValue();
    const tenantId = this.tenantService.getTenantId();

    // Use takeUntilDestroyed or handle memory leak in login by un-subscribing explicitly
    // Since login is a one-off HTTP POST that completes, the leak risk is low, 
    // but using first() or takeUntilDestroyed is best practice.
    this.authService
      .login({ email, password, rememberMe }, tenantId)
      .pipe(
        catchError((problem: ProblemDetail) => {
          mapServerErrors(this.form, problem);
          this.serverError.set(problem.detail || 'Đăng nhập thất bại');
          return EMPTY;
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe((response: LoginResponse) => {
        if (response.mfaRequired) {
          this.authStore.setMfaPending(email);
          this.router.navigate(['/auth/mfa']);
        } else {
          this.redirectAfterLogin();
        }
      });
  }

  protected loginWithSSO(): void {
    const tenantId = this.tenantService.getTenantId();
    this.authService.loginWithKeycloak(tenantId);
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }
}
