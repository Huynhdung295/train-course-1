import { Pipe, PipeTransform } from '@angular/core';

/**
 * CurrencyVndPipe — Formats numbers as Vietnamese Dong (VND).
 *
 * Usage:
 *   {{ 150000 | currencyVnd }}          → '150.000 ₫'
 *   {{ 1500000 | currencyVnd:true }}    → '1.500.000 ₫'
 *   {{ 0 | currencyVnd }}              → '0 ₫'
 *
 * Note: Backend sends monetary values as strings (BigDecimal → String
 * via MoneySerializer to avoid JS floating point precision loss).
 */
@Pipe({
  name: 'currencyVnd',
  standalone: true,
  pure: true,
})
export class CurrencyVndPipe implements PipeTransform {
  private static readonly formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '0 ₫';

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0 ₫';

    return CurrencyVndPipe.formatter.format(num);
  }
}
