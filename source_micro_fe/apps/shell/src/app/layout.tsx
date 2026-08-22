import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NexusProvider } from '@nexus/ui';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { template: '%s | Nexus ERP', default: 'Nexus ERP' },
  description: 'Enterprise B2B Multi-Tenant ERP Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.className}>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <NexusProvider>{children}</NexusProvider>
      </body>
    </html>
  );
}
