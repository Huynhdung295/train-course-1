import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantService } from '@core/tenant/tenant.service';
import { ToastContainerComponent } from '@shared/components/toast/toast-container.component';

/**
 * AppComponent — Root component.
 * Minimal by design — only bootstraps tenant context and renders router outlet.
 * All real UI lives in layout components loaded via router.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly tenantService = inject(TenantService);

  constructor() {
    // Resolve tenant from subdomain and load branding on app start
    const tenantId = this.tenantService.resolveTenantId();
    this.tenantService.loadConfig(tenantId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        error: () => {
          // Gracefully degrade — app still works with default branding
        },
      });
  }
}
