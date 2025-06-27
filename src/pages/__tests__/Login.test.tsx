import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import Login from '../Login';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Mock the auth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '' }),
  };
});

describe('Login Page', () => {
  const mockLogin = vi.fn();
  const mockGoogleSignIn = vi.fn();
  const mockGithubSignIn = vi.fn();
  const mockTwitterSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      googleSignIn: mockGoogleSignIn,
      githubSignIn: mockGithubSignIn,
      twitterSignIn: mockTwitterSignIn,
      isAuthenticated: false,
      user: null,
      enrichedUser: null,
      isAdmin: false,
      loading: false,
      error: null,
      logout: vi.fn(),
      register: vi.fn(),
      socialSignIn: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      storeRedirectPath: vi.fn(),
      handleRedirectAfterLogin: vi.fn(),
      session: null,
    } as any);
  });

  it('should render login form', () => {
    render(<Login />);
    
    expect(screen.getByText('Login to your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    render(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should show error for empty fields', async () => {
    render(<Login />);
    
    const loginButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter both email and password')).toBeInTheDocument();
    });
  });

  it('should toggle password visibility', () => {
    render(<Login />);
    
    const passwordInput = screen.getByLabelText('Password');
    const toggleButton = screen.getByRole('button', { name: /show password/i });
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should handle social login', async () => {
    render(<Login />);
    
    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(mockGoogleSignIn).toHaveBeenCalled();
      expect(localStorage.getItem('redirectAfterLogin')).toBe('/dashboard');
    });
  });

  it('should redirect authenticated users', () => {
    vi.mocked(useAuth).mockReturnValue({
      ...vi.mocked(useAuth).mock.results[0].value,
      isAuthenticated: true,
    } as any);
    
    render(<Login />);
    
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('should handle login errors', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    
    render(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should display loading state during login', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    render(<Login />);
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);
    
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});