import { useEffect } from 'react';
import { useCartStore } from '../cart/store/cart.store';
import { useOrderSse } from '../realtime/useOrderSse';
import { motion } from 'framer-motion';

interface SagaProgressProps { onSuccess: () => void; }

export const SagaProgress = ({ onSuccess }: SagaProgressProps) => {
  const { sagaId, checkoutStatus, sagaProgress } = useCartStore();

  useOrderSse({ orderId: sagaId, enabled: checkoutStatus === 'PROCESSING' });

  useEffect(() => {
    if (checkoutStatus === 'SUCCESS') {
      const timer = setTimeout(onSuccess, 1500);
      return () => clearTimeout(timer);
    }
  }, [checkoutStatus, onSuccess]);

  const isSuccess = checkoutStatus === 'SUCCESS';
  const isFailed = checkoutStatus === 'FAILED';

  return (
    <div className="py-6 text-center space-y-4">
      {isSuccess ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-4xl">✅</div>
          <p className="text-xl font-bold text-emerald-700 mt-3">Đặt hàng thành công!</p>
        </motion.div>
      ) : isFailed ? (
        <div>
          <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center text-4xl">❌</div>
          <p className="text-xl font-bold text-red-700 mt-3">Đặt hàng thất bại</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700">Đang xử lý đơn hàng...</p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <motion.div
              className="bg-blue-600 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${sagaProgress}%` }}
              transition={{ ease: 'easeOut', duration: 0.5 }}
            />
          </div>
          <p className="text-sm text-gray-500">{sagaProgress}%</p>
        </div>
      )}
    </div>
  );
};
