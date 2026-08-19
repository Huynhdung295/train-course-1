import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// ─── Vietnamese Phone Number ──────────────────────────────────────────────────

/**
 * Validates Vietnamese mobile phone numbers.
 * Supports: 03x, 05x, 07x, 08x, 09x (10 digits total)
 * E.164 format (+84) is also accepted.
 */
export function vietnamesePhoneValidator(): ValidatorFn {
  const pattern = /^(\+84|0)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])\d{7}$/;

  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // Use required separately
    const valid = pattern.test(control.value.replace(/\s/g, ''));
    return valid ? null : { vietnamesePhone: { value: control.value } };
  };
}

// ─── UUID ─────────────────────────────────────────────────────────────────────

export function uuidValidator(): ValidatorFn {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    return pattern.test(control.value) ? null : { invalidUuid: { value: control.value } };
  };
}

// ─── Positive Decimal (BigDecimal for prices) ─────────────────────────────────

export function positiveDecimalValidator(min = 0): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value && control.value !== 0) return null;
    const val = parseFloat(String(control.value));
    if (isNaN(val)) return { positiveDecimal: { message: 'Giá trị phải là số' } };
    if (val <= min) return { positiveDecimal: { message: `Giá trị phải lớn hơn ${min}` } };
    return null;
  };
}

// ─── Passwords Match ──────────────────────────────────────────────────────────

export function passwordMatchValidator(passwordField: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordField)?.value;
    const confirm = group.get(confirmField)?.value;
    return password === confirm ? null : { passwordMismatch: true };
  };
}

// ─── RFC 7807 → Form Error Mapper ─────────────────────────────────────────────

import { FormGroup } from '@angular/forms';
import { ProblemDetail } from '@core/models/api.model';

/**
 * Maps RFC 7807 field errors from BE to Angular FormGroup controls.
 * Call this in catchError blocks to auto-display server validation messages.
 *
 * @example
 * this.loginForm.pipe(
 *   catchError((problem: ProblemDetail) => {
 *     mapServerErrors(this.form, problem);
 *     return EMPTY;
 *   })
 * )
 */
export function mapServerErrors(form: FormGroup, problem: ProblemDetail): void {
  if (!problem.errors?.length) return;

  problem.errors.forEach(({ field, message }) => {
    const control = form.get(field);
    if (control) {
      control.setErrors({ serverError: message });
      control.markAsTouched();
    }
  });
}
