import { Component, ChangeDetectionStrategy, inject, signal, input, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap, Subject, merge, startWith } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderApiService } from '../services/order-api.service';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, canCancelOrder } from '@core/models/order.model';
import { CurrencyVndPipe } from '@shared/pipes/currency-vnd.pipe';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe, RelativeTimePipe, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.component.html',
})
export default class OrderDetailComponent {
  private readonly orderApi = inject(OrderApiService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  private readonly id$ = toObservable(this.id);
  private readonly refresh$ = new Subject<void>();

  protected readonly loading = signal(false);
  protected readonly order = signal<Order | null>(null);

  protected readonly canCancel = computed(() => {
    const o = this.order();
    return o ? canCancelOrder(o.status) : false;
  });

  constructor() {
    merge(this.id$, this.refresh$.pipe(startWith(null), switchMap(() => this.id$)))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(orderId => this.orderApi.findById(orderId).pipe(
          catchError(() => of(null))
        )),
        takeUntilDestroyed()
      )
      .subscribe(order => {
        this.order.set(order);
        this.loading.set(false);
      });
  }

  protected getStatusLabel(status: string): string { return ORDER_STATUS_LABELS[status as never] ?? status; }
  protected getStatusColor(status: string): string { return ORDER_STATUS_COLORS[status as never] ?? 'neutral'; }

  protected cancelOrder(): void {
    const orderData = this.order();
    if (!orderData) return;
    
    const reason = prompt('Lý do hủy đơn:');
    if (!reason) return;

    this.orderApi.cancelOrder(orderData.id, reason)
      .subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.toast.success('Đơn hàng đã được hủy');
        },
        error: (problem) => this.toast.error(problem.detail || 'Không thể hủy đơn hàng'),
      });
  }
}
