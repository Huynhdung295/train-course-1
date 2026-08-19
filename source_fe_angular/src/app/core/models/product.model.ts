// =============================================================================
// Product Domain Models — Matches BE Product entity + DTOs
// =============================================================================

import { Status } from '@core/models/api.model';

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  price: string;           // String from BE MoneySerializer (BigDecimal safety)
  costPrice?: string;
  categoryId: string;
  categoryName?: string;
  images: ProductImage[];
  status: Status;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  version: number;         // Optimistic locking
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
  productCount?: number;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  categoryId: string;
  unit: string;
  lowStockThreshold?: number;
}

export interface UpdateProductRequest extends CreateProductRequest {
  version: number;   // Required for optimistic locking
}

export interface ProductFilter {
  search?: string;
  categoryId?: string;
  status?: Status;
  lowStock?: boolean;
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// ─── Stock helpers ────────────────────────────────────────────────────────────

export function isLowStock(product: Product): boolean {
  return product.stockQuantity <= product.lowStockThreshold;
}

export function isOutOfStock(product: Product): boolean {
  return product.stockQuantity === 0;
}
