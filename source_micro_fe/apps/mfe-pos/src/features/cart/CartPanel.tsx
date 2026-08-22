import { AnimatePresence, motion } from 'framer-motion';
import { useCartStore } from './store/cart.store';
import { formatCurrency } from '@nexus/utils';
import { Button } from '@nexus/ui';
import { CheckoutModal } from '../checkout/CheckoutModal';
import { useDisclosure } from '@nexus/ui';

export const CartPanel = () => {
  const { items, totalAmount, itemCount, updateQuantity, removeItem } = useCartStore();
  const checkout = useDisclosure();
  const total = totalAmount();
  const count = itemCount();

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Giỏ hàng</h2>
          <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">
            {count}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <span className="text-5xl mb-3">🛒</span>
            <p>Giỏ hàng trống</p>
            <p className="text-xs mt-1">Chọn sản phẩm để thêm vào</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.productId}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="rounded-xl bg-white border border-gray-200 p-3 shadow-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{item.name}</p>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label="Xóa"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center text-sm font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(item.subtotal)}</p>
                    {item.discount > 0 && (
                      <p className="text-[10px] text-emerald-600">−{formatCurrency(item.discount)}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-4 space-y-3">
        <div className="flex justify-between text-base font-bold">
          <span>Tổng cộng</span>
          <span className="text-blue-600 text-lg">{formatCurrency(total)}</span>
        </div>
        <Button
          fullWidth
          size="lg"
          onClick={checkout.onOpen}
          disabled={items.length === 0}
        >
          Thanh toán
        </Button>
      </div>

      <CheckoutModal isOpen={checkout.isOpen} onClose={checkout.onClose} />
    </div>
  );
};
