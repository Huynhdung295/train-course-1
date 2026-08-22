import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, queryKeys } from '@nexus/api-client';
import { useTenantId } from '@nexus/auth';
import type { Order, PaymentMethod } from '@nexus/types';
import { formatCurrency } from '@nexus/utils';
import { Modal, Button } from '@nexus/ui';
import { useCartStore } from '../cart/store/cart.store';
import { SagaProgress } from './SagaProgress';
import toast from 'react-hot-toast';

const PAYMENT_METHODS: { label: string; value: PaymentMethod; icon: string }[] = [
  { label: 'Tiền mặt', value: 'CASH', icon: '💵' },
  { label: 'Thẻ', value: 'CARD', icon: '💳' },
  { label: 'QR Code', value: 'QR', icon: '📱' },
  { label: 'Chuyển khoản', value: 'TRANSFER', icon: '🏦' },
];

interface CheckoutModalProps { isOpen: boolean; onClose: () => void; }

export const CheckoutModal = ({ isOpen, onClose }: CheckoutModalProps) => {
  const tenantId = useTenantId() ?? '';
  const qc = useQueryClient();
  const { items, paymentMethod, setPaymentMethod, totalAmount, setCheckoutStatus, sagaId, checkoutStatus, clearCart } = useCartStore();

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post<Order>('/api/v1/orders', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, discount: i.discount || undefined })),
        paymentMethod,
      }),
    onSuccess: (order) => {
      setCheckoutStatus('PROCESSING', order.sagaId);
      qc.invalidateQueries({ queryKey: queryKeys.products.all(tenantId) });
    },
    onError: (err: { response?: { status?: number } }) => {
      if (err.response?.status === 409) {
        toast.error('Hàng tồn kho đã thay đổi. Vui lòng kiểm tra lại.');
      } else if (err.response?.status === 423) {
        toast.error('Hệ thống đang xử lý đơn khác. Vui lòng thử lại sau.');
      } else {
        toast.error('Đặt hàng thất bại.');
      }
    },
  });

  const handleClose = () => {
    if (checkoutStatus === 'SUCCESS') clearCart();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Xác nhận thanh toán" size="md">
      {checkoutStatus === 'IDLE' || checkoutStatus === 'FAILED' ? (
        <div className="space-y-4">
          {/* Payment method */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Phương thức thanh toán</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    paymentMethod === m.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-xl bg-gray-50 p-4 flex justify-between font-bold text-lg">
            <span>Tổng thanh toán</span>
            <span className="text-blue-600">{formatCurrency(totalAmount())}</span>
          </div>

          {checkoutStatus === 'FAILED' && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              ⚠️ Đặt hàng thất bại. Vui lòng thử lại.
            </div>
          )}

          <Button fullWidth size="lg" loading={isPending} onClick={() => placeOrder()}>
            Xác nhận đặt hàng
          </Button>
        </div>
      ) : (
        <SagaProgress onSuccess={handleClose} />
      )}
    </Modal>
  );
};
