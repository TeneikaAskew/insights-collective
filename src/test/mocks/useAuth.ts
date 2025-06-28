import { vi } from 'vitest';

export const mockUseAuth = {
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

export const mockUseAuthProvider = () => mockUseAuth;

// Export both named exports that the original file has
export const useAuth = mockUseAuthProvider;
export const useAuthProvider = mockUseAuthProvider;