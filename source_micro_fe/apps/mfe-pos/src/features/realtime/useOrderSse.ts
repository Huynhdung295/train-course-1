import { useEffect, useRef } from 'react';
import { fetchEventSource } from '@nexus/api-client';
import { useAuthStore } from '@nexus/auth';
import type { SagaStatus } from '@nexus/types';
import { useCartStore } from '../cart/store/cart.store';

interface UseOrderSseOptions {
  orderId: string | null;
  enabled?: boolean;
}

export const useOrderSse = ({ orderId, enabled = true }: UseOrderSseOptions) => {
  const abortRef = useRef<AbortController | null>(null);
  const { tokens, tenantId } = useAuthStore();
  const { setSagaProgress, setCheckoutStatus } = useCartStore();

  useEffect(() => {
    if (!enabled || !orderId || !tokens) return;

    abortRef.current = new AbortController();

    fetchEventSource(
      `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}/api/v1/sse/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'X-Tenant-ID': tenantId ?? '',
        },
        signal: abortRef.current.signal,
        onmessage(ev) {
          try {
            const data = JSON.parse(ev.data) as SagaStatus;
            setSagaProgress(data.progressPercentage);
            if (data.status === 'COMPLETED') {
              setCheckoutStatus('SUCCESS');
              abortRef.current?.abort();
            } else if (data.status.startsWith('FAILED')) {
              setCheckoutStatus('FAILED');
              abortRef.current?.abort();
            }
          } catch {
            // ignore parse errors
          }
        },
        onerror(err) {
          console.error('[SSE Order]', err);
          throw err; // fetchEventSource retries automatically
        },
      },
    );

    return () => abortRef.current?.abort();
  }, [orderId, enabled, tokens, tenantId, setSagaProgress, setCheckoutStatus]);
};
