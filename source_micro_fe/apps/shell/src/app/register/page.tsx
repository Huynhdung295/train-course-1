import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Đăng ký – Nexus ERP' };

export default function RegisterPage() {
  return (
    <div className="w-full h-screen bg-slate-950">
      <MfeWrapper name="Đăng ký" url="http://localhost:3001/register" />
    </div>
  );
}
