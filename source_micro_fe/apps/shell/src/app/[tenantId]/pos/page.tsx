import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'POS – Bán hàng' };

export default function PosPage() {
  return <MfeWrapper name="POS Bán hàng" url="http://localhost:3002" />;
}
