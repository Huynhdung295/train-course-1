import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Product, OrderItem, PaymentMethod } from '@nexus/types';

interface CartState {
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  checkoutStatus: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  sagaId: string | null;
  sagaProgress: number;

  // Actions
  addItem: (product: Product) => void;
  updateQuantity: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  applyDiscount: (productId: string, discount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  clearCart: () => void;
  setCheckoutStatus: (status: CartState['checkoutStatus'], sagaId?: string) => void;
  setSagaProgress: (progress: number) => void;

  // Computed (as functions so they always reflect fresh state)
  totalAmount: () => number;
  itemCount: () => number;
  subtotalAmount: () => number;
  discountTotal: () => number;
}

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        paymentMethod: 'CASH',
        checkoutStatus: 'IDLE',
        sagaId: null,
        sagaProgress: 0,

        addItem: (product) =>
          set((state) => {
            const existing = state.items.find((i) => i.productId === product.id);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.productId === product.id
                    ? {
                        ...i,
                        quantity: i.quantity + 1,
                        subtotal: (i.quantity + 1) * i.unitPrice - i.discount,
                      }
                    : i,
                ),
              };
            }
            return {
              items: [
                ...state.items,
                {
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  quantity: 1,
                  unitPrice: product.price,
                  discount: 0,
                  subtotal: product.price,
                },
              ],
            };
          }),

        updateQuantity: (productId, qty) =>
          set((state) => ({
            items:
              qty <= 0
                ? state.items.filter((i) => i.productId !== productId)
                : state.items.map((i) =>
                    i.productId === productId
                      ? { ...i, quantity: qty, subtotal: qty * i.unitPrice - i.discount }
                      : i,
                  ),
          })),

        removeItem: (productId) =>
          set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

        applyDiscount: (productId, discount) =>
          set((state) => ({
            items: state.items.map((i) =>
              i.productId === productId
                ? { ...i, discount, subtotal: i.quantity * i.unitPrice - discount }
                : i,
            ),
          })),

        setPaymentMethod: (method) => set({ paymentMethod: method }),

        clearCart: () =>
          set({ items: [], checkoutStatus: 'IDLE', sagaId: null, sagaProgress: 0 }),

        setCheckoutStatus: (status, sagaId) =>
          set({ checkoutStatus: status, sagaId: sagaId ?? null }),

        setSagaProgress: (progress) => set({ sagaProgress: progress }),

        // Computed
        totalAmount: () =>
          get().items.reduce((sum, i) => sum + i.subtotal, 0),
        itemCount: () =>
          get().items.reduce((sum, i) => sum + i.quantity, 0),
        subtotalAmount: () =>
          get().items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
        discountTotal: () =>
          get().items.reduce((sum, i) => sum + i.discount, 0),
      }),
      { name: 'nexus-pos-cart', skipHydration: true },
    ),
    { name: 'CartStore' },
  ),
);
