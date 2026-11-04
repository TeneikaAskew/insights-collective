// ABOUTME: CourseList ?category= binding: direct loads of the four existing footer slugs, selector -> URL, Back/Forward,
// ABOUTME: unknown and ambiguous slugs. Unit-contract proof with a memory router and fixture rows; no live data or RLS.
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

// Raw stored names as the source taxonomy spells them (COURSE_CATEGORIES / CATEGORY_DISPLAY_MAP), plus one name
// outside it. These are fixtures, not a claim about which names production holds.
const ROWS = [
  ['ds', 'Data Science Course', 'Data Science'],
  ['abi', 'Analytics and BI Course', 'Analytics & BI'],
  ['bi', 'Business Intelligence Course', 'Business Intelligence'],
  ['aiml', 'AI ML Course', 'AI/ML'],
  ['de', 'Data Engineering Course', 'Data Engineering'],
  ['prod', 'Productivity Course', 'Productivity'],
] as const;
const course = ([id, title, category]: readonly [string, string, string]) =>
  makeCourse({ id, title, category, instructor: null, published: true });
const ALL_TITLES = ROWS.map((r) => r[1]).sort();

function serve(rows: ReturnType<typeof course>[]) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const b: any = {};
    for (const m of ['select', 'eq', 'order']) b[m] = vi.fn(() => b);
    b.then = (ok: any, bad: any) => Promise.resolve({ data: rows, error: null }).then(ok, bad);
    return b;
  });
}

function mount(url: string, rows = ROWS.map(course)) {
  serve(rows);
  const router = createMemoryRouter([{ path: '/courses', element: <CourseList /> }], { initialEntries: [url] });
  render(<RouterProvider router={router} />);
  return router;
}
const cards = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim()).sort();
const search = (r: ReturnType<typeof mount>) => r.state.location.search;
const trigger = () => screen.getByRole('combobox', { name: 'Category' });

beforeEach(() => {
  (Element.prototype as any).hasPointerCapture ??= () => false;
  (Element.prototype as any).releasePointerCapture ??= () => undefined;
  (Element.prototype as any).scrollIntoView ??= () => undefined;
});

