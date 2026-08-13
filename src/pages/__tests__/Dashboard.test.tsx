// ABOUTME: Minimal Dashboard tests — the enrolled-course cards must never fall
// ABOUTME: back to a stock unsplash thumbnail; missing artwork renders a neutral
// ABOUTME: placeholder instead.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import { makeCourse } from '@/test/utils/course-fixtures';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';

// The app shell and analytics widgets are out of scope here.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/dashboard/StudentProgressAnalytics', () => ({
  default: () => null,
}));

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type TableHandlers = Partial<Record<'select' | 'insert' | 'update' | 'delete', (...args: any[]) => QueryResult>>;

function makeTableBuilder(handlers: TableHandlers) {
  const builder: any = {};
  let result: Promise<any> = Promise.resolve({ data: null, error: null });
  (['select', 'insert', 'update', 'delete'] as const).forEach((verb) => {
    builder[verb] = vi.fn((...args: any[]) => {
      const handler = handlers[verb];
      if (handler) result = Promise.resolve(handler(...args));
      return builder;
    });
  });
  for (const m of ['eq', 'neq', 'in', 'is', 'order', 'limit', 'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => result);
  builder.maybeSingle = vi.fn(() => result);
  builder.then = (onFulfilled: any, onRejected: any) => result.then(onFulfilled, onRejected);
  return builder;
}

function mockTables(tables: Record<string, TableHandlers>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => makeTableBuilder(tables[table] ?? {})
  );
}

const authedUser = { id: 'user-1', email: 'student@example.com', name: 'Ada' } as any;

describe('Dashboard', () => {
  beforeEach(() => {
    // BrowserRouter reads window.location, and the ?tab= test below mutates it.
    // Reset so tab state never leaks between cases.
    window.history.pushState({}, '', '/dashboard');
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthProvider({ user: authedUser, isAuthenticated: true }) as any
    );
    mockTables({
      enrollments: {
        select: () => ({ data: [{ course_id: 'course-1', completion_status: 0 }], error: null }),
      },
      content_item_progressions: { select: () => ({ data: [], error: null }) },
      certificates: { select: () => ({ data: [], error: null }) },
      courses: {
        select: () => ({
          data: [
            makeCourse({
              id: 'course-1',
              title: 'Intro to Data Analytics',
              category: 'Data',
              image_url: null,
              thumbnail: null,
              instructor: { id: 'instructor-1', first_name: 'Ada', last_name: 'Lovelace', avatar_url: null },
            }),
          ],
          error: null,
        }),
      },
      course_assignments: { select: () => ({ data: [], error: null }) },
      notifications: { select: () => ({ data: [], error: null }) },
      assignments: { select: () => ({ data: [], error: null }) },
      course_wishlists: { select: () => ({ data: null, error: null }) },
    });
  });

  it('renders enrolled courses without fabricating a stock unsplash thumbnail', async () => {
    render(<Dashboard />);

    expect(await screen.findByText('Intro to Data Analytics')).toBeInTheDocument();
    // REGRESSION: courses without artwork used to get a hardcoded unsplash
    // photo; they must render a neutral placeholder instead.
    expect(document.body.innerHTML).not.toContain('unsplash');
    expect(document.querySelector('img[src*="unsplash"]')).toBeNull();
  });

  // The stat cards select a tab whose panel is below the fold on a phone. Without
  // moving the viewport the tap reads as a dead control.
  describe('stat cards', () => {
    it('scrolls the tab panels into view and selects the matching tab', async () => {
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      render(<Dashboard />);

      await userEvent.click(await screen.findByText('Upcoming Deadlines'));

      expect(screen.getByRole('tab', { name: /Calendar/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('does not scroll when a tab is selected from the tab bar itself', async () => {
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      render(<Dashboard />);

      await userEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('maps notification rows to camelCase so dates render (no "Invalid Date")', async () => {
    mockTables({
      enrollments: { select: () => ({ data: [], error: null }) },
      content_item_progressions: { select: () => ({ data: [], error: null }) },
      certificates: { select: () => ({ data: [], error: null }) },
      courses: { select: () => ({ data: [], error: null }) },
      course_assignments: { select: () => ({ data: [], error: null }) },
      assignments: { select: () => ({ data: [], error: null }) },
      notifications: {
        select: () => ({
          data: [
            {
              id: 'n1',
              title: 'Assignment graded',
              message: 'See your grade',
              type: 'assignment',
              link: null,
              is_read: false,
              created_at: new Date('2026-07-01T12:00:00Z').toISOString(),
            },
          ],
          error: null,
        }),
      },
    });

    render(<Dashboard />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));

    expect(await screen.findByText('Assignment graded')).toBeInTheDocument();
    // REGRESSION: raw snake_case rows were passed into NotificationItem,
    // which reads createdAt/isRead — every date rendered "Invalid Date".
    expect(document.body.innerHTML).not.toContain('Invalid Date');
  });

  it('shows an error state in the notifications tab when the fetch fails', async () => {
    mockTables({
      enrollments: { select: () => ({ data: [], error: null }) },
      content_item_progressions: { select: () => ({ data: [], error: null }) },
      certificates: { select: () => ({ data: [], error: null }) },
      courses: { select: () => ({ data: [], error: null }) },
      course_assignments: { select: () => ({ data: [], error: null }) },
      assignments: { select: () => ({ data: [], error: null }) },
      notifications: {
        select: () => ({ data: null, error: { message: 'RLS denied' } }),
      },
    });

    render(<Dashboard />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));

    // REGRESSION: a failed fetch used to render "You don't have any
    // notifications." — indistinguishable from an empty inbox.
    expect(await screen.findByText(/Failed to load notifications/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/don't have any notifications/i)).not.toBeInTheDocument();
  });

  // The calendar used to be its own sidebar entry and its own /calendar page. It is a
  // tab here now, and the links that used to point at that page deep-link into it, so
  // both the tab and the ?tab=calendar entry point need to keep working.
  describe('Calendar tab', () => {
    it('renders the calendar panel when the tab is selected', async () => {
      render(<Dashboard />);

      await userEvent.click(await screen.findByRole('tab', { name: /Calendar/ }));

      expect(await screen.findByRole('tab', { name: 'Selected Day' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Quizzes & Exams/ })).toBeInTheDocument();
    });

    it('carries the tab through the login redirect when signed out', async () => {
      // REGRESSION: the redirect was hardcoded to "/login?redirect=/dashboard", which
      // dropped the query string — a signed-out user following a calendar link came
      // back to My Courses. Login's safeInternalPath preserves search, so the tab only
      // survives if the path it is handed still carries it.
      vi.mocked(useAuth).mockReturnValue(
        createMockAuthProvider({ user: null, isAuthenticated: false }) as any
      );
      window.history.pushState({}, '', '/dashboard?tab=calendar');

      // Rendered under Routes, as in App.tsx. That matters: navigating to /login has
      // to unmount Dashboard. Rendered bare, it stays mounted, recomputes the redirect
      // from the location it just moved to, and redirects forever.
      render(
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<div data-testid="login-stub" />} />
        </Routes>
      );

      expect(await screen.findByTestId('login-stub')).toBeInTheDocument();
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      expect(redirect).toBe('/dashboard?tab=calendar');
    });

    it('opens the calendar directly from ?tab=calendar', async () => {
      // How the profile menu and the notifications dropdown reach it now that
      // /calendar is gone — a plain /dashboard link would land on My Courses.
      window.history.pushState({}, '', '/dashboard?tab=calendar');

      render(<Dashboard />);

      expect(await screen.findByRole('tab', { name: 'Selected Day' })).toBeInTheDocument();
    });
  });
});
