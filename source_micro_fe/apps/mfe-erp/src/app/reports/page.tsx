'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, queryKeys, STALE_TIMES } from '@nexus/api-client';
import { useTenantId } from '@nexus/auth';
import type { Order, PagedResponse } from '@nexus/types';
import { formatCurrency, formatDate } from '@nexus/utils';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { Badge, Skeleton } from '@nexus/ui';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'primary'> = {
  COMPLETED: 'success', PROCESSING: 'primary', PENDING: 'warning',
  FAILED_INVENTORY: 'danger', FAILED_PAYMENT: 'danger', CANCELLED: 'default', REFUNDED: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Hoàn thành', PROCESSING: 'Đang xử lý', PENDING: 'Chờ xử lý',
  FAILED_INVENTORY: 'Hết hàng', FAILED_PAYMENT: 'TT thất bại', CANCELLED: 'Đã hủy', REFUNDED: 'Hoàn tiền',
};

export default function ReportsPage() {
  const tenantId = useTenantId() ?? '';
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.orders.list(tenantId, { page, sort: sorting[0]?.id }),
    queryFn: () => apiClient.get<PagedResponse<Order>>('/api/v1/orders', { page, size: 20 }),
    staleTime: STALE_TIMES.SHORT,
    enabled: !!tenantId,
  });

  const columns: ColumnDef<Order>[] = [
    { accessorKey: 'orderNumber', header: 'Mã đơn', cell: ({ getValue }) => <span className="font-mono text-xs font-semibold">{getValue<string>()}</span> },
    { accessorKey: 'status', header: 'Trạng thái', cell: ({ getValue }) => <Badge variant={STATUS_VARIANT[getValue<string>()] ?? 'default'} dot>{STATUS_LABEL[getValue<string>()] ?? getValue<string>()}</Badge> },
    { accessorKey: 'totalAmount', header: 'Tổng tiền', cell: ({ getValue }) => <span className="font-semibold text-blue-600">{formatCurrency(getValue<number>())}</span> },
    { accessorKey: 'paymentMethod', header: 'TT', cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span> },
    { accessorKey: 'createdAt', header: 'Thời gian', cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDate(getValue<string>())}</span> },
  ];

  const table = useReactTable({
    data: data?.content ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? -1,
  });

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo đơn hàng</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-3"><Skeleton variant="text" count={8} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-gray-200 bg-gray-50">
                    {hg.headers.map((header) => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:text-gray-900">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Tổng {data?.totalElements ?? 0} đơn
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">← Trước</button>
            <span className="px-3 py-1.5 text-xs">{page + 1} / {data?.totalPages ?? 1}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1) - 1} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Sau →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
