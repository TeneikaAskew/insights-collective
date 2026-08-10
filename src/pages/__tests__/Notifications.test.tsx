// ABOUTME: Regression tests for the Notifications page — failed loads must show
// ABOUTME: an error state (not "Nothing here"), and failed writes must roll back.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import Notifications from '@/pages/Notifications';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

type QueryResult = { data?: unknown; error?: unknown };
type Handlers = Partial<Record<'select' | 'update' | 'delete', (...args: any[]) => QueryResult>>;

function makeTableBuilder(handlers: Handlers) {
  const builder: any = {};
  let result: Promise<any> = Promise.resolve({ data: null, error: null });
  (['select', 'update', 'delete'] as const).forEach((verb) => {
    builder[verb] = vi.fn((...args: any[]) => {
      const handler = handlers[verb];
      if (handler) result = Promise.resolve(handler(...args));
      return builder;
    });
  });
  for (const m of ['eq', 'in', 'order', 'limit']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: any, onRejected: any) => result.then(onFulfilled, onRejected);
  return builder;
}

function mockTables(tables: Record<string, Handlers>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => makeTableBuilder(tables[table] ?? {})
  );
}

const notificationRow = {
  id: 'n1',
  user_id: 'user-1',
  title: 'Assignment graded',
  message: 'Your homework was graded.',
  type: 'assignment_grade',
  is_read: false,
  link: null,
  course_id: null,
  created_at: new Date().toISOString(),
};

describe('Notifications page', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({
        user: { id: 'user-1', email: 'a@b.c' },
        isAuthenticated: true,
      }) as any
    );
  });

  it('renders an error state with retry when the load fails, not "Nothing here"', async () => {
    mockTables({
      notifications: {
        select: () => ({ data: null, error: { message: 'RLS denied' } }),
      },
    });

    render(<Notifications />);

    expect(await screen.findByText('Failed to load notifications')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
    // The header must not claim "You're all caught up." on a failed load.
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it('rolls back mark-all-read when the write fails', async () => {
    let updateCalls = 0;
    mockTables({
      notifications: {
        select: () => ({ data: [notificationRow], error: null }),
        update: () => {
          updateCalls += 1;
          return { data: null, error: { message: 'write blocked' } };
        },
      },
    });

    render(<Notifications />);

    expect(await screen.findByText('Assignment graded')).toBeInTheDocument();
    expect(screen.getByText(/1 unread/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark all as read/i }));

    // The optimistic flip must be rolled back once the write fails.
    await waitFor(() => {
      expect(updateCalls).toBeGreaterThan(0);
      expect(screen.getByText(/1 unread/i)).toBeInTheDocument();
    });
  });

  it('renders the genuine empty state when there are no notifications', async () => {
    mockTables({
      notifications: {
        select: () => ({ data: [], error: null }),
      },
    });

    render(<Notifications />);

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load notifications')).not.toBeInTheDocument();
  });
  it('re-fetches when Retry is clicked after a failed load', async () => {
    let calls = 0;
    mockTables({
      notifications: {
        select: () => {
          calls += 1;
          return calls === 1
            ? { data: null, error: { message: 'RLS denied' } }
            : { data: [notificationRow], error: null };
        },
      },
    });

    render(<Notifications />);

    expect(await screen.findByText('Failed to load notifications')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Assignment graded')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load notifications')).not.toBeInTheDocument();
  });

  it('renders instructor feedback notifications and navigates to the submission link', async () => {
    const feedbackRow = {
      ...notificationRow,
      id: 'n2',
      type: 'submission_feedback',
      title: 'New feedback: Data Cleaning Exercise',
      message: 'Your instructor left feedback on your submission.',
      link: '/courses/c1/modules/m1/assignments/a1',
      course_id: 'c1',
    };
    mockTables({
      notifications: {
        select: () => ({ data: [feedbackRow], error: null }),
        update: () => ({ data: null, error: null }),
      },
      courses: { select: () => ({ data: [{ id: 'c1', title: 'Python Data Analysis' }], error: null }) },
    });

    render(<Notifications />);

    expect(await screen.findByText('New feedback: Data Cleaning Exercise')).toBeInTheDocument();
    expect(
      screen.getByText('Your instructor left feedback on your submission.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-card'));

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/courses/c1/modules/m1/assignments/a1');
    });
  });
});
