import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { PageParams, PageResponse } from '@core/models/api.model';
import { HttpParams } from '@angular/common/http';

/**
 * ApiService — Generic base service for all CRUD operations.
 *
 * Design principles:
 * - DRY: Feature services extend this, not re-implement HTTP calls
 * - Type-safe: Fully generic with TypeScript constraints
 * - Consistent: All pagination/filtering follows the same contract as BE Spring Data
 *
 * Usage:
 * ```ts
 * @Injectable({ providedIn: 'root' })
 * class ProductApiService extends ApiService<Product> {
 *   protected override readonly basePath = '/api/v1/products';
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export abstract class ApiService<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  protected readonly http = inject(HttpClient);
  protected readonly baseUrl = environment.apiBaseUrl;

  /** Override in subclass */
  protected abstract readonly basePath: string;

  protected get fullUrl(): string {
    return `${this.baseUrl}${this.basePath}`;
  }

  // ─── Generic CRUD ────────────────────────────────────────────────────────────

  findAll(params?: PageParams & Record<string, unknown>): Observable<PageResponse<T>> {
    return this.http.get<PageResponse<T>>(this.fullUrl, {
      params: this.buildParams(params),
    });
  }

  findById(id: string): Observable<T> {
    return this.http.get<T>(`${this.fullUrl}/${id}`);
  }

  create(body: CreateDTO): Observable<T> {
    return this.http.post<T>(this.fullUrl, body);
  }

  update(id: string, body: UpdateDTO): Observable<T> {
    return this.http.put<T>(`${this.fullUrl}/${id}`, body);
  }

  patch(id: string, body: Partial<UpdateDTO>): Observable<T> {
    return this.http.patch<T>(`${this.fullUrl}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.fullUrl}/${id}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  protected buildParams(params?: Record<string, unknown>): HttpParams {
    if (!params) return new HttpParams();

    return Object.entries(params).reduce((httpParams, [key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        return httpParams.set(key, String(value));
      }
      return httpParams;
    }, new HttpParams());
  }
}
