// ═══════════════════════════════════════════════════════════════
// @nexus/api-client – HTTP Client & SSE for Nexus Platform
// ═══════════════════════════════════════════════════════════════

import axios, {
  type AxiosInstance,
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ProblemDetail } from '@nexus/types';

// ── API Client Class ──────────────────────────────────────────

class NexusApiClient {
  private instance: AxiosInstance;
  private authToken: string | null = null;
  private tenantId: string | null = null;
  private onTokenExpired?: () => void;

  constructor(baseURL: string) {
    this.instance = axios.create({
      baseURL,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request Interceptor – attach auth, tenant, trace headers
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.headers['X-Trace-ID'] = crypto.randomUUID();
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }
        return config;
      },
    );

    // Response Interceptor – unwrap data, handle 401
    this.instance.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError<ProblemDetail>) => {
        if (error.response?.status === 401) {
          this.onTokenExpired?.();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nexus:token-expired'));
          }
        }
        const traceId =
          error.response?.headers?.['x-trace-id'] ??
          error.config?.headers?.['X-Trace-ID'];
        return Promise.reject({
          ...error,
          traceId,
          problemDetail: error.response?.data,
        });
      },
    );
  }

  // ── Token & Tenant Management ──
  setAuthToken(token: string) {
    this.authToken = token;
  }
  setTenantId(id: string) {
    this.tenantId = id;
  }
  clearAuthToken() {
    this.authToken = null;
  }
  clearTenantId() {
    this.tenantId = null;
  }
  setOnTokenExpired(callback: () => void) {
    this.onTokenExpired = callback;
  }
  getAuthToken() {
    return this.authToken;
  }
  getTenantId() {
    return this.tenantId;
  }

  // ── HTTP Methods ──
  get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, { params, ...config }) as Promise<T>;
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, data, config) as Promise<T>;
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.put(url, data, config) as Promise<T>;
  }

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.patch(url, data, config) as Promise<T>;
  }

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.delete(url, config) as Promise<T>;
  }

  // ── File Upload ──
  upload<T>(url: string, formData: FormData, onProgress?: (percent: number) => void): Promise<T> {
    return this.instance.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    }) as Promise<T>;
  }
}

const API_BASE_URL =
  (typeof globalThis !== 'undefined' &&
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:8080';

export const apiClient = new NexusApiClient(API_BASE_URL);

// ── SSE Client Re-export ─────────────────────────────────────

export { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';

// ── Query Keys Factory ───────────────────────────────────────

export const queryKeys = {
  products: {
    all: (tenantId: string) => [tenantId, 'products'] as const,
    list: (tenantId: string, filters?: object) =>
      [tenantId, 'products', 'list', filters] as const,
    detail: (tenantId: string, id: string) =>
      [tenantId, 'products', id] as const,
  },
  categories: {
    all: (tenantId: string) => [tenantId, 'categories'] as const,
    tree: (tenantId: string) => [tenantId, 'categories', 'tree'] as const,
  },
  orders: {
    all: (tenantId: string) => [tenantId, 'orders'] as const,
    list: (tenantId: string, filters?: object) =>
      [tenantId, 'orders', 'list', filters] as const,
    detail: (tenantId: string, id: string) =>
      [tenantId, 'orders', id] as const,
    saga: (tenantId: string, orderId: string) =>
      [tenantId, 'orders', orderId, 'saga'] as const,
  },
  users: {
    all: (tenantId: string) => [tenantId, 'users'] as const,
    list: (tenantId: string, filters?: object) =>
      [tenantId, 'users', 'list', filters] as const,
    detail: (tenantId: string, id: string) =>
      [tenantId, 'users', id] as const,
  },
  inventory: {
    all: (tenantId: string) => [tenantId, 'inventory'] as const,
    byProduct: (tenantId: string, productId: string) =>
      [tenantId, 'inventory', productId] as const,
  },
  notifications: {
    all: (tenantId: string) => [tenantId, 'notifications'] as const,
    unread: (tenantId: string) =>
      [tenantId, 'notifications', 'unread'] as const,
  },
  dashboard: {
    kpi: (tenantId: string, range?: string) =>
      [tenantId, 'dashboard', 'kpi', range] as const,
    revenue: (tenantId: string) =>
      [tenantId, 'dashboard', 'revenue'] as const,
  },
} as const;

// ── StaleTime Presets ────────────────────────────────────────

export const STALE_TIMES = {
  REALTIME: 0,
  SHORT: 1000 * 30,        // 30 seconds
  MEDIUM: 1000 * 60 * 5,   // 5 minutes
  LONG: 1000 * 60 * 30,    // 30 minutes
  STATIC: 1000 * 60 * 60,  // 1 hour
} as const;

// ── Type Export ──────────────────────────────────────────────

export type { NexusApiClient };
