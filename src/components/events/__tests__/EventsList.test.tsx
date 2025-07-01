import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { EventsList } from '../EventsList';
import { AuthContext } from '@/contexts/AuthContext';

vi.mock('../EventCard', () => ({
  EventCard: ({ event }: any) => (
    <div data-testid="event-card">{event.title}</div>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={{ user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn() } as any}>
          {children}
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('EventsList', () => {
  const mockEvents = [
    {
      id: '1',
      title: 'Workshop 1',
      description: 'Description 1',
      date: '2025-01-15',
      type: 'workshop',
      format: 'in-person',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: '2',
      title: 'Webinar 2',
      description: 'Description 2',
      date: '2025-01-20',
      type: 'webinar',
      format: 'virtual',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: '3',
      title: 'Networking 3',
      description: 'Description 3',
      date: '2025-01-25',
      type: 'networking',
      format: 'in-person',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];

  it('should render all events in a grid layout', () => {
    render(<EventsList events={mockEvents} />, { wrapper: createWrapper() });

    const eventCards = screen.getAllByTestId('event-card');
    expect(eventCards).toHaveLength(3);
    expect(screen.getByText('Workshop 1')).toBeInTheDocument();
    expect(screen.getByText('Webinar 2')).toBeInTheDocument();
    expect(screen.getByText('Networking 3')).toBeInTheDocument();
  });

  it('should render empty array without crashing', () => {
    render(<EventsList events={[]} />, { wrapper: createWrapper() });

    const eventCards = screen.queryAllByTestId('event-card');
    expect(eventCards).toHaveLength(0);
  });

  it('should apply correct grid layout classes', () => {
    const { container } = render(<EventsList events={mockEvents} />, { wrapper: createWrapper() });

    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6');
  });

  it('should handle single event', () => {
    render(<EventsList events={[mockEvents[0]]} />, { wrapper: createWrapper() });

    const eventCards = screen.getAllByTestId('event-card');
    expect(eventCards).toHaveLength(1);
    expect(screen.getByText('Workshop 1')).toBeInTheDocument();
  });
});