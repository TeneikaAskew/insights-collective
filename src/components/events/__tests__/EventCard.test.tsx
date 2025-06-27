import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { EventCard } from '../EventCard';
import { useAuth } from '@/hooks/useAuth';
import { useRegisterForEvent, useUnregisterFromEvent, useIsRegisteredForEvent, useEventRegistrationCount } from '@/hooks/useEventRegistrations';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useEventRegistrations');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createWrapper = ({ user = null }: { user?: any } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={{ user, loading: false, signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn() } as any}>
          {children}
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('EventCard', () => {
  const mockEvent = {
    id: '1',
    title: 'Test Workshop',
    description: 'This is a test workshop',
    date: '2025-01-15',
    start_time: '14:00',
    end_time: '16:00',
    type: 'workshop',
    format: 'in-person',
    location: 'Conference Room A',
    capacity: 30,
    image_url: 'https://example.com/image.jpg',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    } as any);

    vi.mocked(useEventRegistrationCount).mockReturnValue({
      data: 10,
      isLoading: false,
    } as any);

    vi.mocked(useIsRegisteredForEvent).mockReturnValue({
      data: false,
      isLoading: false,
    } as any);
  });

  it('should render event card with all details', () => {
    render(<EventCard event={mockEvent} />, { wrapper: createWrapper() });

    expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    expect(screen.getByText('This is a test workshop')).toBeInTheDocument();
    expect(screen.getByText('workshop')).toBeInTheDocument();
    expect(screen.getByText('in-person')).toBeInTheDocument();
    expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    expect(screen.getByText('10/30 registered')).toBeInTheDocument();
  });

  it('should show virtual event link when format is virtual', () => {
    const virtualEvent = {
      ...mockEvent,
      format: 'virtual',
      location: undefined,
      link: 'https://zoom.us/meeting/123',
    };

    render(<EventCard event={virtualEvent} />, { wrapper: createWrapper() });

    expect(screen.getByText('Online Event')).toBeInTheDocument();
    expect(screen.queryByText('Conference Room A')).not.toBeInTheDocument();
  });

  it('should handle registration when user clicks register button', async () => {
    const mockRegister = vi.fn();
    vi.mocked(useRegisterForEvent).mockReturnValue({
      mutate: mockRegister,
      isLoading: false,
    } as any);

    render(<EventCard event={mockEvent} />, { wrapper: createWrapper({ user: { id: 'user-1' } }) });

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    expect(mockRegister).toHaveBeenCalledWith('1');
  });

  it('should handle unregistration when user is already registered', async () => {
    vi.mocked(useIsRegisteredForEvent).mockReturnValue({
      data: true,
      isLoading: false,
    } as any);

    const mockUnregister = vi.fn();
    vi.mocked(useUnregisterFromEvent).mockReturnValue({
      mutate: mockUnregister,
      isLoading: false,
    } as any);

    render(<EventCard event={mockEvent} />, { wrapper: createWrapper({ user: { id: 'user-1' } }) });

    const unregisterButton = screen.getByText('Cancel Registration');
    fireEvent.click(unregisterButton);

    expect(mockUnregister).toHaveBeenCalledWith('1');
  });

  it('should redirect to login when unauthenticated user tries to register', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    } as any);

    render(<EventCard event={mockEvent} />, { wrapper: createWrapper() });

    const registerButton = screen.getByText('Register');
    fireEvent.click(registerButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/events' } });
  });

  it('should disable registration when event is at capacity', () => {
    vi.mocked(useEventRegistrationCount).mockReturnValue({
      data: 30,
      isLoading: false,
    } as any);

    render(<EventCard event={mockEvent} />, { wrapper: createWrapper({ user: { id: 'user-1' } }) });

    const registerButton = screen.getByText('Event Full');
    expect(registerButton).toBeDisabled();
  });

  it('should disable registration for past events', () => {
    const pastEvent = {
      ...mockEvent,
      date: '2023-01-15',
    };

    render(<EventCard event={pastEvent} />, { wrapper: createWrapper({ user: { id: 'user-1' } }) });

    const registerButton = screen.getByText('Event Ended');
    expect(registerButton).toBeDisabled();
  });

  it('should format date and time correctly', () => {
    render(<EventCard event={mockEvent} />, { wrapper: createWrapper() });

    expect(screen.getByText(/January 15, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/2:00 PM - 4:00 PM/)).toBeInTheDocument();
  });

  it('should handle events without end time', () => {
    const eventWithoutEndTime = {
      ...mockEvent,
      end_time: null,
    };

    render(<EventCard event={eventWithoutEndTime} />, { wrapper: createWrapper() });

    expect(screen.getByText(/2:00 PM/)).toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it('should show loading state while checking registration status', () => {
    vi.mocked(useIsRegisteredForEvent).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(<EventCard event={mockEvent} />, { wrapper: createWrapper({ user: { id: 'user-1' } }) });

    const registerButton = screen.getByRole('button');
    expect(registerButton).toBeDisabled();
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalEvent = {
      id: '1',
      title: 'Minimal Event',
      description: 'Description',
      date: '2025-01-15',
      type: 'workshop',
      format: 'virtual',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    render(<EventCard event={minimalEvent} />, { wrapper: createWrapper() });

    expect(screen.getByText('Minimal Event')).toBeInTheDocument();
    expect(screen.getByText('Online Event')).toBeInTheDocument();
    expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
  });
});