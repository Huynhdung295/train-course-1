# BẢN ĐẶC TẢ KIẾN TRÚC MICRO FRONTEND TOÀN HỆ THỐNG (NEXUS ERP)

**Dự án:** Nexus POS & ERP – Enterprise B2B Multi-Tenant Platform
**Phiên bản:** 1.0.0
**Tác giả:** Principal Senior Fullstack Engineering Team
**Mục tiêu:** Tài liệu đặc tả từ A-Z đủ để BẤT KỲ AI nào implement hoàn chỉnh, không đứt quãng.

---

## MỤC LỤC

1. [Tổng quan Kiến trúc Micro FE](#1-tổng-quan-kiến-trúc-micro-fe)
2. [Monorepo Structure & Workspace Setup](#2-monorepo-structure--workspace-setup)
3. [Shared Packages](#3-shared-packages-internal-libraries)
4. [MFE Apps – Chi tiết từng App](#4-mfe-apps--chi-tiết-từng-app)
5. [Module Federation Config](#5-module-federation-config-host--remotes)
6. [Auth & Multi-Tenancy Strategy](#6-auth--multi-tenancy-strategy)
7. [API Client Layer](#7-api-client-layer)
8. [Design System (@nexus/ui)](#8-design-system)
9. [State Management Strategy](#9-state-management-strategy)
10. [Realtime: SSE, WebSocket](#10-realtime-sse-websocket)
11. [Testing Strategy](#11-testing-strategy)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Hosting & Deployment](#13-hosting--deployment-strategy)
14. [Environment Variables](#14-environment-variables)
15. [Checklist Implement từ A-Z](#15-checklist-implement-từ-a-z)

---

## 1. TỔNG QUAN KIẾN TRÚC MICRO FE

### 1.1. Lý do chọn Micro Frontend

Hệ thống Nexus ERP có nhiều domain nghiệp vụ độc lập (Auth, POS, Catalog, Inventory, Users, Analytics). Mỗi domain có:
- Tech stack phù hợp riêng (React cho realtime POS, Vue cho form-heavy Catalog, Angular cho ABAC Admin)
- Team phát triển và release cycle độc lập
- Yêu cầu hiệu suất khác nhau (SSR cho Marketing, CSR cho POS)

### 1.2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                   NEXUS MICRO FRONTEND ECOSYSTEM                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              SHELL APP (Host) – Next.js 15                   │   │
│  │         Port 3000 | Entry Point | Routing | Auth Shell       │   │
│  └──────────────┬───────────────────────────────────────────────┘   │
│                 │  Module Federation (Webpack 5 / Rspack)           │
│    ┌────────────┼────────────────────────────────────────┐          │
│    │            │            │            │              │          │
│  ┌─▼──────┐ ┌──▼───────┐ ┌─▼──────┐ ┌──▼────────┐ ┌──▼──────┐   │
│  │MFE:Auth│ │ MFE:POS  │ │MFE:ERP │ │MFE:Catalog│ │MFE:Users│   │
│  │React 19│ │ React 19 │ │Next 15 │ │  Nuxt 3   │ │Angular19│   │
│  │Port3001│ │ Port3002 │ │Port3003│ │  Port3004 │ │ Port3005│   │
│  └────────┘ └──────────┘ └────────┘ └───────────┘ └─────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         MFE: Landing/Marketing – Astro 5 (Port 3006)         │   │
│  │              SSG | Public Pages | SEO-first                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────── SHARED PACKAGES (pnpm workspace) ──────────── │
│  @nexus/ui  @nexus/api-client  @nexus/auth  @nexus/utils  @nexus/types│
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴──────────────────┐
              │     BACKEND (Spring Boot 3.3.2)   │
              │   http://localhost:8080/api/v1    │
              └───────────────────────────────────┘
```

### 1.3. Phân công Tech Stack

| App | Framework | Lý do chọn | Port | SSR? |
|-----|-----------|------------|------|------|
| **Shell** | Next.js 15 + App Router | Routing trung tâm, Auth orchestration, Edge Middleware | 3000 | Hybrid |
| **MFE: Auth** | React 19 + Vite 6 | SPA thuần, Passkey (WebAuthn), MFA TOTP | 3001 | CSR |
| **MFE: POS** | React 19 + Vite 6 | Realtime cao, zustand cart, optimistic UI | 3002 | CSR |
| **MFE: ERP Dashboard** | Next.js 15 | Analytics, reporting, SSR data | 3003 | SSR |
| **MFE: Catalog/Products** | Nuxt 3 + Vue 3 | Form-heavy, SEO product pages | 3004 | SSR/SSG |
| **MFE: Users/IAM Admin** | Angular 19 | Complex ABAC forms, Reactive Forms | 3005 | CSR |
| **MFE: Marketing** | Astro 5 | Static site, SEO-first, zero JS by default | 3006 | SSG |

---

## 2. MONOREPO STRUCTURE & WORKSPACE SETUP

### 2.1. Cấu trúc thư mục gốc

```
source_micro_fe/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # CI: lint, test, build tất cả apps
│       ├── cd-staging.yml             # CD: deploy staging khi merge vào develop
│       └── cd-production.yml          # CD: deploy production khi tag release
├── apps/
│   ├── shell/                         # Next.js 15 – Host App
│   ├── mfe-auth/                      # React 19 + Vite – Auth App
│   ├── mfe-pos/                       # React 19 + Vite – POS App
│   ├── mfe-erp/                       # Next.js 15 – ERP Dashboard
│   ├── mfe-catalog/                   # Nuxt 3 – Catalog/Products
│   ├── mfe-users/                     # Angular 19 – User Management
│   └── mfe-marketing/                 # Astro 5 – Landing Pages
├── packages/
│   ├── ui/                            # @nexus/ui – Design System
│   ├── api-client/                    # @nexus/api-client – HTTP + WS client
│   ├── auth/                          # @nexus/auth – Auth state & guards
│   ├── utils/                         # @nexus/utils – Shared utilities
│   └── types/                         # @nexus/types – Shared TypeScript types
├── tooling/
│   ├── eslint-config/                 # @nexus/eslint-config
│   ├── tsconfig/                      # @nexus/tsconfig
│   └── vitest-config/                 # @nexus/vitest-config
├── pnpm-workspace.yaml
├── package.json                       # Root package.json
├── turbo.json                         # Turborepo config
├── .env.example
└── README.md
```

### 2.2. pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tooling/*'
```

### 2.3. Root package.json

```json
{
  "name": "nexus-micro-fe",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:shell": "pnpm --filter @nexus/shell dev",
    "dev:mfe-auth": "pnpm --filter @nexus/mfe-auth dev",
    "dev:mfe-pos": "pnpm --filter @nexus/mfe-pos dev",
    "dev:mfe-erp": "pnpm --filter @nexus/mfe-erp dev",
    "dev:mfe-catalog": "pnpm --filter @nexus/mfe-catalog dev",
    "dev:mfe-users": "pnpm --filter @nexus/mfe-users dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

### 2.4. turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", ".output/**"], "cache": true },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "lint": { "outputs": [] },
    "type-check": { "dependsOn": ["^build"], "outputs": [] },
    "clean": { "cache": false }
  }
}
```

### 2.5. Bootstrap Commands

```bash
npm install -g pnpm@9
pnpm install
pnpm --filter "@nexus/types" build
pnpm --filter "@nexus/utils" build
pnpm --filter "@nexus/api-client" build
pnpm --filter "@nexus/auth" build
pnpm --filter "@nexus/ui" build
pnpm dev
```

---

## 3. SHARED PACKAGES (INTERNAL LIBRARIES)

### 3.1. @nexus/types – Shared TypeScript Types

**File:** `packages/types/src/index.ts`

```typescript
// ── Auth & Identity ──
export interface User {
  id: string; email: string; firstName: string; lastName: string;
  roles: Role[]; permissions: Permission[];
  tenantId: string; mfaEnabled: boolean;
}
export type Role = 'superadmin' | 'tenant_admin' | 'manager' | 'cashier' | 'staff';
export interface Permission {
  resource: 'ORDER' | 'PRODUCT' | 'USER' | 'INVENTORY' | 'REPORT' | 'TENANT';
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  conditions?: Record<string, unknown>;
}
export interface AuthTokens {
  accessToken: string; refreshToken: string; expiresIn: number; tokenType: 'Bearer';
}
export interface LoginRequest {
  username: string; password?: string;
  authMethod: 'PASSWORD' | 'PASSKEY' | 'SSO'; tenantId?: string;
}
export interface LoginResponse {
  tokens: AuthTokens; user: User; mfaRequired: boolean; mfaSessionId?: string;
}

// ── Multi-Tenancy ──
export interface Tenant {
  id: string; name: string; slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'; logoUrl?: string; primaryColor?: string;
}

// ── Products & Catalog ──
export interface Product {
  id: string; sku: string; name: string; description?: string;
  price: number; categoryId: string; imageUrls: string[];
  stock: number; version: number; tenantId: string;
  createdAt: string; updatedAt: string;
}
export interface Category { id: string; name: string; parentId?: string; slug: string; }

// ── Orders ──
export interface Order {
  id: string; orderNumber: string; status: OrderStatus;
  items: OrderItem[]; totalAmount: number; discountAmount: number; taxAmount: number;
  customerId?: string; cashierId: string; tenantId: string; sagaId?: string; createdAt: string;
}
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED_INVENTORY' | 'FAILED_PAYMENT' | 'CANCELLED' | 'REFUNDED';
export interface OrderItem {
  productId: string; sku: string; name: string;
  quantity: number; unitPrice: number; discount: number; subtotal: number;
}

// ── Saga & Async ──
export interface SagaStatus {
  orderId: string; sagaId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED_INSUFFICIENT_INVENTORY' | 'FAILED_PAYMENT';
  currentStep: string; progressPercentage: number; errorMessage?: string;
}

// ── Inventory ──
export interface InventoryItem {
  productId: string; sku: string; quantity: number;
  reservedQuantity: number; availableQuantity: number;
  warehouseId: string; version: number;
}

// ── API Response Wrappers ──
export interface PagedResponse<T> {
  content: T[]; totalElements: number; totalPages: number; page: number; size: number;
}
export interface ProblemDetail {
  type: string; title: string; status: number; detail: string;
  traceId?: string; errors?: Record<string, string>;
}

// ── Notifications & SSE ──
export interface Notification {
  id: string; type: 'ORDER_COMPLETED' | 'LOW_STOCK' | 'PAYMENT_FAILED' | 'SAGA_UPDATE';
  title: string; body: string; read: boolean;
  payload?: Record<string, unknown>; createdAt: string;
}
```

### 3.2. @nexus/utils – Shared Utilities

```typescript
// packages/utils/src/index.ts
import type { ProblemDetail } from '@nexus/types';

export const formatCurrency = (amount: number, currency = 'VND'): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);

export const formatDate = (date: string | Date, locale = 'vi-VN'): string =>
  new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(date));

export const handleRFC7807Errors = <T extends Record<string, unknown>>(
  problem: ProblemDetail,
  setError: (field: keyof T, error: { type: string; message: string }) => void
): void => {
  if (problem.errors) {
    Object.entries(problem.errors).forEach(([field, message]) => {
      setError(field as keyof T, { type: 'server', message });
    });
  }
};

export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, delay: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => { clearTimeout(timeout); timeout = setTimeout(() => fn(...args), delay); };
};

export const storage = {
  get: <T>(key: string): T | null => { try { const i = localStorage.getItem(key); return i ? JSON.parse(i) as T : null; } catch { return null; } },
  set: <T>(key: string, value: T): void => localStorage.setItem(key, JSON.stringify(value)),
  remove: (key: string): void => localStorage.removeItem(key),
};

export { clsx as cn } from 'clsx';
```

### 3.3. @nexus/api-client – HTTP Client

```typescript
// packages/api-client/src/index.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { ProblemDetail } from '@nexus/types';

class ApiClient {
  private instance: AxiosInstance;
  private authToken: string | null = null;
  private tenantId: string | null = null;

  constructor(baseURL: string) {
    this.instance = axios.create({ baseURL, timeout: 30_000, headers: { 'Content-Type': 'application/json' } });

    this.instance.interceptors.request.use((config) => {
      config.headers['X-Trace-ID'] = uuidv4();
      if (this.authToken) config.headers.Authorization = `Bearer ${this.authToken}`;
      if (this.tenantId) config.headers['X-Tenant-ID'] = this.tenantId;
      return config;
    });

    this.instance.interceptors.response.use(
      (res) => res.data,
      async (error: AxiosError<ProblemDetail>) => {
        if (error.response?.status === 401) window.dispatchEvent(new CustomEvent('nexus:token-expired'));
        const traceId = error.response?.headers?.['x-trace-id'];
        return Promise.reject({ ...error, traceId });
      }
    );
  }

  setAuthToken(token: string) { this.authToken = token; }
  setTenantId(id: string) { this.tenantId = id; }
  clearAuthToken() { this.authToken = null; }
  get<T>(url: string, params?: Record<string, unknown>): Promise<T> { return this.instance.get(url, { params }) as Promise<T>; }
  post<T>(url: string, data?: unknown): Promise<T> { return this.instance.post(url, data) as Promise<T>; }
  put<T>(url: string, data?: unknown): Promise<T> { return this.instance.put(url, data) as Promise<T>; }
  patch<T>(url: string, data?: unknown): Promise<T> { return this.instance.patch(url, data) as Promise<T>; }
  delete<T>(url: string): Promise<T> { return this.instance.delete(url) as Promise<T>; }
}

export const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080');
export { fetchEventSource } from '@microsoft/fetch-event-source';

export const queryKeys = {
  products: {
    all: (t: string) => [t, 'products'],
    list: (t: string, f?: object) => [t, 'products', 'list', f],
    detail: (t: string, id: string) => [t, 'products', id],
  },
  orders: {
    all: (t: string) => [t, 'orders'],
    list: (t: string, f?: object) => [t, 'orders', 'list', f],
    detail: (t: string, id: string) => [t, 'orders', id],
  },
  users: { all: (t: string) => [t, 'users'], detail: (t: string, id: string) => [t, 'users', id] },
  inventory: { byProduct: (t: string, pid: string) => [t, 'inventory', pid] },
  notifications: { all: (t: string) => [t, 'notifications'] },
} as const;
```

### 3.4. @nexus/auth – Auth State & Guards

```typescript
// packages/auth/src/index.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { User, AuthTokens, Permission, LoginRequest, LoginResponse } from '@nexus/types';
import { apiClient } from '@nexus/api-client';

interface AuthState {
  user: User | null; tokens: AuthTokens | null; tenantId: string | null; isAuthenticated: boolean;
  setAuth: (user: User, tokens: AuthTokens, tenantId: string) => void;
  clearAuth: () => void;
  refreshTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(persist((set, get) => ({
    user: null, tokens: null, tenantId: null, isAuthenticated: false,
    setAuth: (user, tokens, tenantId) => {
      set({ user, tokens, tenantId, isAuthenticated: true });
      apiClient.setAuthToken(tokens.accessToken);
    },
    clearAuth: () => {
      set({ user: null, tokens: null, tenantId: null, isAuthenticated: false });
      apiClient.clearAuthToken();
    },
    refreshTokens: async () => {
      const { tokens } = get();
      if (!tokens?.refreshToken) { get().clearAuth(); return; }
      try {
        const t = await apiClient.post<AuthTokens>('/api/v1/auth/refresh', { refreshToken: tokens.refreshToken });
        set({ tokens: t }); apiClient.setAuthToken(t.accessToken);
      } catch { get().clearAuth(); }
    },
  }), { name: 'nexus-auth', skipHydration: true }))
);

export const useGuard = (resource: Permission['resource'], action: Permission['action'], context?: { createdBy?: string }): boolean => {
  const user = useAuthStore((s) => s.user);
  return useMemo(() => {
    if (!user) return false;
    const perm = user.permissions.find(p => p.resource === resource && p.action === action);
    if (!perm) return false;
    if (perm.conditions?.ownerId === 'SELF' && context?.createdBy) return context.createdBy === user.id;
    return true;
  }, [user, resource, action, context]);
};

export const useAuthMutation = () => {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: (req: LoginRequest) => apiClient.post<LoginResponse>('/api/v1/auth/login', req),
    onSuccess: (data) => { if (!data.mfaRequired) setAuth(data.user, data.tokens, data.user.tenantId); },
  });
};
```

---

## 4. MFE APPS – CHI TIẾT TỪNG APP

### 4.1. SHELL APP (Next.js 15) – Port 3000

**Mục đích:** Entry point duy nhất, điều phối routing, xử lý auth session, render remote MFEs.

```
apps/shell/
├── src/
│   ├── app/
│   │   ├── (public)/page.tsx              # Landing redirect
│   │   ├── [tenantId]/
│   │   │   ├── layout.tsx                 # Tenant layout (sidebar/header)
│   │   │   ├── pos/page.tsx               # Load MFE: POS
│   │   │   ├── erp/dashboard/page.tsx     # Load MFE: ERP
│   │   │   ├── erp/products/page.tsx      # Load MFE: Catalog
│   │   │   ├── erp/inventory/page.tsx     # Load MFE: Catalog
│   │   │   └── erp/users/page.tsx         # Load MFE: Users
│   │   ├── layout.tsx
│   │   └── error.tsx
│   ├── components/
│   │   ├── Shell/AppShell.tsx, TenantHeader.tsx, Sidebar.tsx
│   │   └── MfeLoader/MfeWrapper.tsx       # ErrorBoundary + Suspense
│   ├── middleware.ts                      # Edge: Auth + Tenant extraction
│   └── lib/session.ts
├── next.config.ts                         # Module Federation host config
└── package.json
```

**middleware.ts (Edge Auth Guard):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
export const config = { matcher: ['/((?!_next|api|favicon|public).*)'] };
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') ?? '';
  const tenantSlug = hostname.split('.')[0];
  if (['/login', '/register', '/'].some(r => pathname.startsWith(r))) return NextResponse.next();
  // Check session cookie for accessToken...
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantSlug);
  return response;
}
```

**MfeWrapper.tsx:**
```tsx
'use client';
import { Suspense, lazy, ComponentType } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export const MfeWrapper = ({ loader }: { loader: () => Promise<{ default: ComponentType }> }) => {
  const Remote = lazy(loader);
  return (
    <ErrorBoundary fallback={<div>Module load failed. <button>Retry</button></div>}>
      <Suspense fallback={<div className="animate-pulse">Đang tải...</div>}>
        <Remote />
      </Suspense>
    </ErrorBoundary>
  );
};
```

**Dependencies:** `next@^15`, `react@^19`, `iron-session@^8`, `react-error-boundary@^4`, `@nexus/ui`, `@nexus/auth`, `@nexus/types`

---

### 4.2. MFE-AUTH (React 19 + Vite 6) – Port 3001

**Mục đích:** Login (password/passkey/SSO), MFA (TOTP), Đổi mật khẩu.

```
apps/mfe-auth/src/
├── features/
│   ├── login/LoginPage.tsx, LoginForm.tsx, PasskeyButton.tsx, SsoButton.tsx
│   ├── mfa/MfaVerifyPage.tsx, TotpInput.tsx
│   └── reset-password/ForgotPasswordPage.tsx, ResetPasswordPage.tsx
├── lib/passkey.ts, auth-api.ts
├── App.tsx (react-router v7)
└── bootstrap.tsx                   # Module Federation bootstrap
```

**Key Libs:** `react-hook-form` + `zod`, `@simplewebauthn/browser`, `react-router@7`, `react-hot-toast`

---

### 4.3. MFE-POS (React 19 + Vite 6) – Port 3002

**Mục đích:** Point of Sale – realtime, cart management, order + saga processing.

```
apps/mfe-pos/src/
├── features/
│   ├── cart/CartPanel.tsx, CartItem.tsx, CartSummary.tsx, store/cart.store.ts
│   ├── product-grid/ProductGrid.tsx, ProductCard.tsx, SearchBar.tsx
│   ├── checkout/CheckoutModal.tsx, PaymentSelector.tsx, SagaProgress.tsx
│   └── realtime/useOrderSse.ts
├── App.tsx
└── bootstrap.tsx
```

**Key Libs:** `zustand`, `@tanstack/react-query`, `@tanstack/react-table`, `framer-motion`, `react-hot-toast`

**Cart Store (Zustand):**
```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Product, OrderItem } from '@nexus/types';

interface CartState {
  items: OrderItem[]; checkoutStatus: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED'; sagaId: string | null;
  addItem: (product: Product) => void;
  updateQuantity: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  totalAmount: () => number;
}

export const useCartStore = create<CartState>()(
  devtools(persist((set, get) => ({
    items: [], checkoutStatus: 'IDLE', sagaId: null,
    addItem: (product) => set((s) => {
      const ex = s.items.find(i => i.productId === product.id);
      if (ex) return { items: s.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice } : i) };
      return { items: [...s.items, { productId: product.id, sku: product.sku, name: product.name, quantity: 1, unitPrice: product.price, discount: 0, subtotal: product.price }] };
    }),
    updateQuantity: (pid, qty) => set((s) => ({ items: qty <= 0 ? s.items.filter(i => i.productId !== pid) : s.items.map(i => i.productId === pid ? { ...i, quantity: qty, subtotal: qty * i.unitPrice - i.discount } : i) })),
    removeItem: (pid) => set((s) => ({ items: s.items.filter(i => i.productId !== pid) })),
    clearCart: () => set({ items: [], checkoutStatus: 'IDLE', sagaId: null }),
    totalAmount: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),
  }), { name: 'nexus-pos-cart', skipHydration: true }))
);
```

---

### 4.4. MFE-ERP (Next.js 15) – Port 3003

**Mục đích:** Dashboard, Analytics, Revenue charts, Order overview, Reports.

```
apps/mfe-erp/src/app/
├── dashboard/page.tsx, RealtimeRevenue.tsx    # KPI + SSE chart
├── reports/page.tsx, OrdersTable.tsx          # TanStack Table + export
└── layout.tsx
```

**Key Libs:** `recharts`, `@tanstack/react-table`, `@microsoft/fetch-event-source`, `date-fns`, `react-day-picker`

---

### 4.5. MFE-CATALOG (Nuxt 3 + Vue 3) – Port 3004

**Mục đích:** Quản lý Sản phẩm/Danh mục – CRUD, upload ảnh, variants.

```
apps/mfe-catalog/
├── pages/products/index.vue, create.vue, [id]/edit.vue
├── pages/categories/index.vue
├── composables/useProducts.ts, useProductForm.ts
└── components/ProductForm.vue, ProductTable.vue, CategoryTree.vue
```

**Key Libs:** `@tanstack/vue-query`, `vee-validate` + `zod`, `@vueuse/core`, `vue-final-modal`, `dropzone-vue`

---

### 4.6. MFE-USERS (Angular 19) – Port 3005

**Mục đích:** Quản lý User, Roles, ABAC permission builder.

```
apps/mfe-users/src/app/
├── features/user-list/, user-form/, permission-builder/
├── services/user.service.ts, permission.service.ts
└── app.routes.ts
```

**Key Libs:** `@angular/forms` (Reactive), `@ngrx/store` + `@ngrx/effects`, `ag-grid-angular`, `@angular/cdk`

---

### 4.7. MFE-MARKETING (Astro 5) – Port 3006

**Mục đích:** Landing page, SEO-first, zero JS runtime.

```
apps/mfe-marketing/src/
├── pages/index.astro, features.astro, pricing.astro, blog/[slug].astro
├── layouts/BaseLayout.astro
└── components/Hero.astro, PricingCard.astro
```

---

## 5. MODULE FEDERATION CONFIG (HOST + REMOTES)

### 5.1. Shell Host – next.config.ts

```typescript
import { NextFederationPlugin } from '@module-federation/nextjs-mf';
const nextConfig = {
  webpack(config) {
    config.plugins.push(new NextFederationPlugin({
      name: 'shell', filename: 'static/chunks/remoteEntry.js',
      remotes: {
        mfeAuth: `mfeAuth@${process.env.NEXT_PUBLIC_MFE_AUTH_URL}/remoteEntry.js`,
        mfePos: `mfePos@${process.env.NEXT_PUBLIC_MFE_POS_URL}/remoteEntry.js`,
        mfeErp: `mfeErp@${process.env.NEXT_PUBLIC_MFE_ERP_URL}/remoteEntry.js`,
        mfeCatalog: `mfeCatalog@${process.env.NEXT_PUBLIC_MFE_CATALOG_URL}/remoteEntry.js`,
        mfeUsers: `mfeUsers@${process.env.NEXT_PUBLIC_MFE_USERS_URL}/remoteEntry.js`,
      },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }));
    return config;
  },
};
export default nextConfig;
```

### 5.2. MFE Remote (Vite) – vite.config.ts

```typescript
import federation from '@originjs/vite-plugin-federation';
export default defineConfig({
  plugins: [react(), federation({
    name: 'mfePos', filename: 'remoteEntry.js',
    exposes: { './PosApp': './src/bootstrap.tsx' },
    shared: { react: { singleton: true }, 'react-dom': { singleton: true }, zustand: { singleton: true } },
  })],
  server: { port: 3002, cors: true },
  build: { target: 'esnext', minify: false, cssCodeSplit: false },
});
```

---

## 6. AUTH & MULTI-TENANCY STRATEGY

- **Zustand singleton** shared qua Module Federation `shared` config
- **Auth flow:** Login → (MFA optional) → setAuth → Redirect to `/{tenantId}/dashboard`
- **Token refresh:** Auto via API client interceptor (401 → dispatch `nexus:token-expired` event)
- **Multi-tenancy:** Extract từ subdomain/path → `X-Tenant-ID` header trên mọi API call
- **ABAC Guard:** `useGuard(resource, action, context)` hook check permission trước render

---

## 7. API CLIENT LAYER

Xem code chi tiết ở mục 3.3. Tóm tắt:
- **Axios instance** với auto `Authorization`, `X-Tenant-ID`, `X-Trace-ID` headers
- **Token refresh** tự động khi nhận 401
- **RFC 7807** error mapping helper
- **Query Keys factory** chuẩn hóa cho TanStack Query
- **SSE client** via `@microsoft/fetch-event-source` (auto retry)

---

## 8. DESIGN SYSTEM (@nexus/ui)

**Tech:** React + Tailwind CSS + CVA (Class Variance Authority)

```
packages/ui/src/
├── components/Button/, Input/, PasswordInput/, Modal/, Toast/, Table/, Badge/, Skeleton/, Card/, DataGrid/
├── providers/NexusProvider.tsx         # QueryClient + Toaster wrapper
├── hooks/useDisclosure.ts
└── index.ts
```

Tất cả components viết bằng `cva` + `forwardRef` + `cn()` utility. Storybook cho visual testing.

---

## 9. STATE MANAGEMENT STRATEGY

| Layer | Tool | Phạm vi | Dùng khi |
|-------|------|---------|----------|
| Server State | `@tanstack/react-query` | Per-MFE | API data (products, orders) |
| Global Client | `zustand` (singleton) | Cross-MFE | Cart, Auth, Notifications |
| Local Form | `react-hook-form` + `zod` | Component | Form validation |
| URL State | `nuqs` | Per-page | Filters, pagination, search |

**StaleTime overrides:**
- Catalog: 30 phút | Orders: 30 giây | Inventory: 0 (luôn fresh) | Users: 5 phút

---

## 10. REALTIME: SSE, WEBSOCKET

```typescript
// packages/api-client/src/hooks/useSse.ts
export const useSse = <T>({ url, onMessage, enabled = true }: { url: string; onMessage: (data: T) => void; enabled?: boolean }) => {
  const abortRef = useRef<AbortController | null>(null);
  const { tokens, tenantId } = useAuthStore();
  useEffect(() => {
    if (!enabled || !tokens) return;
    abortRef.current = new AbortController();
    fetchEventSource(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, 'X-Tenant-ID': tenantId ?? '' },
      signal: abortRef.current.signal,
      onmessage(ev) { onMessage(JSON.parse(ev.data) as T); },
    });
    return () => abortRef.current?.abort();
  }, [url, enabled, tokens]);
};
```

---

## 11. TESTING STRATEGY

| Level | Tool | Mục tiêu |
|-------|------|----------|
| Unit | Vitest + Testing Library | Components, hooks, utils |
| Integration | Vitest + MSW | API calls, store interactions |
| E2E | Playwright | Critical flows (Login → POS → Checkout) |
| Visual | Storybook | Design System components |

---

## 12. CI/CD PIPELINE (GITHUB ACTIONS)

### 12.1. CI – ci.yml

```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint
      - run: pnpm turbo run type-check
      - run: pnpm turbo run test -- --coverage
      - run: pnpm turbo run build
```

### 12.2. CD Staging – cd-staging.yml

```yaml
name: CD Staging
on:
  push:
    branches: [develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile && pnpm turbo run build
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/nexus && git pull && pnpm install --frozen-lockfile && pnpm build
            pm2 restart nexus-shell nexus-mfe-erp nexus-mfe-catalog
      - name: Copy static MFE builds
        uses: appleboy/scp-action@v0.1.7
        with:
          source: "apps/mfe-pos/dist/,apps/mfe-auth/dist/"
          target: "/var/www/nexus/"
      - run: ssh ${{ secrets.VPS_HOST }} "sudo nginx -t && sudo systemctl reload nginx"
```

### 12.3. CD Production – cd-production.yml (triggered on tags `v*.*.*`)

---

## 13. HOSTING & DEPLOYMENT STRATEGY

```
Internet → Nginx (Reverse Proxy)
  ├── nexus.domain.com       → Shell (PM2:3000)
  ├── mfe-auth.internal      → Nginx static :3001
  ├── mfe-pos.internal       → Nginx static :3002
  ├── mfe-erp.internal       → Next.js (PM2:3003)
  ├── mfe-catalog.internal   → Nuxt (PM2:3004)
  ├── mfe-users.internal     → Nginx static :3005
  └── api.nexus.domain.com   → Spring Boot :8080
```

**Nginx rules:**
- `remoteEntry.js` → `Cache-Control: no-cache` (luôn load bản mới nhất)
- Static assets (`.js`, `.css`) → `Cache-Control: public, immutable, max-age=1y`
- CORS header cho Module Federation: `Access-Control-Allow-Origin: nexus.domain.com`

**PM2 ecosystem.config.js:** Shell (cluster x2, 512M), ERP (x1), Catalog (x1)

---

## 14. ENVIRONMENT VARIABLES

```bash
# .env.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_MFE_AUTH_URL=http://localhost:3001
NEXT_PUBLIC_MFE_POS_URL=http://localhost:3002
NEXT_PUBLIC_MFE_ERP_URL=http://localhost:3003
NEXT_PUBLIC_MFE_CATALOG_URL=http://localhost:3004
NEXT_PUBLIC_MFE_USERS_URL=http://localhost:3005
SESSION_SECRET=change_this_to_32_char_strong_secret
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8180
NEXT_PUBLIC_KEYCLOAK_REALM=nexus
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=nexus-frontend
NEXT_PUBLIC_ENABLE_PASSKEY=true
NEXT_PUBLIC_ENABLE_MFA=true
```

---

## 15. CHECKLIST IMPLEMENT TỪ A-Z

> **Quy ước:** Thực hiện đúng thứ tự. Mỗi ✅ là điều kiện bước tiếp.

### PHASE 0 – SETUP MONOREPO (Ngày 1)
- [ ] 0.1 Tạo cấu trúc thư mục root theo mục 2.1
- [ ] 0.2 Tạo `pnpm-workspace.yaml`, root `package.json`, `turbo.json`
- [ ] 0.3 Tạo `tooling/tsconfig/` (base + react + nextjs + vue configs)
- [ ] 0.4 Tạo `tooling/eslint-config/` (TS/React/Vue/Angular rules)
- [ ] 0.5 Tạo `tooling/vitest-config/`
- [ ] 0.6 Chạy `pnpm install` thành công
- [ ] 0.7 Tạo `.env.example` theo mục 14
- [ ] 0.8 Setup `.gitignore` cho monorepo

### PHASE 1 – SHARED PACKAGES (Ngày 1-2)
- [ ] 1.1 Build `@nexus/types` – tất cả interfaces (mục 3.1)
- [ ] 1.2 Build `@nexus/utils` – formatCurrency, RFC7807, debounce, storage
- [ ] 1.3 Build `@nexus/api-client` – Axios + interceptors + queryKeys
- [ ] 1.4 Build `@nexus/auth` – useAuthStore, useGuard, useAuthMutation
- [ ] 1.5 Build `@nexus/ui` – Button, Input, PasswordInput, Modal, Badge, Skeleton, Card
- [ ] 1.6 Unit tests cho tất cả packages (coverage > 80%)
- [ ] 1.7 Setup Storybook cho `@nexus/ui`
- [ ] 1.8 `pnpm turbo run build` – tất cả pass ✅

### PHASE 2 – SHELL APP (Ngày 2-3)
- [ ] 2.1 Init `apps/shell` (Next.js 15 + App Router + TS)
- [ ] 2.2 Cài `@module-federation/nextjs-mf`
- [ ] 2.3 Config `next.config.ts` (host + all remotes)
- [ ] 2.4 Viết `middleware.ts` (Edge auth + tenant)
- [ ] 2.5 Layout route `[tenantId]/layout.tsx` (Sidebar + Header)
- [ ] 2.6 MfeWrapper.tsx (ErrorBoundary + Suspense)
- [ ] 2.7 Route pages cho mỗi MFE domain
- [ ] 2.8 NexusProvider integration
- [ ] 2.9 Shell chạy port 3000 ✅

### PHASE 3 – MFE-AUTH (Ngày 3-4)
- [ ] 3.1 Init React 19 + Vite 6
- [ ] 3.2 Module Federation remote config
- [ ] 3.3 LoginPage + LoginForm (RHF + zod)
- [ ] 3.4 Tích hợp useAuthMutation
- [ ] 3.5 Passkey flow (@simplewebauthn/browser)
- [ ] 3.6 MFA Verify (TOTP 6-digit)
- [ ] 3.7 MSW handlers cho auth APIs
- [ ] 3.8 Tests cho login + MFA
- [ ] 3.9 Standalone port 3001 + accessible từ Shell ✅

### PHASE 4 – MFE-POS (Ngày 4-6)
- [ ] 4.1 Init React 19 + Vite 6
- [ ] 4.2 Module Federation remote
- [ ] 4.3 Implement Cart Store (Zustand) – CHÍNH XÁC theo spec
- [ ] 4.4 ProductGrid – TanStack Query + debounce search
- [ ] 4.5 CartPanel – add/remove/update + framer-motion animations
- [ ] 4.6 CheckoutModal – payment selector, submit order
- [ ] 4.7 SagaProgress – polling saga mỗi 2s
- [ ] 4.8 SSE hook – realtime orders
- [ ] 4.9 Handle 409 (conflict) + 423 (locked)
- [ ] 4.10 Playwright E2E: Login → Add → Checkout
- [ ] 4.11 Standalone port 3002 ✅

### PHASE 5 – MFE-ERP DASHBOARD (Ngày 6-7)
- [ ] 5.1 Init Next.js 15
- [ ] 5.2 KPI Dashboard (Recharts)
- [ ] 5.3 Realtime revenue SSE chart
- [ ] 5.4 Orders TanStack Table (sort/filter/page)
- [ ] 5.5 Report page + date picker + export CSV
- [ ] 5.6 Module Federation expose
- [ ] 5.7 Port 3003 ✅

### PHASE 6 – MFE-CATALOG (Ngày 7-9)
- [ ] 6.1 Init Nuxt 3
- [ ] 6.2 Install @tanstack/vue-query, vee-validate, zod, @vueuse/core
- [ ] 6.3 Composable useProducts (Vue Query)
- [ ] 6.4 ProductTable (sort/filter/search)
- [ ] 6.5 ProductForm (create/edit + image upload drag-drop)
- [ ] 6.6 CategoryTree (tree select)
- [ ] 6.7 Optimistic Locking: detect 409, conflict dialog
- [ ] 6.8 Port 3004 ✅

### PHASE 7 – MFE-USERS (Ngày 9-10)
- [ ] 7.1 Init Angular 19
- [ ] 7.2 @ngrx/store + @ngrx/effects
- [ ] 7.3 UserList (AG Grid)
- [ ] 7.4 UserForm (Reactive Forms + ABAC builder)
- [ ] 7.5 Role management UI
- [ ] 7.6 Port 3005 ✅

### PHASE 8 – MFE-MARKETING (Ngày 10)
- [ ] 8.1 Init Astro 5
- [ ] 8.2 Hero, Features, Pricing pages
- [ ] 8.3 Blog SSG
- [ ] 8.4 SEO: meta, sitemap, robots.txt
- [ ] 8.5 Port 3006 ✅

### PHASE 9 – CI/CD (Ngày 11-12)
- [ ] 9.1 `.github/workflows/ci.yml`
- [ ] 9.2 `cd-staging.yml`
- [ ] 9.3 `cd-production.yml`
- [ ] 9.4 GitHub Secrets config
- [ ] 9.5 CI pass on PR ✅
- [ ] 9.6 CD staging deploy on merge ✅

### PHASE 10 – HOSTING (Ngày 12-13)
- [ ] 10.1 Nginx config (nexus-micro-fe.conf)
- [ ] 10.2 PM2 ecosystem.config.js
- [ ] 10.3 HTTPS (Certbot Let's Encrypt)
- [ ] 10.4 Deploy PM2 apps
- [ ] 10.5 Copy static builds → /var/www/nexus/
- [ ] 10.6 Nginx reload ✅
- [ ] 10.7 Module Federation remoteEntry.js accessible ✅

### PHASE 11 – E2E TESTING (Ngày 13-14)
- [ ] 11.1 Setup Playwright
- [ ] 11.2 E2E: Full login flow (password + MFA)
- [ ] 11.3 E2E: POS checkout + saga
- [ ] 11.4 E2E: Catalog CRUD
- [ ] 11.5 E2E: Multi-tenancy data isolation
- [ ] 11.6 All E2E pass ✅

### PHASE 12 – POLISH (Ngày 14-15)
- [ ] 12.1 Bundle size audit (Lighthouse)
- [ ] 12.2 TraceID display on 5xx errors
- [ ] 12.3 Offline fallback UI
- [ ] 12.4 CORS headers verified
- [ ] 12.5 Security headers (CSP, HSTS)
- [ ] 12.6 README.md hoàn chỉnh
- [ ] 12.7 Coverage > 70%, 0 TS errors, 0 lint errors ✅

---

## PHỤ LỤC – BACKEND API REFERENCE

| Domain | Endpoint | Method | Mô tả |
|--------|----------|--------|--------|
| Auth | `/api/v1/auth/login` | POST | Login |
| Auth | `/api/v1/auth/refresh` | POST | Refresh token |
| Auth | `/api/v1/auth/mfa/verify` | POST | Verify TOTP |
| Passkey | `/api/v1/auth/passkey/register` | POST | Register passkey |
| Passkey | `/api/v1/auth/passkey/authenticate` | POST | Auth passkey |
| Users | `/api/v1/users` | GET/POST | List/Create |
| Users | `/api/v1/users/{id}` | GET/PUT/DELETE | CRUD |
| Orders | `/api/v1/orders` | GET/POST | List/Create |
| Orders | `/api/v1/orders/{id}` | GET | Detail |
| SSE | `/api/v1/sse/revenue` | GET(SSE) | Realtime revenue |
| SSE | `/api/v1/sse/orders/{id}` | GET(SSE) | Order updates |
| Notifications | `/api/v1/notifications` | GET | List |

**Bắt buộc Headers:** `Authorization: Bearer {token}`, `X-Tenant-ID: {tenantId}`, `X-Trace-ID: {uuid}`

---

**END OF DOCUMENT – Nexus Micro Frontend Plan v1.0.0**
