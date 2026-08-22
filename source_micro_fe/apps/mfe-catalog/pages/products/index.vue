<template>
  <div class="p-6 max-w-7xl mx-auto space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Sản phẩm</h1>
      <NuxtLink to="/products/create" class="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
        + Thêm sản phẩm
      </NuxtLink>
    </div>

    <!-- Search & Filter -->
    <div class="flex gap-3">
      <input
        v-model="searchInput"
        type="search"
        placeholder="🔍 Tìm sản phẩm..."
        class="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div v-if="isLoading" class="p-6 space-y-3">
        <div v-for="i in 8" :key="i" class="h-12 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50">
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sản phẩm</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Giá</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Kho</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trạng thái</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="product in data?.content"
              :key="product.id"
              class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <img
                    v-if="product.imageUrls[0]"
                    :src="product.imageUrls[0]"
                    :alt="product.name"
                    class="w-10 h-10 rounded-lg object-cover bg-gray-100"
                  />
                  <div v-else class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">📦</div>
                  <div>
                    <p class="font-medium text-gray-900">{{ product.name }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ product.sku }}</td>
              <td class="px-4 py-3 font-semibold text-blue-600">{{ formatCurrency(product.price) }}</td>
              <td class="px-4 py-3">
                <span :class="['text-sm font-medium', product.stock <= (product.minStock ?? 5) ? 'text-amber-600' : 'text-gray-900']">
                  {{ product.stock }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600']">
                  {{ product.isActive ? 'Hoạt động' : 'Ẩn' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <NuxtLink :to="`/products/${product.id}/edit`" class="text-xs text-blue-600 hover:underline">Sửa</NuxtLink>
                  <button @click="handleDelete(product.id)" class="text-xs text-red-500 hover:underline">Xóa</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <span class="text-xs text-gray-500">Tổng {{ data?.totalElements ?? 0 }} sản phẩm</span>
        <div class="flex gap-2">
          <button @click="page = Math.max(0, page - 1)" :disabled="page === 0" class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">← Trước</button>
          <span class="px-3 py-1.5 text-xs">{{ page + 1 }} / {{ data?.totalPages ?? 1 }}</span>
          <button @click="page++" :disabled="page >= (data?.totalPages ?? 1) - 1" class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">Sau →</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useProducts, useDeleteProduct } from '~/composables/useProducts';
import { formatCurrency } from '@nexus/utils';

useHead({ title: 'Sản phẩm – Catalog' });

const page = ref(0);
const searchInput = ref('');
const keyword = ref('');

const debouncedSearch = useDebounceFn((val: string) => {
  keyword.value = val;
  page.value = 0;
}, 300);

watch(searchInput, (val) => debouncedSearch(val));

const params = computed(() => ({ page: page.value, size: 20, keyword: keyword.value || undefined }));
const { data, isLoading } = useProducts(params);
const { mutate: deleteProduct } = useDeleteProduct();

const handleDelete = (id: string) => {
  if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
    deleteProduct(id);
  }
};
</script>
