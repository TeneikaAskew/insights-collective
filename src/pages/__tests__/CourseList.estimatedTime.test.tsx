// ABOUTME: CourseList "Estimated time": cards and the filter read estimated_hours only; legacy duration is never shown or filtered.
// ABOUTME: Separate file so the persistence lane's query-aware CourseList.test.tsx rewrite stays the owner of that file.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeCourse } from '@/test/utils/course-fixtures';
import CourseList from '@/pages/CourseList';

// Keep the page under test isolated from heavy layout chrome.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/courses/CourseOnboardingWalkthrough', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Per-table supabase builder helper. Each `from(table)` call returns a fresh
// chainable builder whose eventual (awaited / .single() / .maybeSingle())
// result comes from the handler registered for the verb that was invoked.
// ---------------------------------------------------------------------------
type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type TableHandlers = Partial<
  Record<'select' | 'insert' | 'update' | 'delete' | 'upsert', (...args: any[]) => QueryResult | Promise<QueryResult>>
>;

function makeTableBuilder(handlers: TableHandlers) {
  const builder: any = {};
  let result: Promise<any> = Promise.resolve({ data: null, error: null });
  (['select', 'insert', 'update', 'delete', 'upsert'] as const).forEach((verb) => {
    builder[verb] = vi.fn((...args: any[]) => {
      const handler = handlers[verb];
      if (handler) result = Promise.resolve(handler(...args));
      return builder;
    });
  });
  for (const m of ['eq', 'neq', 'in', 'is', 'order', 'limit', 'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match', 'range', 'contains', 'like', 'ilike']) {
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
  return tables;
}


const mk = (id: string, title: string, extra: Record<string, unknown>) =>
  makeCourse({ id, title, category: 'Data', instructor: null, ...extra } as any);

const courses = [
  mk('c-a', 'Course A 1.94h', { estimated_hours: 1.94, duration: 157 }),
  mk('c-b', 'Course B 2h', { estimated_hours: 2, duration: 8 }),
  mk('c-c', 'Course C 4.94h', { estimated_hours: 4.94 }),
  mk('c-d', 'Course D 5h', { estimated_hours: 5 }),
  mk('c-e', 'Course E 10h', { estimated_hours: 10 }),
  mk('c-f', 'Course F none', { estimated_hours: null, duration: 12 }),
  mk('c-g', 'Course G zero', { estimated_hours: 0, duration: 0 }),
];

beforeEach(() => {
  mockTables({ courses: { select: () => ({ data: courses, error: null }) } });
  // Radix Select needs pointer capture in jsdom.
  (Element.prototype as any).hasPointerCapture ??= () => false;
  (Element.prototype as any).releasePointerCapture ??= () => undefined;
});

const titles = () => ['Course A 1.94h', 'Course B 2h', 'Course C 4.94h', 'Course D 5h', 'Course E 10h', 'Course F none', 'Course G zero']
  .filter((t) => screen.queryByText(t));

async function pick(label: string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Estimated time' }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

describe('CourseList estimated time', () => {
  it('labels the filter Estimated time, never Schedule', async () => {
    render(<CourseList />);
    await screen.findByText('Course A 1.94h');
    expect(screen.getByRole('combobox', { name: 'Estimated time' })).toBeInTheDocument();
    expect(screen.queryByText(/schedule/i)).not.toBeInTheDocument();
  });

  it('offers exactly the four estimated-time buckets plus Any, not raw duration values', async () => {
    render(<CourseList />);
    await screen.findByText('Course A 1.94h');
    await userEvent.click(screen.getByRole('combobox', { name: 'Estimated time' }));
    const opts = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(opts).toEqual(['Any estimated time', 'Under 2 hours', '2 to 5 hours', '5 to 10 hours', '10 hours or more']);
  });

  it.each([
    ['Under 2 hours', ['Course A 1.94h']],
    ['2 to 5 hours', ['Course B 2h', 'Course C 4.94h']],
    ['5 to 10 hours', ['Course D 5h']],
    ['10 hours or more', ['Course E 10h']],
  ])('%s keeps exactly the courses inside it (lower bound inclusive, upper exclusive)', async (label, want) => {
    render(<CourseList />);
    await screen.findByText('Course A 1.94h');
    await pick(label);
    expect(titles()).toEqual(want);
  });

  it('courses with a missing or zero estimate appear only under Any', async () => {
    render(<CourseList />);
    await screen.findByText('Course F none');
    expect(screen.getByText('Course G zero')).toBeInTheDocument();
    for (const label of ['Under 2 hours', '2 to 5 hours', '5 to 10 hours', '10 hours or more']) {
      await pick(label);
      expect(screen.queryByText('Course F none')).not.toBeInTheDocument();
      expect(screen.queryByText('Course G zero')).not.toBeInTheDocument();
    }
    await pick('Any estimated time');
    expect(titles()).toHaveLength(7);
  });

  it('cards show estimated time, and never the legacy duration number', async () => {
    render(<CourseList />);
    const a = (await screen.findByText('Course A 1.94h')).closest('div.pt-9') as HTMLElement;
    expect(within(a).getByText('1.9 hours')).toBeInTheDocument();
    expect(screen.queryByText('157')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\s*12\s*$/)).not.toBeInTheDocument();
    const g = (screen.getByText('Course G zero')).closest('div.pt-9') as HTMLElement;
    expect(within(g).queryByText(/hours?$/)).not.toBeInTheDocument();
    expect(within(g).queryByText(/^\s*0\s*$/)).not.toBeInTheDocument();
  });
});
