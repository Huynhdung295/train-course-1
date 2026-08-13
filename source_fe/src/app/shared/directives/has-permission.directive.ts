import { Directive, TemplateRef, ViewContainerRef, inject, effect, input } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { PermissionResource, PermissionAction } from '@core/models/auth.model';

/**
 * HasPermissionDirective — Structural directive for ABAC permission checks.
 *
 * Usage:
 *   <button *hasPermission="'ORDER:CREATE'">Tạo đơn hàng</button>
 *   <button *hasPermission="'PRODUCT:DELETE'">Xóa sản phẩm</button>
 *   <div *hasPermission="'REPORT:EXPORT'; else noAccess">...</div>
 *
 * Permission format: 'RESOURCE:ACTION'
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authStore = inject(AuthStore);

  readonly hasPermission = input.required<`${PermissionResource}:${PermissionAction}`>();
  readonly hasPermissionElse = input<TemplateRef<unknown> | null>(null);

  constructor() {
    effect(() => {
      const permission = this.hasPermission();
      if (!permission) return;

      const [resource, action] = permission.split(':') as [PermissionResource, PermissionAction];
      const allowed = this.authStore.can(resource, action);
      const elseTemplate = this.hasPermissionElse();

      this.viewContainer.clear();

      if (allowed) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else if (elseTemplate) {
        this.viewContainer.createEmbeddedView(elseTemplate);
      }
    });
  }
}
