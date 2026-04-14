'use client';

import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex h-screen bg-nightshift-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <div className="card border-nightshift-error/30 text-center py-12">
              <div className="text-5xl mb-4">😔</div>
              <h1 className="text-2xl font-bold text-nightshift-text-primary mb-2">
                Something went wrong
              </h1>
              <p className="text-nightshift-text-secondary mb-6 max-w-md mx-auto">
                We encountered an error loading your dashboard. This is usually temporary.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button onClick={reset} className="btn-primary">
                  Try Again
                </button>
                <a href="/dashboard" className="btn-ghost">
                  Refresh Page
                </a>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-6 p-4 bg-nightshift-bg-light rounded-lg text-left">
                  <p className="text-xs font-mono text-nightshift-error">
                    {error.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