describe('CourseList ?category= direct load (existing footer slugs are the input contract)', () => {
  it.each([
    // slug, expected cards, selector label, rationale
    ['ai-ml', ['AI ML Course'], 'AI/ML', 'stored name "AI/ML" slugs to ai-ml'],
    ['data-engineering', ['Data Engineering Course'], 'Data Engineering', 'stored name'],
    ['business-intelligence', ['Business Intelligence Course'], 'Business Intelligence', 'stored name wins over its group'],
    ['analytics', ['Analytics and BI Course', 'Business Intelligence Course'], 'Analytics & BI', 'documented alias to the display group'],
  ])('?category=%s shows exactly %j (%s)', async (slug, want, label) => {
    mount(`/courses?category=${slug}`);
    await waitFor(() => expect(cards()).toEqual([...want].sort()));
    expect(trigger()).toHaveTextContent(label);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('resolves a slug through CATEGORY_DISPLAY_MAP when no stored name carries it (ai-ml -> group ML/AI)', async () => {
    mount('/courses?category=ai-ml', [course(['mlai', 'ML AI Course', 'ML/AI']), course(['ds', 'Data Science Course', 'Data Science'])]);
    await waitFor(() => expect(cards()).toEqual(['ML AI Course']));
    expect(trigger()).toHaveTextContent('ML/AI');
  });

  it('a group-label slug matches the stored name first (analytics-bi keeps only "Analytics & BI")', async () => {
    mount('/courses?category=analytics-bi');
    await waitFor(() => expect(cards()).toEqual(['Analytics and BI Course']));
  });

  it('a group-label slug with no stored name of that label keeps every stored name in the group', async () => {
    mount('/courses?category=analytics-bi', [
      course(['bi', 'Business Intelligence Course', 'Business Intelligence']),
      course(['abil', 'Long Name Course', 'Analytics & Business Intelligence']),
      course(['ds', 'Data Science Course', 'Data Science']),
    ]);
    await waitFor(() => expect(cards()).toEqual(['Business Intelligence Course', 'Long Name Course']));
    expect(trigger()).toHaveTextContent('Analytics & BI');
  });

  it('accepts a name-shaped or QuizResults-shaped value for the same category', async () => {
    mount('/courses?category=Analytics%20%26%20BI');
    await waitFor(() => expect(cards()).toEqual(['Analytics and BI Course']));
  });

  it('an unknown slug shows all courses and SAYS so; the selector stays on All, never a pretend category', async () => {
    mount('/courses?category=quantum-basket-weaving');
    await waitFor(() => expect(cards()).toEqual(ALL_TITLES));
    expect(screen.getByRole('status')).toHaveTextContent('No published courses match the category “quantum-basket-weaving”');
    expect(trigger()).toHaveTextContent('All categories');
  });

  it('a known taxonomy slug with no matching fetched course is announced, not silently widened', async () => {
    mount('/courses?category=analytics', [course(['ds', 'Data Science Course', 'Data Science'])]);
    await waitFor(() => expect(cards()).toEqual(['Data Science Course']));
    expect(screen.getByRole('status')).toHaveTextContent('“analytics”');
    expect(trigger()).toHaveTextContent('All categories');
  });

  it('two stored names with the same slug are one option and both are kept', async () => {
    mount('/courses?category=data-engineering', [
      course(['de1', 'Spaced Course', 'Data Engineering']),
      course(['de2', 'Hyphen Course', 'Data-Engineering']),
      course(['ds', 'Data Science Course', 'Data Science']),
    ]);
    await waitFor(() => expect(cards()).toEqual(['Hyphen Course', 'Spaced Course']));
    await userEvent.click(trigger());
    const opts = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(opts).toEqual(['All categories', 'Data Engineering', 'Data Science']);
  });

  it.each(['/courses', '/courses?category=', '/courses?category=%20'])('%s is All with no notice', async (url) => {
    mount(url);
    await waitFor(() => expect(cards()).toEqual(ALL_TITLES));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('composes with search: ?category=analytics plus a query narrows within the category only', async () => {
    mount('/courses?category=analytics');
    await waitFor(() => expect(cards()).toHaveLength(2));
    await userEvent.type(screen.getByPlaceholderText('Search courses'), 'business');
    expect(cards()).toEqual(['Business Intelligence Course']);
  });
});

describe('CourseList category selector <-> URL and history', () => {
  async function choose(name: string) {
    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole('option', { name }));
  }

  it('choosing a category writes its slug; choosing All removes the parameter', async () => {
    const r = mount('/courses');
    await waitFor(() => expect(cards()).toEqual(ALL_TITLES));
    await choose('AI/ML');
    expect(search(r)).toBe('?category=ai-ml');
    expect(cards()).toEqual(['AI ML Course']);
    await choose('All categories');
    expect(search(r)).toBe('');
    expect(cards()).toEqual(ALL_TITLES);
  });

  it('Back and Forward step through category states and the cards follow', async () => {
    const r = mount('/courses?category=data-engineering');
    await waitFor(() => expect(cards()).toEqual(['Data Engineering Course']));
    await choose('Data Science');
    expect(search(r)).toBe('?category=data-science');
    expect(cards()).toEqual(['Data Science Course']);

    await act(() => r.navigate(-1));
    expect(search(r)).toBe('?category=data-engineering');
    expect(cards()).toEqual(['Data Engineering Course']);
    expect(trigger()).toHaveTextContent('Data Engineering');

    await act(() => r.navigate(1));
    expect(search(r)).toBe('?category=data-science');
    expect(cards()).toEqual(['Data Science Course']);
  });

  it('Back from an unknown slug to a valid one clears the notice', async () => {
    const r = mount('/courses?category=ai-ml');
    await waitFor(() => expect(cards()).toEqual(['AI ML Course']));
    await act(() => r.navigate('/courses?category=nope'));
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(() => r.navigate(-1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(cards()).toEqual(['AI ML Course']);
  });

  it('Clear category on the unknown notice returns to All and drops the parameter', async () => {
    const r = mount('/courses?category=nope');
    await screen.findByRole('status');
    await userEvent.click(screen.getByRole('button', { name: 'Clear category' }));
    expect(search(r)).toBe('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps unrelated query parameters when the category changes', async () => {
    const r = mount('/courses?ref=footer');
    await waitFor(() => expect(cards()).toEqual(ALL_TITLES));
    await choose('Data Science');
    expect(new URLSearchParams(search(r)).get('ref')).toBe('footer');
    expect(new URLSearchParams(search(r)).get('category')).toBe('data-science');
  });
});
