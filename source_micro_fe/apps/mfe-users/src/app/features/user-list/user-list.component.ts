import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { UserService } from '../../services/user.service';
import type { User } from '@nexus/types';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [RouterLink, AgGridAngular],
  template: `
    <div class="p-6 space-y-4 max-w-7xl mx-auto">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Nhân viên</h1>
        <a routerLink="/users/new" class="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          + Thêm nhân viên
        </a>
      </div>

      <div class="mb-3">
        <input
          (input)="onSearch($event)"
          type="search"
          placeholder="🔍 Tìm nhân viên..."
          class="w-80 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style="height: 500px;">
        <ag-grid-angular
          class="ag-theme-quartz"
          style="width: 100%; height: 100%;"
          [rowData]="users()"
          [columnDefs]="columnDefs"
          [pagination]="true"
          [paginationPageSize]="20"
          [animateRows]="true"
          [suppressCellFocus]="false"
          (gridReady)="onGridReady($event)"
        />
      </div>
    </div>
  `,
  styles: [`@import 'ag-grid-community/styles/ag-grid.css'; @import 'ag-grid-community/styles/ag-theme-quartz.css';`],
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  readonly users = signal<User[]>([]);

  columnDefs: ColDef<User>[] = [
    { field: 'firstName', headerName: 'Họ', sortable: true, filter: true, flex: 1 },
    { field: 'lastName', headerName: 'Tên', sortable: true, filter: true, flex: 1 },
    { field: 'email', headerName: 'Email', sortable: true, filter: true, flex: 2 },
    {
      field: 'roles',
      headerName: 'Vai trò',
      valueFormatter: (p) => p.value?.join(', ') ?? '',
      flex: 1,
    },
    {
      field: 'mfaEnabled',
      headerName: 'MFA',
      cellRenderer: (p: { value: boolean }) =>
        `<span class="${p.value ? 'text-emerald-600' : 'text-gray-400'} font-medium">${p.value ? '✓ Bật' : '✗ Tắt'}</span>`,
      flex: 1,
    },
    {
      headerName: 'Thao tác',
      cellRenderer: (p: { data: User }) =>
        `<div class="flex gap-2 pt-1"><a href="/users/${p.data.id}/edit" class="text-xs text-blue-600 hover:underline">Sửa</a></div>`,
      flex: 1,
      sortable: false,
    },
  ];

  ngOnInit() {
    this.userService.getUsers({ page: 0, size: 200 }).subscribe((resp) => {
      this.users.set(resp.content);
    });
  }

  onSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value.toLowerCase();
    // Quick client-side filter – for production use server-side filtering
    this.userService.getUsers({ keyword: val }).subscribe((resp) => {
      this.users.set(resp.content);
    });
  }

  onGridReady(_event: GridReadyEvent) {}
}
