'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary to prevent white screen crashes.
 * Catches errors in child components and shows fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-nightshift-text-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-nightshift-text-secondary mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-primary text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-level error fallback for dashboard sections.
 */
export function SectionErrorFallback({ section }: { section: string }) {
  return (
    <div className="card border-nightshift-warning/30">
      <div className="flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="text-sm font-medium text-nightshift-text-primary">
            Unable to load {section}
          </p>
          <p className="text-xs text-nightshift-text-muted">
            This section encountered an error. Try refreshing the page.
          </p>
        </div>
      </div>
    </div>
  );
}
