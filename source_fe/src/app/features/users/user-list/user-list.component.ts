import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of, combineLatest, startWith, debounceTime, switchMap, tap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '@core/http/api.service';
import { Injectable } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { PageResponse } from '@core/models/api.model';
import { Status } from '@core/models/api.model';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';

// ─── User Model ───────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: Status;
  lastLoginAt?: string;
  createdAt: string;
}

// ─── User API Service ─────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
class UserApiService extends ApiService<UserSummary> {
  protected override readonly basePath = '/api/v1/users';
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [ReactiveFormsModule, HasPermissionDirective, RelativeTimePipe, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
})
export default class UserListComponent {
  private readonly userApi = inject(UserApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);

  protected readonly searchControl = this.fb.control('');
  protected readonly statusControl = this.fb.control('');

  private readonly filterChange$ = combineLatest([
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value), debounceTime(300)),
    this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
  ]).pipe(
    switchMap(([search, status]) => {
      this.loading.set(true);
      return this.userApi.findAll({ search: search || undefined, status: status || undefined }).pipe(
        catchError(() => of(null)),
        tap(() => this.loading.set(false))
      );
    })
  );

  protected readonly page = toSignal(this.filterChange$);
  protected readonly users = computed(() => this.page()?.content ?? []);
}
