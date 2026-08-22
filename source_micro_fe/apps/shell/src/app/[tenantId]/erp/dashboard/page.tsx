import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Dashboard – ERP' };

export default function DashboardPage() {
  return <MfeWrapper name="Dashboard ERP" url="http://localhost:3003/dashboard" />;
}
