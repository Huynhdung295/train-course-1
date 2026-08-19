import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/auth.guard';
import { permissionGuard } from '@core/auth/permission.guard';

/**
 * App routes — Feature-based lazy loading.
 * All ERP routes protected by authGuard.
 * Auth routes protected by guestGuard (redirect if already logged in).
 *
 * Pattern: loadComponent() for leaf pages, loadChildren() for feature modules.
 */
export const routes: Routes = [
  // ─── Public routes (no auth required) ──────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('@layouts/public-layout/public-layout.component'),
    children: [
      {
        path: '',
        title: 'Trang chủ — Nexus ERP',
        loadComponent: () =>
          import('@features/public/landing/landing.component'),
      },
      {
        path: 'track-order',
        title: 'Tra cứu đơn hàng — Nexus ERP',
        loadComponent: () =>
          import('@features/public/track-order/track-order.component'),
      },
    ],
  },

  // ─── Auth routes (no auth required) ────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('@layouts/auth-layout/auth-layout.component'),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        title: 'Đăng nhập — Nexus ERP',
        loadComponent: () =>
          import('@features/auth/login/login.component'),
      },
      {
        path: 'mfa',
        title: 'Xác thực 2 bước — Nexus ERP',
        loadComponent: () =>
          import('@features/auth/mfa/mfa-verify.component'),
      },
      {
        path: 'forgot-password',
        title: 'Quên mật khẩu — Nexus ERP',
        loadComponent: () =>
          import('@features/auth/forgot-password/forgot-password.component'),
      },
    ],
  },

  // ─── App routes (auth required) ─────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@layouts/app-shell/app-shell.component'),
    children: [
      // Removed redirectTo: 'dashboard' so it doesn't conflict with root landing page.
      // Logged-in users will be explicitly redirected to /dashboard upon login.

      {
        path: 'dashboard',
        title: 'Dashboard — Nexus ERP',
        loadComponent: () =>
          import('@features/dashboard/dashboard.component'),
      },

      {
        path: 'pos',
        title: 'Bán hàng POS — Nexus ERP',
        canActivate: [permissionGuard('ORDER', 'CREATE')],
        loadComponent: () =>
          import('@features/pos/pos.component'),
      },

      {
        path: 'products',
        canActivate: [permissionGuard('PRODUCT', 'READ')],
        children: [
          {
            path: '',
            title: 'Sản phẩm — Nexus ERP',
            loadComponent: () =>
              import('@features/products/product-list/product-list.component'),
          },
          {
            path: 'new',
            title: 'Thêm sản phẩm — Nexus ERP',
            canActivate: [permissionGuard('PRODUCT', 'CREATE')],
            loadComponent: () =>
              import('@features/products/product-form/product-form.component'),
          },
          {
            path: ':id',
            title: 'Chi tiết sản phẩm — Nexus ERP',
            loadComponent: () =>
              import('@features/products/product-detail/product-detail.component'),
          },
          {
            path: ':id/edit',
            title: 'Sửa sản phẩm — Nexus ERP',
            canActivate: [permissionGuard('PRODUCT', 'UPDATE')],
            loadComponent: () =>
              import('@features/products/product-form/product-form.component'),
          },
        ],
      },

      {
        path: 'orders',
        canActivate: [permissionGuard('ORDER', 'READ')],
        children: [
          {
            path: '',
            title: 'Đơn hàng — Nexus ERP',
            loadComponent: () =>
              import('@features/orders/order-list/order-list.component'),
          },
          {
            path: ':id',
            title: 'Chi tiết đơn hàng — Nexus ERP',
            loadComponent: () =>
              import('@features/orders/order-detail/order-detail.component'),
          },
        ],
      },

      {
        path: 'users',
        canActivate: [permissionGuard('USER', 'READ')],
        children: [
          {
            path: '',
            title: 'Người dùng — Nexus ERP',
            loadComponent: () =>
              import('@features/users/user-list/user-list.component'),
          },
        ],
      },

      {
        path: 'settings',
        title: 'Cài đặt — Nexus ERP',
        loadComponent: () =>
          import('@features/settings/settings.component'),
      },
    ],
  },

  // ─── Utility ─────────────────────────────────────────────────────────────────
  {
    path: 'forbidden',
    title: 'Không có quyền truy cập — Nexus ERP',
    loadComponent: () =>
      import('@shared/components/error-page/error-page.component'),
    data: { errorCode: 403 },
  },

  // Catch-all
  {
    path: '**',
    title: 'Không tìm thấy — Nexus ERP',
    loadComponent: () =>
      import('@shared/components/error-page/error-page.component'),
    data: { errorCode: 404 },
  },
];
