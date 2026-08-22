'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchEventSource } from '@nexus/api-client';
import { useAuthStore } from '@nexus/auth';
import { formatCurrency } from '@nexus/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenuePoint { time: string; revenue: number; }

export const RealtimeRevenue = () => {
  const [data, setData] = useState<RevenuePoint[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { tokens, tenantId } = useAuthStore();

  useEffect(() => {
    if (!tokens) return;
    abortRef.current = new AbortController();

    fetchEventSource(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/sse/revenue`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'X-Tenant-ID': tenantId ?? '',
        },
        signal: abortRef.current.signal,
        onmessage(ev) {
          const point = JSON.parse(ev.data) as RevenuePoint;
          setData((prev) => {
            const updated = [...prev, point];
            return updated.length > 20 ? updated.slice(-20) : updated;
          });
        },
      },
    );

    return () => abortRef.current?.abort();
  }, [tokens, tenantId]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-gray-500">Live</span>
        {data.length > 0 && (
          <span className="ml-auto text-lg font-bold text-emerald-600">
            {formatCurrency(data[data.length - 1]?.revenue ?? 0)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
