// ═══════════════════════════════════════════════════════════════
// @nexus/types – Shared TypeScript Types for Nexus ERP Platform
// ═══════════════════════════════════════════════════════════════

// ── Auth & Identity ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  permissions: Permission[];
  tenantId: string;
  mfaEnabled: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type Role =
  | 'superadmin'
  | 'tenant_admin'
  | 'manager'
  | 'cashier'
  | 'staff'
  | 'viewer';

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
  conditions?: Record<string, unknown>;
}

export type PermissionResource =
  | 'ORDER'
  | 'PRODUCT'
  | 'USER'
  | 'INVENTORY'
  | 'REPORT'
  | 'TENANT'
  | 'CATEGORY';

export type PermissionAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'IMPORT';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  username: string;
  password?: string;
  authMethod: 'PASSWORD' | 'PASSKEY' | 'SSO';
  tenantId?: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: User;
  mfaRequired: boolean;
  mfaSessionId?: string;
}

export interface MfaVerifyRequest {
  sessionId: string;
  code: string;
}

// ── Multi-Tenancy ─────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  logoUrl?: string;
  primaryColor?: string;
  domain?: string;
}

export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

// ── Products & Catalog ────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  categoryId: string;
  imageUrls: string[];
  stock: number;
  minStock?: number;
  unit?: string;
  barcode?: string;
  isActive: boolean;
  version: number; // Optimistic Locking
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  categoryId: string;
  imageUrls?: string[];
  stock: number;
  minStock?: number;
  unit?: string;
  barcode?: string;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  version: number; // Required for optimistic locking
}

// ── Orders ────────────────────────────────────────────────────

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  customerName?: string;
  cashierId: string;
  tenantId: string;
  sagaId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED_INVENTORY'
  | 'FAILED_PAYMENT'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'TRANSFER';

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface CreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
    discount?: number;
  }>;
  paymentMethod: PaymentMethod;
  customerId?: string;
  note?: string;
}

// ── Saga & Async Operations ───────────────────────────────────

export interface SagaStatus {
  orderId: string;
  sagaId: string;
  status: SagaState;
  currentStep: string;
  progressPercentage: number;
  errorMessage?: string;
  completedAt?: string;
}

export type SagaState =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED_INSUFFICIENT_INVENTORY'
  | 'FAILED_PAYMENT'
  | 'COMPENSATING'
  | 'COMPENSATION_COMPLETED';

// ── Inventory ─────────────────────────────────────────────────

export interface InventoryItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warehouseId: string;
  version: number;
  lastUpdated: string;
}

export interface InventoryAdjustment {
  productId: string;
  adjustment: number;
  reason: string;
}

// ── API Response Wrappers ─────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  traceId?: string;
  errors?: Record<string, string>;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
  traceId: string;
}

// ── Notifications & SSE ───────────────────────────────────────

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type NotificationType =
  | 'ORDER_COMPLETED'
  | 'ORDER_FAILED'
  | 'LOW_STOCK'
  | 'PAYMENT_FAILED'
  | 'SAGA_UPDATE'
  | 'USER_CREATED'
  | 'SYSTEM';

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
  id?: string;
  retry?: number;
}

// ── Dashboard & Analytics ─────────────────────────────────────

export interface DashboardKpi {
  totalRevenue: number;
  totalOrders: number;
  averageBasket: number;
  topProducts: Array<{ productId: string; name: string; sold: number }>;
  revenueByHour: Array<{ hour: string; revenue: number }>;
}

// ── Common ────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  size: number;
  sort?: string;
  direction?: SortDirection;
}

export interface SearchParams extends PaginationParams {
  keyword?: string;
  filters?: Record<string, string>;
}
