import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/http/api.service';
import { Product, CreateProductRequest, UpdateProductRequest, ProductFilter } from '@core/models/product.model';
import { PageResponse } from '@core/models/api.model';

/**
 * ProductApiService — HTTP client for Product resource.
 * Extends ApiService for generic CRUD + adds product-specific endpoints.
 */
@Injectable({ providedIn: 'root' })
export class ProductApiService extends ApiService<Product, CreateProductRequest, UpdateProductRequest> {
  protected override readonly basePath = '/api/v1/products';

  findAllFiltered(filter: ProductFilter): Observable<PageResponse<Product>> {
    return this.findAll(filter as Record<string, unknown>);
  }

  uploadImage(productId: string, file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.fullUrl}/${productId}/images`, formData);
  }

  deleteImage(productId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${this.fullUrl}/${productId}/images/${imageId}`);
  }

  checkSkuExists(sku: string): Observable<{ exists: boolean }> {
    return this.http.get<{ exists: boolean }>(`${this.fullUrl}/check-sku`, {
      params: { sku },
    });
  }
}
