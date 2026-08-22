import type { Metadata } from 'next';
import { NexusProvider } from '@nexus/ui';

export const metadata: Metadata = { title: { template: '%s | ERP', default: 'ERP Dashboard' } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body style={{ fontFamily: 'Inter, sans-serif', margin: 0 }}>
        <NexusProvider>{children}</NexusProvider>
      </body>
    </html>
  );
}
