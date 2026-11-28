import React from 'react';
import { useLocation } from 'react-router-dom';

class CatalogErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Course catalog unavailable</h1>
        <p role="alert">Could not open the course catalog. You can reload this page to try again, or return to the homepage.</p>
        {/* Reload explicitly: a same-URL anchor can stay in this document when
            there is a fragment, retaining React.lazy's cached rejection. */}
        <button type="button" className="underline" onClick={() => window.location.reload()}>Reload this page</button>
        <a className="underline" href="/">Go to homepage</a>
      </main>
    );
  }
}

export default function CourseCatalogBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <CatalogErrorBoundary key={location.pathname}>
      {children}
    </CatalogErrorBoundary>
  );
}
