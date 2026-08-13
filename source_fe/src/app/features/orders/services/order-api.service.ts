import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { Order, CreateOrderRequest, OrderFilter } from '@core/models/order.model';
import { PageResponse } from '@core/models/api.model';

/**
 * OrderApiService — HTTP client for Order resource.
 * Extends generic ApiService + adds order-specific actions.
 */
@Injectable({ providedIn: 'root' })
export class OrderApiService extends ApiService<Order, CreateOrderRequest> {
  protected override readonly basePath = '/api/v1/orders';

  findAllFiltered(filter: OrderFilter): Observable<PageResponse<Order>> {
    return this.findAll(filter as Record<string, unknown>);
  }

  cancelOrder(id: string, reason: string): Observable<Order> {
    return this.http.post<Order>(`${this.fullUrl}/${id}/cancel`, { reason });
  }

  refundOrder(id: string, amount: number, reason: string): Observable<Order> {
    return this.http.post<Order>(`${this.fullUrl}/${id}/refund`, { amount, reason });
  }

  getOrderByNumber(orderNumber: string): Observable<Order> {
    return this.http.get<Order>(`${this.fullUrl}/by-number/${orderNumber}`);
  }
}
