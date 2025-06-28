import { vi } from 'vitest';

export const createMockAuthProvider = (overrides = {}) => ({
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
  ...overrides,
});

// Setup function to mock useAuth module
export const setupAuthMocks = () => {
  const mockAuthProvider = createMockAuthProvider();
  
  vi.mock('@/hooks/useAuth', () => ({
    useAuthProvider: vi.fn(() => mockAuthProvider),
    useAuth: vi.fn(() => mockAuthProvider),
  }));
  
  return mockAuthProvider;
};