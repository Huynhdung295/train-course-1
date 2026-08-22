import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Sản phẩm – Catalog' };

export default function ProductsPage() {
  return <MfeWrapper name="Catalog Sản phẩm" url="http://localhost:3004/products" />;
}
