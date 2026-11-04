// ABOUTME: Category menu entries of every kind (All sentinel, stored category, generated group) have unique visible and
// ABOUTME: computed accessible names, even when stored free-text names equal another entry's caption. Synthetic fixtures.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeCourse } from '@/test/utils/course-fixtures';
import CourseList from '@/pages/CourseList';

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/courses/CourseOnboardingWalkthrough', () => ({ default: () => null }));

// Stored names chosen to collide with generated captions. Builder Category is free text; these are not claimed to exist live.
const ROWS = [
  ['abi', 'ABI Course', 'Analytics & BI'],
  ['bi', 'BI Course', 'Business Intelligence'],
  ['allcat', 'Literal All Categories Course', 'All categories'],
  ['allin', 'Literal Group Caption Course', 'All in Analytics & BI (2 categories)'],
  ['allshow', 'Literal Qualified Caption Course', 'All categories (show all)'],
  ['ds', 'Data Science Course', 'Data Science'],
].map(([id, title, category]) => makeCourse({ id, title, category, instructor: null, published: true }));
const ALL = ROWS.map((r) => r.title).sort();

function mount(url: string) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const b: any = {};
    for (const m of ['select', 'eq', 'order']) b[m] = vi.fn(() => b);
    b.then = (ok: any, bad: any) => Promise.resolve({ data: ROWS, error: null }).then(ok, bad);
    return b;
  });
  const router = createMemoryRouter([{ path: '/courses', element: <CourseList /> }], { initialEntries: [url] });
  render(<RouterProvider router={router} />);
  return router;
}
const cards = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim()).sort();
const param = (r: ReturnType<typeof mount>) => new URLSearchParams(r.state.location.search).get('category');
const trigger = () => screen.getByRole('combobox', { name: 'Category' });

/** The display/accessibility whitespace rule, written out independently of the code under test. */
const displayName = (t: string) => t.replace(/\s+/gu, ' ').trim();

/** Opens the real Radix menu and returns the options' COMPUTED accessible names (as the role query computes them),
 *  after proving each is already whitespace-normalized, the names are distinct after normalization, and each name
 *  selects exactly one option. */
async function menuNames() {
  await userEvent.click(trigger());
  await screen.findAllByRole('option');
  const names: string[] = [];
  screen.getAllByRole('option', { name: (n: string) => { names.push(n); return true; } });
  for (const n of names) {
    expect(n).toBe(displayName(n));
    expect(screen.getAllByRole('option', { name: n })).toHaveLength(1);
  }
  expect(new Set(names.map(displayName)).size).toBe(names.length);
  return names;
}

beforeEach(() => {
  (Element.prototype as any).hasPointerCapture ??= () => false;
  (Element.prototype as any).releasePointerCapture ??= () => undefined;
  (Element.prototype as any).scrollIntoView ??= () => undefined;
});

const MENU_WITH_GROUP = [
  'All categories (show all)',
  'Analytics & BI',
  'Business Intelligence',
  'All categories (category)',
  'All in Analytics & BI (2 categories) (category)',
  'All categories (show all) (category)',
  'Data Science',
  'All in Analytics & BI (2 categories) (group)',
];

describe('category menu names are unique across kinds', () => {
  it('with the group entry active (?category=analytics): exact, unique visible and accessible names', async () => {
    mount('/courses?category=analytics');
    await waitFor(() => expect(cards()).toEqual(['ABI Course', 'BI Course']));
    expect(await menuNames()).toEqual(MENU_WITH_GROUP);
  });

  it('without a group entry (/courses): the All sentinel and the stored "All categories" are told apart; non-colliding names stay plain', async () => {
    mount('/courses');
    await waitFor(() => expect(cards()).toEqual(ALL));
    expect(await menuNames()).toEqual([
      'All categories (show all)',
      'Analytics & BI',
      'Business Intelligence',
      'All categories (category)',
      'All in Analytics & BI (2 categories)',
      'All categories (show all) (category)',
      'Data Science',
    ]);
  });

  it.each([
    ['All categories (show all)', null, ALL],
    ['Analytics & BI', 'analytics-bi', ['ABI Course']],
    ['Business Intelligence', 'business-intelligence', ['BI Course']],
    ['All categories (category)', 'all-categories', ['Literal All Categories Course']],
    // Once it is chosen the group entry leaves the menu, so this stored name no longer collides and reads plain.
    ['All in Analytics & BI (2 categories) (category)', 'all-in-analytics-bi-2-categories', ['Literal Group Caption Course'], 'All in Analytics & BI (2 categories)'],
    ['All categories (show all) (category)', 'all-categories-show-all', ['Literal Qualified Caption Course']],
    ['Data Science', 'data-science', ['Data Science Course']],
    ['All in Analytics & BI (2 categories) (group)', 'analytics', ['ABI Course', 'BI Course']],
  ])('from ?category=analytics, choosing %j gives ?category=%s and exactly its cards; Back returns to the group', async (name, want, wantCards, shown?: string) => {
    const r = mount('/courses?category=analytics');
    await waitFor(() => expect(cards()).toEqual(['ABI Course', 'BI Course']));
    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole('option', { name }));
    expect(param(r)).toBe(want);
    expect(cards()).toEqual([...wantCards].sort());
    expect(trigger()).toHaveAccessibleName('Category');
    expect(trigger().textContent).toBe(shown ?? name);
    expect(displayName(trigger().textContent ?? '')).toBe(trigger().textContent);
    if (want !== 'analytics') {
      await act(() => r.navigate(-1));
      expect(param(r)).toBe('analytics');
      expect(cards()).toEqual(['ABI Course', 'BI Course']);
    }
  });

  it.each([
    ['/courses?category=all-categories', ['Literal All Categories Course'], 'All categories (category)'],
    ['/courses?category=all-in-analytics-bi-2-categories', ['Literal Group Caption Course'], 'All in Analytics & BI (2 categories)'],
  ])('direct load %s selects the stored name, labelled as that category', async (url, wantCards, label) => {
    mount(url);
    await waitFor(() => expect(cards()).toEqual(wantCards));
    expect(trigger().textContent).toBe(label);
  });
});
