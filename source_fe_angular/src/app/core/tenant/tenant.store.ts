import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { TenantConfig } from '@core/models/tenant.model';

interface TenantState {
  tenantId: string | null;
  config: TenantConfig | null;
  configLoaded: boolean;
}

const initialState: TenantState = {
  tenantId: null,
  config: null,
  configLoaded: false,
};

/**
 * TenantStore — NgRx SignalStore for tenant context.
 * Provides branding, feature flags, and tenant identity to the entire app.
 */
export const TenantStore = signalStore(
  { providedIn: 'root' },
  withState<TenantState>(initialState),

  withComputed(({ config }) => ({
    companyName: computed(() => config()?.companyName ?? 'Nexus ERP'),
    logo: computed(() => config()?.logo ?? ''),
    currency: computed(() => config()?.currency ?? 'VND'),
    locale: computed(() => config()?.locale ?? 'vi'),
    features: computed(() => config()?.features ?? []),
    plan: computed(() => config()?.plan ?? 'basic'),
  })),

  withMethods((store) => ({
    setConfig(config: TenantConfig): void {
      patchState(store, {
        tenantId: config.tenantId,
        config,
        configLoaded: true,
      });
    },

    setTenantId(tenantId: string): void {
      patchState(store, { tenantId });
    },

    hasFeature(feature: string): boolean {
      return store.features().includes(feature as never);
    },

    reset(): void {
      patchState(store, initialState);
    },
  })),
);
