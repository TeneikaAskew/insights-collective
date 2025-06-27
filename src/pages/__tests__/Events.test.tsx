import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Events from '../Events';
import { useEvents } from '@/hooks/useEvents';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('@/hooks/useEvents');
vi.mock('@/components/events/EventsList', () => ({
  EventsList: ({ events }: any) => (
    <div data-testid="events-list">
      {events.map((event: any) => (
        <div key={event.id}>{event.title}</div>
      ))}
    </div>
  ),
}));

const createWrapper = ({ user = null }: { user?: any } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('Events Page', () => {
  const mockEvents = [
    {
      id: '1',
      title: 'Data Science Workshop',
      description: 'Learn data science',
      date: '2025-01-15',
      type: 'workshop',
      format: 'in-person',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: '2',
      title: 'AI Webinar',
      description: 'AI trends',
      date: '2025-01-20',
      type: 'webinar',
      format: 'virtual',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: '3',
      title: 'Tech Networking',
      description: 'Network with professionals',
      date: '2025-01-25',
      type: 'networking',
      format: 'in-person',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    expect(screen.getByTestId('events-loading')).toBeInTheDocument();
  });

  it('should render error state', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load events'),
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    expect(screen.getByText('Error loading events')).toBeInTheDocument();
  });

  it('should render events list when data is loaded', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    expect(screen.getByTestId('events-list')).toBeInTheDocument();
    expect(screen.getByText('Data Science Workshop')).toBeInTheDocument();
    expect(screen.getByText('AI Webinar')).toBeInTheDocument();
    expect(screen.getByText('Tech Networking')).toBeInTheDocument();
  });

  it('should filter events by search term', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.type(searchInput, 'data');

    await waitFor(() => {
      expect(screen.getByText('Data Science Workshop')).toBeInTheDocument();
      expect(screen.queryByText('AI Webinar')).not.toBeInTheDocument();
      expect(screen.queryByText('Tech Networking')).not.toBeInTheDocument();
    });
  });

  it('should filter events by type', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    const typeButton = screen.getByText('All Types');
    await user.click(typeButton);
    
    const webinarOption = screen.getByText('Webinar');
    await user.click(webinarOption);

    await waitFor(() => {
      expect(screen.queryByText('Data Science Workshop')).not.toBeInTheDocument();
      expect(screen.getByText('AI Webinar')).toBeInTheDocument();
      expect(screen.queryByText('Tech Networking')).not.toBeInTheDocument();
    });
  });

  it('should filter events by format', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    const formatButton = screen.getByText('All Formats');
    await user.click(formatButton);
    
    const virtualOption = screen.getByText('Virtual');
    await user.click(virtualOption);

    await waitFor(() => {
      expect(screen.queryByText('Data Science Workshop')).not.toBeInTheDocument();
      expect(screen.getByText('AI Webinar')).toBeInTheDocument();
      expect(screen.queryByText('Tech Networking')).not.toBeInTheDocument();
    });
  });

  it('should apply multiple filters simultaneously', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    // Apply search filter
    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.type(searchInput, 'workshop');

    // Apply format filter
    const formatButton = screen.getByText('All Formats');
    await user.click(formatButton);
    const inPersonOption = screen.getByText('In-Person');
    await user.click(inPersonOption);

    await waitFor(() => {
      expect(screen.getByText('Data Science Workshop')).toBeInTheDocument();
      expect(screen.queryByText('AI Webinar')).not.toBeInTheDocument();
      expect(screen.queryByText('Tech Networking')).not.toBeInTheDocument();
    });
  });

  it('should show no events message when filtered results are empty', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No events found matching your filters.')).toBeInTheDocument();
    });
  });

  it('should show no events message when there are no events', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    expect(screen.getByText('No events available at the moment.')).toBeInTheDocument();
  });

  it('should render page title and header', () => {
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
    expect(screen.getByText(/Join us for workshops, webinars, and networking opportunities/)).toBeInTheDocument();
  });

  it('should reset filters when clear filters is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useEvents).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    } as any);

    render(<Events />, { wrapper: createWrapper() });

    // Apply filters
    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.type(searchInput, 'workshop');

    const typeButton = screen.getByText('All Types');
    await user.click(typeButton);
    const workshopOption = screen.getByText('Workshop');
    await user.click(workshopOption);

    // Verify filters are applied
    expect(screen.getByText('Data Science Workshop')).toBeInTheDocument();
    expect(screen.queryByText('AI Webinar')).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);

    // Reset type filter
    const typeButtonAfter = screen.getByText('Workshop');
    await user.click(typeButtonAfter);
    const allTypesOption = screen.getByText('All Types', { selector: '[role="option"]' });
    await user.click(allTypesOption);

    // Verify all events are shown again
    await waitFor(() => {
      expect(screen.getByText('Data Science Workshop')).toBeInTheDocument();
      expect(screen.getByText('AI Webinar')).toBeInTheDocument();
      expect(screen.getByText('Tech Networking')).toBeInTheDocument();
    });
  });
});