'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, queryKeys, STALE_TIMES } from '@nexus/api-client';
import { useTenantId } from '@nexus/auth';
import type { DashboardKpi } from '@nexus/types';
import { formatCurrency, formatNumber } from '@nexus/utils';
import { Skeleton, Card, CardTitle, CardContent } from '@nexus/ui';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { RealtimeRevenue } from '@/components/charts/RealtimeRevenue';

const KPI_CARDS = [
  { key: 'totalRevenue', label: 'Doanh thu hôm nay', format: formatCurrency, icon: '💰', color: 'text-emerald-600' },
  { key: 'totalOrders', label: 'Đơn hàng', format: formatNumber, icon: '📦', color: 'text-blue-600' },
  { key: 'averageBasket', label: 'Giỏ hàng TB', format: formatCurrency, icon: '🛒', color: 'text-violet-600' },
] as const;

export default function DashboardPage() {
  const tenantId = useTenantId() ?? '';

  const { data: kpi, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.kpi(tenantId),
    queryFn: () => apiClient.get<DashboardKpi>('/api/v1/dashboard/kpi'),
    staleTime: STALE_TIMES.SHORT,
    enabled: !!tenantId,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {KPI_CARDS.map(({ key, label, format, icon, color }) => (
          <Card key={key} padding="md">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{icon}</span>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                {isLoading ? (
                  <Skeleton variant="title" className="mt-1 w-24" />
                ) : (
                  <p className={`text-2xl font-bold ${color}`}>
                    {format(kpi?.[key] ?? 0)}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime SSE chart */}
        <Card padding="md">
          <CardTitle>Doanh thu realtime</CardTitle>
          <CardContent>
            <RealtimeRevenue />
          </CardContent>
        </Card>

        {/* Hourly bar chart */}
        <Card padding="md">
          <CardTitle>Doanh thu theo giờ</CardTitle>
          <CardContent>
            {isLoading ? (
              <Skeleton variant="card" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={kpi?.revenueByHour ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card padding="md">
        <CardTitle>Top sản phẩm bán chạy</CardTitle>
        <CardContent>
          {isLoading ? (
            <Skeleton variant="text" count={5} />
          ) : (
            <div className="space-y-2">
              {kpi?.topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900">{p.name}</span>
                  <span className="text-sm font-bold text-blue-600">{formatNumber(p.sold)} sp</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
