import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { User, PagedResponse, SearchParams } from '@nexus/types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${((import.meta as unknown as { env?: Record<string, string> }).env?.['VITE_API_BASE_URL']) || 'http://localhost:8080'}/api/v1`;

  private getHeaders(): HttpHeaders {
    const stored = localStorage.getItem('nexus-auth');
    const token = stored ? JSON.parse(stored)?.state?.tokens?.accessToken : null;
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  getUsers(params: Partial<SearchParams> = {}): Observable<PagedResponse<User>> {
    return this.http.get<PagedResponse<User>>(`${this.baseUrl}/users`, {
      headers: this.getHeaders(),
      params: params as Record<string, string>,
    });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  createUser(payload: Partial<User>): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users`, payload, { headers: this.getHeaders() });
  }

  updateUser(id: string, payload: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/${id}`, payload, { headers: this.getHeaders() });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }
}
