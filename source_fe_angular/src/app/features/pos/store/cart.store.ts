import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { Product } from '@core/models/product.model';
import { PaymentMethod, CreateOrderRequest } from '@core/models/order.model';

// ─── Cart Item ─────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  stock: number;         // Max available
}

// ─── State ─────────────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  tenantId: string | null;
  paymentMethod: PaymentMethod;
  globalDiscount: number;
  customerName: string;
  customerPhone: string;
  note: string;
  checkoutStatus: 'idle' | 'processing' | 'success' | 'failed';
  lastOrderId: string | null;
}

const initialState: CartState = {
  items: [],
  tenantId: null,
  paymentMethod: 'CASH',
  globalDiscount: 0,
  customerName: '',
  customerPhone: '',
  note: '',
  checkoutStatus: 'idle',
  lastOrderId: null,
};

/**
 * CartStore — NgRx SignalStore for POS shopping cart.
 *
 * Design:
 * - Immutable item list updates
 * - Computed subtotal/total/item count
 * - Validates stock before adding
 * - Builds CreateOrderRequest for BE
 */
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>(initialState),

  withComputed(({ items, globalDiscount }) => ({
    itemCount: computed(() => items().reduce((sum, item) => sum + item.quantity, 0)),

    subtotal: computed(() =>
      items().reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discountAmount, 0),
    ),

    totalDiscount: computed(() =>
      items().reduce((sum, item) => sum + item.discountAmount, 0) + globalDiscount(),
    ),

    total: computed(() => {
      const sub = items().reduce(
        (sum, item) => sum + item.unitPrice * item.quantity - item.discountAmount,
        0,
      );
      return Math.max(0, sub - globalDiscount());
    }),

    isEmpty: computed(() => items().length === 0),

    hasOutOfStock: computed(() =>
      items().some((item) => item.quantity > item.stock),
    ),
  })),

  withMethods((store) => ({
    addProduct(product: Product, quantity = 1): void {
      const items = store.items();
      const existing = items.find((i) => i.productId === product.id);

      if (existing) {
        // Respect stock limits
        const newQty = Math.min(existing.quantity + quantity, existing.stock);
        patchState(store, {
          items: items.map((i) =>
            i.productId === product.id ? { ...i, quantity: newQty } : i,
          ),
        });
      } else {
        const newItem: CartItem = {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: parseFloat(product.price),
          quantity: Math.min(quantity, product.stockQuantity),
          discountAmount: 0,
          stock: product.stockQuantity,
        };
        patchState(store, { items: [...items, newItem] });
      }
    },

    updateQuantity(productId: string, quantity: number): void {
      patchState(store, {
        items: store.items().map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.max(0, Math.min(quantity, i.stock)) }
            : i,
        ).filter((i) => i.quantity > 0),
      });
    },

    removeItem(productId: string): void {
      patchState(store, {
        items: store.items().filter((i) => i.productId !== productId),
      });
    },

    setItemDiscount(productId: string, discount: number): void {
      patchState(store, {
        items: store.items().map((i) =>
          i.productId === productId ? { ...i, discountAmount: Math.max(0, discount) } : i,
        ),
      });
    },

    setPaymentMethod(method: PaymentMethod): void {
      patchState(store, { paymentMethod: method });
    },

    setGlobalDiscount(amount: number): void {
      patchState(store, { globalDiscount: Math.max(0, amount) });
    },

    setCustomer(name: string, phone: string): void {
      patchState(store, { customerName: name, customerPhone: phone });
    },

    setNote(note: string): void {
      patchState(store, { note });
    },

    setCheckoutStatus(status: CartState['checkoutStatus'], orderId?: string): void {
      patchState(store, { checkoutStatus: status, lastOrderId: orderId ?? null });
    },

    clearCart(): void {
      patchState(store, initialState);
    },

    /** Build the CreateOrderRequest payload for the BE */
    buildOrderRequest(): CreateOrderRequest {
      return {
        items: store.items().map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount || undefined,
        })),
        paymentMethod: store.paymentMethod(),
        discountAmount: store.globalDiscount() || undefined,
        customerName: store.customerName() || undefined,
        customerPhone: store.customerPhone() || undefined,
        note: store.note() || undefined,
      };
    },
  })),
);
