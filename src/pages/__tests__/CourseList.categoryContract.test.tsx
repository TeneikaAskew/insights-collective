// ABOUTME: P2 category contract on CourseList: distinct labels for a group selection, an accurate unknown notice that
// ABOUTME: keeps other filters, and Unicode / letterless / "All" stored names. Synthetic fixtures; memory router; no live data.
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

const course = (id: string, title: string, category: string) =>
  makeCourse({ id, title, category, instructor: null, published: true });

function mount(url: string, rows: ReturnType<typeof course>[]) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const b: any = {};
    for (const m of ['select', 'eq', 'order']) b[m] = vi.fn(() => b);
    b.then = (ok: any, bad: any) => Promise.resolve({ data: rows, error: null }).then(ok, bad);
    return b;
  });
  const router = createMemoryRouter([{ path: '/courses', element: <CourseList /> }], { initialEntries: [url] });
  render(<RouterProvider router={router} />);
  return router;
}
const cards = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim()).sort();
const param = (r: ReturnType<typeof mount>) => new URLSearchParams(r.state.location.search).get('category');
const trigger = () => screen.getByRole('combobox', { name: 'Category' });
async function openMenu() {
  await userEvent.click(trigger());
  return (await screen.findAllByRole('option')).map((o) => o.textContent);
}
async function choose(name: string) {
  await userEvent.click(trigger());
  await userEvent.click(await screen.findByRole('option', { name }));
}

beforeEach(() => {
  (Element.prototype as any).hasPointerCapture ??= () => false;
  (Element.prototype as any).releasePointerCapture ??= () => undefined;
  (Element.prototype as any).scrollIntoView ??= () => undefined;
});

describe('1. a group selection never shares a label with a stored category', () => {
  const ROWS = [
    course('abi', 'Analytics and BI Course', 'Analytics & BI'),
    course('bi', 'Business Intelligence Course', 'Business Intelligence'),
    course('ds', 'Data Science Course', 'Data Science'),
  ];

  it('?category=analytics: every menu label is distinct and the group entry says it covers both', async () => {
    mount('/courses?category=analytics', ROWS);
    await waitFor(() => expect(cards()).toEqual(['Analytics and BI Course', 'Business Intelligence Course']));
    const labels = await openMenu();
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(['All categories', 'Analytics & BI', 'Business Intelligence', 'Data Science', 'All in Analytics & BI (2 categories)']);
  });

  it('each entry selects exactly its own URL and cards, and Back/Forward restore each one', async () => {
    const r = mount('/courses?category=analytics', ROWS);
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(trigger()).toHaveTextContent('All in Analytics & BI (2 categories)');

    await choose('Analytics & BI');
    expect(param(r)).toBe('analytics-bi');
    expect(cards()).toEqual(['Analytics and BI Course']);

    await choose('Business Intelligence');
    expect(param(r)).toBe('business-intelligence');
    expect(cards()).toEqual(['Business Intelligence Course']);

    await act(() => r.navigate(-1));
    expect(param(r)).toBe('analytics-bi');
    expect(cards()).toEqual(['Analytics and BI Course']);
    expect(trigger()).toHaveTextContent(/^Analytics & BI$/);

    await act(() => r.navigate(-1));
    expect(param(r)).toBe('analytics');
    expect(cards()).toEqual(['Analytics and BI Course', 'Business Intelligence Course']);
    expect(trigger()).toHaveTextContent('All in Analytics & BI (2 categories)');

    await act(() => r.navigate(1));
    expect(param(r)).toBe('analytics-bi');
    expect(cards()).toEqual(['Analytics and BI Course']);
  });

  it('?category=ai-ml with only ML/AI fetched selects the ML/AI entry itself; no duplicate ML/AI entry', async () => {
    mount('/courses?category=ai-ml', [course('m', 'ML Course', 'ML/AI'), course('ds', 'Data Science Course', 'Data Science')]);
    await waitFor(() => expect(cards()).toEqual(['ML Course']));
    expect(await openMenu()).toEqual(['All categories', 'ML/AI', 'Data Science']);
  });
});

