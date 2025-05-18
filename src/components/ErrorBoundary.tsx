import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-destructive bg-destructive/10 p-6 text-destructive">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm text-white hover:bg-destructive/90"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 