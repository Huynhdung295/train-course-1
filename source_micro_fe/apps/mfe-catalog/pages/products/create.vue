<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/products" class="text-gray-500 hover:text-gray-900">← Quay lại</NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">{{ isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm' }}</h1>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <form @submit="onSubmit" class="space-y-5">
        <!-- Basic Info -->
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
            <input v-bind="nameField" type="text" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập tên sản phẩm" />
            <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
            <input v-bind="skuField" type="text" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.sku" class="mt-1 text-xs text-red-500">{{ errors.sku }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Giá bán *</label>
            <input v-bind="priceField" type="number" min="0" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.price" class="mt-1 text-xs text-red-500">{{ errors.price }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Số lượng kho *</label>
            <input v-bind="stockField" type="number" min="0" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p v-if="errors.stock" class="mt-1 text-xs text-red-500">{{ errors.stock }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Giá vốn</label>
            <input v-bind="costPriceField" type="number" min="0" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
            <input v-bind="unitField" type="text" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Cái, Hộp, Kg..." />
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
          <textarea v-bind="descriptionField" rows="3" class="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <!-- Submit -->
        <div class="flex justify-end gap-3 pt-2">
          <NuxtLink to="/products" class="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Hủy</NuxtLink>
          <button type="submit" :disabled="isSubmitting" class="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
            {{ isSubmitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { useCreateProduct, useUpdateProduct } from '~/composables/useProducts';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => route.path.includes('/edit'));

useHead({ title: computed(() => isEdit.value ? 'Chỉnh sửa' : 'Thêm sản phẩm') });

const schema = toTypedSchema(z.object({
  name: z.string().min(1, 'Tên sản phẩm không được trống'),
  sku: z.string().min(1, 'SKU không được trống'),
  price: z.number({ invalid_type_error: 'Nhập số' }).positive('Giá phải > 0'),
  stock: z.number({ invalid_type_error: 'Nhập số' }).nonnegative('Kho không âm'),
  costPrice: z.number().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
}));

const { handleSubmit, defineField, errors, isSubmitting } = useForm({ validationSchema: schema });

const [nameField] = defineField('name');
const [skuField] = defineField('sku');
const [priceField] = defineField('price');
const [stockField] = defineField('stock');
const [costPriceField] = defineField('costPrice');
const [unitField] = defineField('unit');
const [descriptionField] = defineField('description');

const { mutateAsync: createProduct } = useCreateProduct();
const { mutateAsync: updateProduct } = useUpdateProduct();

const onSubmit = handleSubmit(async (values) => {
  try {
    if (isEdit.value) {
      await updateProduct({ id: route.params.id as string, payload: { ...values, version: 0 } });
    } else {
      await createProduct(values);
    }
    router.push('/products');
  } catch (err: unknown) {
    if ((err as { response?: { status?: number } }).response?.status === 409) {
      alert('⚠️ Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.');
    }
  }
});
</script>