describe('2. the unknown-category notice is accurate and other filters are kept', () => {
  const ROWS = [
    course('a', 'Python Basics', 'Data Science'),
    course('b', 'Python for BI', 'Analytics & BI'),
    course('c', 'SQL Deep Dive', 'Data Engineering'),
  ];

  it('says the category filter is dropped, not that all courses are shown, while search still narrows', async () => {
    mount('/courses?category=nope', ROWS);
    await waitFor(() => expect(cards()).toHaveLength(3));
    await userEvent.type(screen.getByPlaceholderText('Search courses'), 'python');
    expect(cards()).toEqual(['Python Basics', 'Python for BI']);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('courses from all categories are shown');
    expect(note).toHaveTextContent('Your search and other filters still apply');
    expect(note).not.toHaveTextContent(/Showing all courses/);
  });

  it('Clear category drops only ?category= and keeps the search narrowing', async () => {
    const r = mount('/courses?category=nope&ref=x', ROWS);
    await waitFor(() => expect(cards()).toHaveLength(3));
    await userEvent.type(screen.getByPlaceholderText('Search courses'), 'python');
    await userEvent.click(screen.getByRole('button', { name: 'Clear category' }));
    expect(param(r)).toBeNull();
    expect(new URLSearchParams(r.state.location.search).get('ref')).toBe('x');
    expect(screen.getByPlaceholderText('Search courses')).toHaveValue('python');
    expect(cards()).toEqual(['Python Basics', 'Python for BI']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('3. free-text stored names (synthetic; Builder Category is unrestricted text)', () => {
  const ROWS = [
    course('zh', 'Chinese Course', '数据科学'),
    course('fr', 'French Course', 'Données & IA'),
    course('bang', 'Bang Course', '!!!'),
    course('all', 'All Course', 'All'),
    course('ds', 'Data Science Course', 'Data Science'),
  ];

  it('offers every stored name, including Unicode, letterless and "All", as its own entry', async () => {
    mount('/courses', ROWS);
    await waitFor(() => expect(cards()).toHaveLength(5));
    expect(await openMenu()).toEqual(['All categories', '数据科学', 'Données & IA', '!!!', 'All', 'Data Science']);
  });

  it.each([
    ['数据科学', '数据科学', 'Chinese Course'],
    ['Données & IA', 'données-ia', 'French Course'],
    ['!!!', '!!!', 'Bang Course'],
    ['All', 'all', 'All Course'],
  ])('choosing %j writes ?category=%s, shows only its card, and survives Back/Forward', async (label, slug, title) => {
    const r = mount('/courses', ROWS);
    await waitFor(() => expect(cards()).toHaveLength(5));
    await choose(label);
    expect(param(r)).toBe(slug);
    expect(cards()).toEqual([title]);
    await act(() => r.navigate(-1));
    expect(param(r)).toBeNull();
    expect(cards()).toHaveLength(5);
    await act(() => r.navigate(1));
    expect(param(r)).toBe(slug);
    expect(cards()).toEqual([title]);
    expect(trigger()).toHaveTextContent(label);
  });

  it.each([
    ['/courses?category=%E6%95%B0%E6%8D%AE%E7%A7%91%E5%AD%A6', 'Chinese Course'],
    ['/courses?category=donn%C3%A9es-ia', 'French Course'],
    ['/courses?category=all', 'All Course'],
  ])('direct load %s selects that stored name', async (url, title) => {
    mount(url, ROWS);
    await waitFor(() => expect(cards()).toEqual([title]));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['/courses?category=%E6%9C%AA%E7%9F%A5', '/courses?category=---'])(
    'a non-blank value naming nothing (%s) is announced as unknown, not treated as absent', async (url) => {
      mount(url, ROWS);
      await waitFor(() => expect(cards()).toHaveLength(5));
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(trigger()).toHaveTextContent('All categories');
    });

  it('choosing All categories after a stored "All" removes the parameter (no collision)', async () => {
    const r = mount('/courses?category=all', ROWS);
    await waitFor(() => expect(cards()).toEqual(['All Course']));
    await choose('All categories');
    expect(param(r)).toBeNull();
    expect(cards()).toHaveLength(5);
  });
});
