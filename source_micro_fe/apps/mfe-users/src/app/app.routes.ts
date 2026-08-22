import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  { path: 'users', loadComponent: () => import('./features/user-list/user-list.component').then((m) => m.UserListComponent) },
  { path: 'users/new', loadComponent: () => import('./features/user-form/user-form.component').then((m) => m.UserFormComponent) },
  { path: 'users/:id/edit', loadComponent: () => import('./features/user-form/user-form.component').then((m) => m.UserFormComponent) },
];
