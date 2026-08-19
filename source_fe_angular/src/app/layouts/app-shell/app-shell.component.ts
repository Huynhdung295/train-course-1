import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';
import { TenantStore } from '@core/tenant/tenant.store';
import { RealtimeService } from '@core/realtime/realtime.service';
import { LoadingService } from '@core/loading/loading.service';
import { CartStore } from '@features/pos/store/cart.store';

import { SlicePipe } from '@angular/common';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  badge?: () => number | null;
}

/**
 * AppShellComponent — Main application layout.
 * Contains: sidebar navigation + header toolbar + main content area.
 * Connects to RealtimeService on init for live events.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export default class AppShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly tenantStore = inject(TenantStore);
  protected readonly realtimeService = inject(RealtimeService);
  protected readonly loadingService = inject(LoadingService);
  protected readonly cartStore = inject(CartStore);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sidebarCollapsed = signal(false);
  protected readonly userMenuOpen = signal(false);

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Bán hàng POS', icon: '🛒', route: '/pos', badge: () => this.cartStore.itemCount() || null },
    { label: 'Sản phẩm', icon: '📦', route: '/products' },
    { label: 'Đơn hàng', icon: '📋', route: '/orders' },
    { label: 'Người dùng', icon: '👥', route: '/users' },
    { label: 'Cài đặt', icon: '⚙️', route: '/settings' },
  ];

  constructor() {
    this.realtimeService.connect();
    inject(DestroyRef).onDestroy(() => this.realtimeService.disconnect());

    // Close user menu on route change
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.closeUserMenu());
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
  }
}
