import type { Metadata } from 'next';
import { MfeWrapper } from '@/components/MfeLoader/MfeWrapper';

export const metadata: Metadata = { title: 'Nhân viên – Users' };

export default function UsersPage() {
  return <MfeWrapper name="Users Nhân viên" url="http://localhost:3005/users" />;
}
