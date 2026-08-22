import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Đăng nhập – Nexus ERP' };

export default function LoginPage() {
  return (
    <div className="w-full h-screen bg-slate-950">
      <MfeWrapper name="Đăng nhập" url="http://localhost:3001" />
    </div>
  );
}
