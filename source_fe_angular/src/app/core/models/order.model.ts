// =============================================================================
// Order Domain Models — Matches BE Order entity + Saga states
// =============================================================================

export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'VIET_QR' | 'CREDIT_CARD' | 'MOMO';

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotal: string;
  discountAmount: string;
  total: string;
  note?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  staffId: string;
  staffName: string;
  warehouseId?: string;
  // Saga status
  stockReservationStatus?: 'RESERVED' | 'RELEASED' | 'PENDING';
  paymentTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  totalPrice: string;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
  paymentMethod: PaymentMethod;
  discountAmount?: number;
  note?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  warehouseId?: string;
}

export interface CreateOrderItemRequest {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

export interface OrderFilter {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  staffId?: string;
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// ─── Order status helpers ─────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  CONFIRMED: 'primary',
  SHIPPED: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'secondary',
};

export function canCancelOrder(status: OrderStatus): boolean {
  return ['PENDING', 'PROCESSING', 'CONFIRMED'].includes(status);
}

export function canRefundOrder(order: Order): boolean {
  return order.status === 'COMPLETED' && order.paymentStatus === 'PAID';
}
