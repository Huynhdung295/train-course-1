import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { EMPTY, catchError, filter, finalize, of, switchMap, tap, map } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CartStore } from './store/cart.store';
import { ProductApiService } from '@features/products/services/product-api.service';
import { OrderApiService } from '@features/orders/services/order-api.service';
import { PaymentMethod } from '@core/models/order.model';
import { ProblemDetail } from '@core/models/api.model';
import { CurrencyVndPipe } from '@shared/pipes/currency-vnd.pipe';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyVndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export default class PosComponent {
  protected readonly cartStore = inject(CartStore);
  private readonly productApi = inject(ProductApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly searchControl = this.fb.control('');
  
  // Create a signal to track explicit search triggers (e.g. pressing Enter)
  protected readonly triggerSearch = signal(0);
  protected readonly searched = signal(false);
  protected readonly searchLoading = signal(false);
  protected readonly checkoutLoading = signal(false);

  protected readonly paymentMethods: Array<{ value: PaymentMethod; label: string; icon: string }> = [
    { value: 'CASH', label: 'Tiền mặt', icon: '💵' },
    { value: 'VIET_QR', label: 'VietQR', icon: '📱' },
    { value: 'BANK_TRANSFER', label: 'Chuyển khoản', icon: '🏦' },
    { value: 'MOMO', label: 'MoMo', icon: '🔴' },
  ];

  // Reactive search results
  protected readonly searchResults = toSignal(
    toObservable(this.triggerSearch).pipe(
      filter(count => count > 0),
      tap(() => {
        this.searchLoading.set(true);
        this.searched.set(true);
      }),
      switchMap(() => {
        const search = this.searchControl.value.trim();
        return this.productApi.findAllFiltered({ search, size: 24, status: 'ACTIVE' as never }).pipe(
          map(page => page?.content ?? []),
          catchError(() => of([])),
          tap(() => this.searchLoading.set(false))
        );
      })
    ),
    { initialValue: [] }
  );

  protected searchProducts(): void {
    const search = this.searchControl.value.trim();
    if (!search) return;
    this.triggerSearch.update(c => c + 1);
  }

  protected checkout(): void {
    if (this.cartStore.isEmpty() || this.checkoutLoading()) return;

    const orderRequest = this.cartStore.buildOrderRequest();
    this.checkoutLoading.set(true);
    this.cartStore.setCheckoutStatus('processing');

    this.orderApi
      .create(orderRequest)
      .pipe(
        catchError((problem: ProblemDetail) => {
          this.toast.error('Thanh toán thất bại', problem?.traceId, problem?.detail);
          this.cartStore.setCheckoutStatus('failed');
          return EMPTY;
        }),
        finalize(() => this.checkoutLoading.set(false)),
      )
      .subscribe((order) => {
        this.cartStore.setCheckoutStatus('success', order.id);
        this.toast.success(`Đơn hàng #${order.orderNumber} đã tạo thành công! 🎉`);
        this.cartStore.clearCart();
      });
  }
}
