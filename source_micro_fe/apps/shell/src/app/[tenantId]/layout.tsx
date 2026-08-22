import type { Metadata } from 'next';
import { Sidebar } from '@/components/Shell/Sidebar';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}

export async function generateMetadata({ params }: TenantLayoutProps): Promise<Metadata> {
  const { tenantId } = await params;
  return { title: { template: `%s | ${tenantId}`, default: tenantId } };
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenantId } = await params;
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar tenantId={tenantId} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
