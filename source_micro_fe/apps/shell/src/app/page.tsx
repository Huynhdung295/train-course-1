import { redirect } from 'next/navigation';

// Root "/" redirects to login; tenant-aware redirect handled by middleware
export default function RootPage() {
  redirect('/login');
}
