import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, queryKeys, STALE_TIMES } from '@nexus/api-client';
import { useTenantId } from '@nexus/auth';
import type { PagedResponse, Product } from '@nexus/types';
import { debounce } from '@nexus/utils';
import { useCartStore } from '../cart/store/cart.store';
import { ProductCard } from './ProductCard';
import { Skeleton } from '@nexus/ui';

export const ProductGrid = () => {
  const tenantId = useTenantId() ?? '';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSearchChange = useCallback(
    debounce((val: string) => setDebouncedSearch(val), 300),
    [],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.products.list(tenantId, { keyword: debouncedSearch }),
    queryFn: () =>
      apiClient.get<PagedResponse<Product>>('/api/v1/products', {
        keyword: debouncedSearch || undefined,
        size: 50,
      }),
    staleTime: STALE_TIMES.SHORT,
    enabled: !!tenantId,
  });

  const addItem = useCartStore((s) => s.addItem);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="search"
          placeholder="🔍 Tìm sản phẩm, mã SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            handleSearchChange(e.target.value);
          }}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data?.content.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={() => addItem(product)}
              />
            ))}
            {data?.content.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400">
                Không tìm thấy sản phẩm
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
