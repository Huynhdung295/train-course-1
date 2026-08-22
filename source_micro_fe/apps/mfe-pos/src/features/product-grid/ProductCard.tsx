import type { Product } from '@nexus/types';
import { formatCurrency } from '@nexus/utils';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: Product;
  onAdd: () => void;
}

export const ProductCard = ({ product, onAdd }: ProductCardProps) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    onClick={onAdd}
    className="relative flex flex-col items-center rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-blue-300 hover:shadow-md transition-colors w-full"
  >
    {product.stock <= (product.minStock ?? 5) && product.stock > 0 && (
      <span className="absolute top-2 right-2 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">
        Sắp hết
      </span>
    )}
    {product.stock === 0 && (
      <span className="absolute top-2 right-2 text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-semibold">
        Hết hàng
      </span>
    )}

    <div className="w-full aspect-square rounded-lg bg-gray-100 mb-2 overflow-hidden">
      {product.imageUrls[0] ? (
        <img
          src={product.imageUrls[0]}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
      )}
    </div>

    <p className="text-xs font-medium text-gray-900 line-clamp-2 text-center leading-tight mb-1">
      {product.name}
    </p>
    <p className="text-sm font-bold text-blue-600">{formatCurrency(product.price)}</p>
    <p className="text-[10px] text-gray-400 mt-0.5">Kho: {product.stock}</p>
  </motion.button>
);
