import '@testing-library/jest-dom';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { resetSupabaseMock } from './mocks/supabase';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Rebuild the supabase query builder before every test so .mockResolvedValue
// overrides from one test can't leak into the next. Without this, running a
// test that did `.from().update().eq().select.mockResolvedValue(...)` would
// leave `.update()` returning a Promise for the next test, breaking chains
// like `.update(...).eq(...).select(...)` with "select is not a function".
beforeEach(() => {
  resetSupabaseMock();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock fetch
global.fetch = vi.fn();

// Mock useAuth module globally with all exports
vi.mock('@/hooks/useAuth', () => {
  const mockAuthProvider = {
    session: null,
    user: null,
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    googleSignIn: vi.fn(),
    githubSignIn: vi.fn(),
    twitterSignIn: vi.fn(),
    isAuthenticated: false,
    isAdmin: false,
    isAdminAuthenticated: false,
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
  };
  
  return {
    useAuthProvider: vi.fn(() => mockAuthProvider),
    useAuth: vi.fn(() => mockAuthProvider),
    default: vi.fn(() => mockAuthProvider),
  };
});

// Mock AuthContext module globally
vi.mock('@/contexts/AuthContext', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext(null),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: vi.fn(() => ({
      user: null,
      session: null,
      loading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      googleSignIn: vi.fn(),
      githubSignIn: vi.fn(),
      twitterSignIn: vi.fn(),
      isAuthenticated: false,
      isAdmin: false,
      isAdminAuthenticated: false,
      storeRedirectPath: vi.fn(),
      handleRedirectAfterLogin: vi.fn(),
    })),
  };
});

// Mock Supabase client GLOBALLY.
// A `vi.mock` call only reliably hoists when it lives in the test file itself or
// in this setup file. The mock object previously lived in src/test/mocks/supabase.ts
// and its inline `vi.mock` call ran too late — the real @supabase/postgrest-js was
// already loaded by the modules under test, producing "Cannot read properties of
// undefined (reading 'status')" errors from PostgrestBuilder. Registering the mock
// here guarantees it replaces the real client before any test module is imported.
//
// We reuse the single `mockSupabaseClient` factory from mocks/supabase.ts so test
// files can still do `mockSupabaseClient.from().select().eq().single.mockResolvedValue(...)`.
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseClient } = await vi.importActual<
    typeof import('./mocks/supabase')
  >('./mocks/supabase');
  return { supabase: mockSupabaseClient };
});

// Mock eventService module globally
vi.mock('@/services/eventService', () => ({
  createEvent: vi.fn().mockResolvedValue({ id: '1', title: 'Test Event' }),
  updateEvent: vi.fn().mockResolvedValue({ id: '1', title: 'Updated Event' }),
  deleteEvent: vi.fn().mockResolvedValue(true),
  getEvents: vi.fn().mockResolvedValue([]),
  getEventById: vi.fn().mockResolvedValue(null),
  registerForEvent: vi.fn().mockResolvedValue(true),
  unregisterFromEvent: vi.fn().mockResolvedValue(true),
  getEventRegistrations: vi.fn().mockResolvedValue([]),
  isUserRegisteredForEvent: vi.fn().mockResolvedValue(false),
  getEventRegistrationCount: vi.fn().mockResolvedValue(0),
}));