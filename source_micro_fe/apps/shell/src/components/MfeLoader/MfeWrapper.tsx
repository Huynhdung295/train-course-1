'use client';

import { Suspense, useState, useEffect, type ComponentType } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Skeleton } from '@nexus/ui';

interface MfeWrapperProps {
  name: string;
  url?: string;
  loader?: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
}

const MfeFallback = ({ error, resetErrorBoundary, name }: FallbackProps & { name?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl mb-4">⚠️</div>
    <h2 className="text-lg font-semibold text-gray-900">
      {name ? `Không thể tải ${name}` : 'Không thể tải module'}
    </h2>
    <p className="mt-2 text-sm text-gray-500 max-w-sm">{error.message}</p>
    <button
      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
      onClick={resetErrorBoundary}
    >
      Thử lại
    </button>
  </div>
);

const DefaultFallback = () => (
  <div className="p-6 space-y-3">
    <Skeleton variant="title" />
    <Skeleton variant="text" count={3} />
    <Skeleton variant="card" />
  </div>
);

export const MfeWrapper = ({ name, url, loader, fallback }: MfeWrapperProps) => {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loader) {
      loader()
        .then((mod) => {
          setComponent(() => mod.default);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [loader]);

  if (url) {
    return (
      <iframe
        src={url}
        title={name}
        className="w-full h-full min-h-[calc(100vh-20px)] border-0"
        style={{ height: 'calc(100vh - 4px)', width: '100%' }}
      />
    );
  }

  if (loading) return fallback ?? <DefaultFallback />;

  if (Component) {
    return (
      <ErrorBoundary FallbackComponent={(props) => <MfeFallback {...props} name={name} />}>
        <Suspense fallback={fallback ?? <DefaultFallback />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return fallback ?? <DefaultFallback />;
};
