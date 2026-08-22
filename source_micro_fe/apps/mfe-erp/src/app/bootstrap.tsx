'use client';

import DashboardPage from './dashboard/page';
import { NexusProvider } from '@nexus/ui';

export default function ErpApp() {
  return (
    <NexusProvider>
      <DashboardPage />
    </NexusProvider>
  );
}
