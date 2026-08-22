import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NexusProvider } from '@nexus/ui';
import { useAuthHydration, useTokenRefreshListener } from '@nexus/auth';
import { useCartStore } from './features/cart/store/cart.store';
import { ProductGrid } from './features/product-grid/ProductGrid';
import { CartPanel } from './features/cart/CartPanel';
import './index.css';

const PosApp = () => {
  useAuthHydration();
  useTokenRefreshListener();

  // Hydrate zustand persist on mount
  useCartStore.persist.rehydrate();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Left: Product grid */}
      <main className="flex-1 overflow-hidden">
        <ProductGrid />
      </main>

      {/* Right: Cart panel */}
      <aside className="w-80 xl:w-96 flex-shrink-0 overflow-hidden">
        <CartPanel />
      </aside>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NexusProvider>
      <PosApp />
    </NexusProvider>
  </StrictMode>,
);
