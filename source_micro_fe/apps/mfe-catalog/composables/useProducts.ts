// composables/useProducts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { ref, computed } from "vue";
import axios from "axios";
import type {
  Product,
  PagedResponse,
  CreateProductRequest,
  UpdateProductRequest,
  SearchParams,
} from "@nexus/types";

const useAxios = () => {
  const config = useRuntimeConfig();
  const instance = axios.create({ baseURL: config.public.apiBaseUrl });
  // Inject auth token from cookie/localStorage
  instance.interceptors.request.use((cfg) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("nexus-auth")
        ? JSON.parse(localStorage.getItem("nexus-auth")!).state?.tokens
            ?.accessToken
        : null;
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  });
  return instance;
};

export const useProducts = (params: Ref<Partial<SearchParams>>) => {
  const api = useAxios();
  return useQuery({
    queryKey: ["products", "list", params],
    queryFn: async () => {
      const { data } = await api.get<PagedResponse<Product>>(
        "/api/v1/products",
        { params: params.value },
      );
      return data;
    },
    staleTime: 1000 * 60,
  });
};

export const useProduct = (id: Ref<string>) => {
  const api = useAxios();
  return useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      const { data } = await api.get<Product>(`/api/v1/products/${id.value}`);
      return data;
    },
    enabled: computed(() => !!id.value),
  });
};

export const useCreateProduct = () => {
  const api = useAxios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProductRequest) =>
      api.post<Product>("/api/v1/products", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useUpdateProduct = () => {
  const api = useAxios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateProductRequest;
    }) =>
      api.put<Product>(`/api/v1/products/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};

export const useDeleteProduct = () => {
  const api = useAxios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
};
