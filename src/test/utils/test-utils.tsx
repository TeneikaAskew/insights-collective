import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { PageVisibilityProvider } from '@/contexts/PageVisibilityContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { DialogsProvider } from '@/components/dialogs/DialogsProvider';
import { HelmetProvider } from 'react-helmet-async';

/**
 * This wrapper has to mirror the provider tree main.tsx actually mounts, or a
 * page that reaches for a context it has in production throws in tests only.
 *
 * HelmetProvider is the case that proved it. Pages picked up <PageSeo>, which
 * renders react-helmet-async's <Helmet>; with no provider above it,
 * HelmetDispatcher.init reads `context.helmetInstances.add` off an empty object
 * and every render under this helper died with "Cannot read properties of
 * undefined (reading 'add')" — 14 tests across Blog and CourseDetail, and any
 * page that adopts PageSeo next.
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // A fresh context per render. Helmet accumulates mounted instances into
  // whatever object it is handed, so a shared one would carry state between
  // tests — the kind of coupling that makes a suite order-dependent.
  const helmetContext = {};

  return (
    <HelmetProvider context={helmetContext}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <PageVisibilityProvider>
            <OnboardingProvider>
              <DialogsProvider>
                {children}
              </DialogsProvider>
            </OnboardingProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </HelmetProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };