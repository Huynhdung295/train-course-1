import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { RealtimeService, RealtimeEvent } from '@core/realtime/realtime.service';
import { CurrencyVndPipe } from '@shared/pipes/currency-vnd.pipe';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';

interface KpiCard {
  label: string;
  value: string | number;
  delta?: string;       // e.g. '+12% vs hôm qua'
  icon: string;
  color: string;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string;
  status: string;
  createdAt: string;
}

/**
 * DashboardComponent — Analytics overview page.
 *
 * Shows: KPI cards, recent orders, low-stock alerts.
 * Listens to realtime events for live metric updates.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyVndPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export default class DashboardComponent {
  private readonly realtimeService = inject(RealtimeService);

  protected readonly kpiCards = signal<KpiCard[]>([
    { label: 'Doanh thu hôm nay', value: '0 ₫', icon: '💰', color: '#10b981' },
    { label: 'Đơn hàng', value: 0, icon: '📋', color: '#6366f1', delta: '+0 vs hôm qua' },
    { label: 'Khách hàng mới', value: 0, icon: '👤', color: '#8b5cf6' },
    { label: 'Sản phẩm bán chạy', value: '—', icon: '📦', color: '#f59e0b' },
  ]);

  protected readonly recentOrders = signal<RecentOrder[]>([]);
  protected readonly lowStockItems = signal<Array<{ id: string; name: string; stock: number }>>([]);
  protected readonly lastUpdated = signal(new Date().toISOString());

  constructor() {
    this.realtimeService
      .events()
      .pipe(
        filter((e) => ['ORDER_CREATED', 'PAYMENT_COMPLETED', 'INVENTORY_LOW'].includes(e.type)),
        takeUntilDestroyed()
      )
      .subscribe((event) => this.handleRealtimeEvent(event));
  }

  protected getStatusColor(status: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'success',
      PENDING: 'warning',
      CANCELLED: 'danger',
      PROCESSING: 'info',
    };
    return map[status] ?? 'neutral';
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    this.lastUpdated.set(new Date().toISOString());

    if (event.type === 'ORDER_CREATED') {
      const order = event.payload as RecentOrder;
      this.recentOrders.update((orders) => [order, ...orders].slice(0, 10));
    }
  }
}
