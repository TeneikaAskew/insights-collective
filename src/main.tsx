
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from '@/components/ui/toaster.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'

/**
 * Retire the "System" theme for anyone who had chosen it.
 *
 * The option is gone from the menu and `enableSystem` is off, but that says
 * nothing about the browsers already holding `ic-theme: "system"`. next-themes
 * reads that value on mount, and with no system handling left it is a theme
 * name that matches neither stylesheet — the reader is stuck on whatever it
 * resolves to, with no menu entry to select and therefore no way out.
 *
 * Runs before render, so the provider only ever sees "light" or "dark". Safe to
 * keep indefinitely: once the value is rewritten this is a single failed string
 * comparison per load, and removing it later would strand anyone who had not
 * visited in between.
 */
function clearStoredSystemTheme(): void {
  try {
    if (localStorage.getItem('ic-theme') === 'system') {
      localStorage.setItem('ic-theme', 'light');
    }
  } catch {
    // Private mode or storage disabled: the default is light regardless.
  }
}

clearStoredSystemTheme();

// Remove debug logging to improve startup performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
