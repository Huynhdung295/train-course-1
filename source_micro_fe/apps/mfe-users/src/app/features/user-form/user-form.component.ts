import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import type { Role } from '@nexus/types';

const ROLES: Role[] = ['tenant_admin', 'manager', 'cashier', 'staff', 'viewer'];

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <a routerLink="/users" class="text-gray-500 hover:text-gray-900 text-sm">← Quay lại</a>
        <h1 class="text-2xl font-bold text-gray-900">{{ isEdit() ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên' }}</h1>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Họ *</label>
              <input formControlName="firstName" type="text" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p *ngIf="form.get('firstName')?.invalid && form.get('firstName')?.touched" class="mt-1 text-xs text-red-500">Bắt buộc nhập</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tên *</label>
              <input formControlName="lastName" type="text" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input formControlName="email" type="email" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p *ngIf="form.get('email')?.errors?.['email']" class="mt-1 text-xs text-red-500">Email không hợp lệ</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
            <div class="flex flex-wrap gap-2">
              <button
                *ngFor="let role of availableRoles"
                type="button"
                (click)="toggleRole(role)"
                [class]="selectedRoles().includes(role) ? 'px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 text-white' : 'px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 text-gray-700 hover:border-blue-400'"
              >{{ role }}</button>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" formControlName="mfaEnabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
              <div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
            <span class="text-sm font-medium text-gray-700">Bật xác thực 2 lớp (MFA)</span>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <a routerLink="/users" class="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">Hủy</a>
            <button type="submit" [disabled]="form.invalid || submitting()" class="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {{ submitting() ? 'Đang lưu...' : (isEdit() ? 'Cập nhật' : 'Tạo mới') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class UserFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly selectedRoles = signal<Role[]>([]);
  readonly availableRoles = ROLES;
  readonly isEdit = signal(false);

  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    mfaEnabled: [false],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.userService.getUser(id).subscribe((user) => {
        this.form.patchValue(user);
        this.selectedRoles.set(user.roles);
      });
    }
  }

  toggleRole(role: Role) {
    const current = this.selectedRoles();
    this.selectedRoles.set(
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    const payload = { ...this.form.value, roles: this.selectedRoles() };
    const id = this.route.snapshot.paramMap.get('id');
    const req = id ? this.userService.updateUser(id, payload) : this.userService.createUser(payload);
    req.subscribe({
      next: () => this.router.navigate(['/users']),
      error: () => this.submitting.set(false),
      complete: () => this.submitting.set(false),
    });
  }
}
