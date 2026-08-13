import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, combineLatest, debounceTime, startWith, switchMap, tap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OrderApiService } from '../services/order-api.service';
import { Order, OrderFilter, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, canCancelOrder } from '@core/models/order.model';
import { PageResponse } from '@core/models/api.model';
import { CurrencyVndPipe } from '@shared/pipes/currency-vnd.pipe';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyVndPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-list.component.html',
  styles: [`.order-list-page { display: flex; flex-direction: column; gap: var(--space-5); }`],
})
export default class OrderListComponent {
  private readonly orderApi = inject(OrderApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  
  protected readonly searchControl = this.fb.control('');
  protected readonly statusControl = this.fb.control('');

  protected readonly statusEntries = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

  private readonly filterChange$ = combineLatest([
    toObservable(this.currentPage),
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value), debounceTime(300)),
    this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
  ]).pipe(
    switchMap(([page, search, status]) => {
      this.loading.set(true);
      const filter: OrderFilter = {
        search: search || undefined,
        status: (status as never) || undefined,
        page,
        size: 20,
      };
      return this.orderApi.findAllFiltered(filter).pipe(
        catchError(() => of(null)),
        tap(() => this.loading.set(false))
      );
    })
  );

  protected readonly page = toSignal(this.filterChange$);
  protected readonly orders = computed(() => this.page()?.content ?? []);

  protected goToPage(page: number): void { this.currentPage.set(page); }
  protected getStatusLabel(status: string): string { return ORDER_STATUS_LABELS[status as never] ?? status; }
  protected getStatusColor(status: string): string { return ORDER_STATUS_COLORS[status as never] ?? 'neutral'; }
}
