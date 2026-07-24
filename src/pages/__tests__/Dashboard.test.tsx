// ABOUTME: Minimal Dashboard tests — the enrolled-course cards must never fall
// ABOUTME: back to a stock unsplash thumbnail; missing artwork renders a neutral
// ABOUTME: placeholder instead.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import { useAuth } from '@/contexts/AuthContext';
import { makeCourse } from '@/test/utils/course-fixtures';
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
});
