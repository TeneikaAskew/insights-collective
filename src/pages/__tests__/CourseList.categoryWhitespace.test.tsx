// ABOUTME: Real Radix category menu with stored names that equal generated or qualified captions only up to whitespace.
// ABOUTME: Every computed accessible name is normalized and unique, and selects exactly one option with exact URL, cards, Back.
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

// Synthetic free-text Builder categories; not claimed to exist live. Raw whitespace is kept in the stored values.
const ROWS = [
  ['abi', 'ABI Course', 'Analytics & BI'],
  ['bi', 'BI Course', 'Business Intelligence'],
  ['lead', 'Leading Space Course', ' All categories'],
  ['tabgrp', 'Tabbed Group Caption Course', 'All in Analytics & BI\t(2 categories)'],
  ['dbl', 'Double Space Course', 'All categories  (show all)'],
  ['nl', 'Newline Suffix Course', 'All categories (show all)\n(category)'],
  ['ds', 'Newline Name Course', 'Data\nScience'],
  ['eth', 'Trailing Space Course', 'Ethics   '],
].map(([id, title, category]) => makeCourse({ id, title, category, instructor: null, published: true }));
const ALL = ROWS.map((r) => r.title).sort();
const GROUP = ['ABI Course', 'BI Course'];

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

/** Computed accessible names of the open menu's options; each is normalized, distinct, and selects exactly one option. */
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
  'All categories (show all) (category) (category)',
  'Data Science',
  'Ethics',
  'All in Analytics & BI (2 categories) (group)',
];

describe('category menu names are unique after whitespace normalization', () => {
  it('with the group entry active: exact computed names for leading/trailing/repeated spaces, tabs and newlines', async () => {
    mount('/courses?category=analytics');
    await waitFor(() => expect(cards()).toEqual(GROUP));
    expect(await menuNames()).toEqual(MENU_WITH_GROUP);
  });

  it('without a group entry: the tabbed group caption reads plain; the other whitespace variants stay told apart', async () => {
    mount('/courses');
    await waitFor(() => expect(cards()).toEqual(ALL));
    expect(await menuNames()).toEqual([
      'All categories (show all)',
      'Analytics & BI',
      'Business Intelligence',
      'All categories (category)',
      'All in Analytics & BI (2 categories)',
      'All categories (show all) (category)',
      'All categories (show all) (category) (category)',
      'Data Science',
      'Ethics',
    ]);
  });

  it.each([
    ['All categories (show all)', null, ALL],
    ['Analytics & BI', 'analytics-bi', ['ABI Course']],
    ['Business Intelligence', 'business-intelligence', ['BI Course']],
    ['All categories (category)', 'all-categories', ['Leading Space Course']],
    // Once chosen, the group entry leaves the menu, so this stored name no longer collides and reads plain.
    ['All in Analytics & BI (2 categories) (category)', 'all-in-analytics-bi-2-categories', ['Tabbed Group Caption Course'], 'All in Analytics & BI (2 categories)'],
    ['All categories (show all) (category)', 'all-categories-show-all', ['Double Space Course']],
    ['All categories (show all) (category) (category)', 'all-categories-show-all-category', ['Newline Suffix Course']],
    ['Data Science', 'data-science', ['Newline Name Course']],
    ['Ethics', 'ethics', ['Trailing Space Course']],
    ['All in Analytics & BI (2 categories) (group)', 'analytics', GROUP],
  ])('from ?category=analytics, the name %j selects exactly one option: ?category=%s, exact cards, Back to the group', async (name, want, wantCards, shown?: string) => {
    const r = mount('/courses?category=analytics');
    await waitFor(() => expect(cards()).toEqual(GROUP));
    await userEvent.click(trigger());
    expect(await screen.findAllByRole('option', { name })).toHaveLength(1);
    await userEvent.click(screen.getByRole('option', { name }));
    expect(param(r)).toBe(want);
    expect(cards()).toEqual([...wantCards].sort());
    expect(trigger()).toHaveAccessibleName('Category');
    expect(trigger().textContent).toBe(shown ?? name);
    if (want !== 'analytics') {
      await act(() => r.navigate(-1));
      expect(param(r)).toBe('analytics');
      expect(cards()).toEqual(GROUP);
    }
  });

  it.each([
    ['/courses?category=all-categories', ['Leading Space Course'], 'All categories (category)'],
    ['/courses?category=all-categories-show-all-category', ['Newline Suffix Course'], 'All categories (show all) (category) (category)'],
    ['/courses?category=data-science', ['Newline Name Course'], 'Data Science'],
  ])('direct load %s selects the stored name with its normalized, unique label', async (url, wantCards, label) => {
    mount(url);
    await waitFor(() => expect(cards()).toEqual(wantCards));
    expect(trigger().textContent).toBe(label);
  });
});
