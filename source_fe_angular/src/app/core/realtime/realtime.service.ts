import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthStore } from '@core/auth/auth.store';
import { inject } from '@angular/core';

export interface RealtimeEvent<T = unknown> {
  type: string;
  tenantId: string;
  payload: T;
  timestamp: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * RealtimeService — Manages Server-Sent Events (SSE) connection to BE.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Tenant-scoped event filtering
 * - Connection status indicator
 * - Graceful cleanup on destroy
 *
 * BE endpoint: GET /api/v1/events/stream?tenantId={tenantId}
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly authStore = inject(AuthStore);

  private eventSource: EventSource | null = null;
  private readonly events$ = new Subject<RealtimeEvent>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  readonly status = signal<ConnectionStatus>('disconnected');

  // ─── Connection ─────────────────────────────────────────────────────────────

  connect(): void {
    const tenantId = this.authStore.tenantId();
    if (!tenantId || this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.disconnect();
    this.status.set('connecting');

    const url = `${environment.sseUrl}?tenantId=${encodeURIComponent(tenantId)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.status.set('connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data);
        this.events$.next(data);
      } catch {
        // Malformed event — skip silently
      }
    };

    this.eventSource.onerror = () => {
      this.status.set('error');
      this.disconnect();
      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.status.set('disconnected');
  }

  // ─── Events stream ───────────────────────────────────────────────────────────

  /** Observable stream of all realtime events for this tenant */
  events(): Observable<RealtimeEvent> {
    return this.events$.asObservable();
  }

  // ─── Reconnect ───────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.events$.complete();
  }
}
