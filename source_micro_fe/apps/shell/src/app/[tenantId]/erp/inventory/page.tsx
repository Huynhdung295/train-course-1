import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Kho hàng – Inventory' };

export default function InventoryPage() {
  return <MfeWrapper name="Kho hàng" url="http://localhost:3004/products" />;
}
