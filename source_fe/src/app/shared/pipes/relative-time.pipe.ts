import { Pipe, PipeTransform } from '@angular/core';
import { formatDistanceToNow, format, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * RelativeTimePipe — Formats dates as human-readable relative time.
 *
 * Usage:
 *   {{ '2026-08-13T10:00:00Z' | relativeTime }}      → 'khoảng 3 giờ trước'
 *   {{ '2026-08-13T10:00:00Z' | relativeTime:false }} → '13/08/2026 10:00'
 *   {{ null | relativeTime }}                         → '—'
 */
@Pipe({
  name: 'relativeTime',
  standalone: true,
  pure: true,
})
export class RelativeTimePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    relative = true,
    dateFormat = 'dd/MM/yyyy HH:mm',
  ): string {
    if (!value) return '—';

    const date = typeof value === 'string' ? parseISO(value) : value;
    if (!isValid(date)) return '—';

    if (relative) {
      return formatDistanceToNow(date, { addSuffix: true, locale: vi });
    }

    return format(date, dateFormat, { locale: vi });
  }
}
