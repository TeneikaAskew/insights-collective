// ABOUTME: Covers what the Upcoming Events card puts in front of a reader —
// ABOUTME: readable text rather than stored markup, and cards that stay apart.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import CalendarPanel from '../CalendarPanel';

const EVENTS = [
  {
    id: 'e1',
    title: 'Data Cleaning Exercise - Due',
    course_id: 'c1',
    course_title: 'Introduction to Data Science',
    // Exactly the shape stored on assignments: 15 of the 19 rows in the
    // database carry markup like this.
    description:
      '<h3>Clean and Transform Data</h3>\n<p>Take the provided <code>customers_raw.csv</code> file and produce a clean CSV.</p>',
    start_date: '2099-08-09T22:57:00.000Z',
    type: 'assignment',
  },
  {
    id: 'e2',
    title: 'Statistics Quiz - Due',
    course_id: 'c1',
    course_title: 'Introduction to Data Science',
    description: 'Plain text needs no unwrapping.',
    start_date: '2099-08-16T22:57:00.000Z',
    type: 'quiz',
  },
  // With a module, both types can address the real nested page. For quizzes
  // related_id is the CONTENT ITEM id — that is what :contentItemId means.
  {
    id: 'e3',
    title: 'Statistical Analysis Project - Due',
    course_id: 'c1',
    course_title: 'Introduction to Data Science',
    description: 'Has a module.',
    start_date: '2099-08-23T22:57:00.000Z',
    type: 'assignment',
    related_id: 'a1',
    module_id: 'm1',
  },
  {
    id: 'e4',
    title: 'Statistics Quiz - Closes',
    course_id: 'c1',
    course_title: 'Introduction to Data Science',
    description: 'Quiz submissions close',
    start_date: '2099-08-18T22:57:00.000Z',
    type: 'quiz',
    related_id: 'ci1',
    module_id: 'm1',
  },
];

vi.mock('@/hooks/useCourseCalendar', () => ({
  useUserCalendar: () => ({ events: EVENTS, isLoading: false, error: null }),
}));

vi.mock('@/contexts/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/AuthContext')>()),
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

describe('CalendarPanel — Upcoming Events', () => {
  it('shows the description as readable text, not stored markup', () => {
    render(<CalendarPanel view="upcoming" />);

    // The reader saw "<h3>Clean and Transform Data</h3> <p>Take the provided
    // <code>customers_raw.csv</code>…" printed literally in the card.
    expect(screen.queryByText(/<h3>|<code>|<\/p>/)).toBeNull();
    expect(
      screen.getByText(/Clean and Transform Data\s+Take the provided customers_raw\.csv/),
    ).toBeInTheDocument();
  });

  it('leaves plain descriptions alone', () => {
    render(<CalendarPanel view="upcoming" />);
    expect(screen.getByText('Plain text needs no unwrapping.')).toBeInTheDocument();
  });

  it('gives each card a block link, so the list spacing applies', () => {
    // `space-y-3` sets margin-top, which does nothing on an inline element —
    // and react-router's <Link> renders a bare <a>. Every card measured 0px
    // from its neighbour until the link became a block.
    render(<CalendarPanel view="upcoming" />);

    const card = screen.getByText('Data Cleaning Exercise - Due').closest('a');
    expect(card).not.toBeNull();
    expect(card!.className).toContain('block');
  });

  it('links a card to its course', () => {
    render(<CalendarPanel view="upcoming" />);
    const card = screen.getByText('Statistics Quiz - Due').closest('a');
    expect(card).toHaveAttribute('href', expect.stringContaining('/courses/c1'));
  });

  // REGRESSION: every assignment and quiz card in this panel used to link to a
  // URL that matched no route in App.tsx — '/courses/:c/assignments/:id' and
  // '/courses/:c/quizzes/:id' — so clicking one rendered the 404 page. The
  // quiz case was wrong twice over: it also passed the quiz id where the route
  // wants the content item id.
  describe('navigation targets', () => {
    // Queries the already-rendered tree; rendering per call would duplicate
    // every card in the same document and make getByText ambiguous.
    const hrefFor = (title: string) =>
      screen.getByText(title).closest('a')!.getAttribute('href');

    it('sends a quiz to its module-scoped page, addressed by content item', () => {
      render(<CalendarPanel view="upcoming" />);
      expect(hrefFor('Statistics Quiz - Closes')).toBe('/courses/c1/modules/m1/quizzes/ci1');
    });

    it('sends an assignment to its module-scoped page', () => {
      render(<CalendarPanel view="upcoming" />);
      expect(hrefFor('Statistical Analysis Project - Due')).toBe(
        '/courses/c1/modules/m1/assignments/a1',
      );
    });

    // No module means the nested route cannot be built. Fall back to a section
    // that exists rather than to a 404 — none of the 17 assignments carrying a
    // due_date in the database has a module_id, so this is the common path.
    it('falls back to a real section when the module is unknown', () => {
      render(<CalendarPanel view="upcoming" />);
      expect(hrefFor('Data Cleaning Exercise - Due')).toBe('/courses/c1/assignments');
      expect(hrefFor('Statistics Quiz - Due')).toBe('/courses/c1/modules');
    });

    // The assertion that would have caught the original bug: every href this
    // panel produces has to match a route the app actually declares.
    it('only produces URLs that match a declared route', async () => {
      const { matchRoutes } = await import('react-router-dom');
      const { readFileSync } = await import('node:fs');
      const declared = [...readFileSync('src/App.tsx', 'utf8').matchAll(/path="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((p) => p.startsWith('/'))
        .map((path) => ({ path }));
      expect(declared.length).toBeGreaterThan(50);

      render(<CalendarPanel view="upcoming" />);
      const hrefs = screen
        .getAllByText('Introduction to Data Science')
        .map((el) => el.closest('a')!.getAttribute('href')!);
      expect(hrefs).toHaveLength(EVENTS.length);

      for (const href of hrefs) {
        expect(matchRoutes(declared, href), `no route matches ${href}`).not.toBeNull();
      }
    });
  });

  it('names the course on every card', () => {
    render(<CalendarPanel view="upcoming" />);
    const cards = screen.getAllByText('Introduction to Data Science');
    expect(cards).toHaveLength(EVENTS.length);
    expect(within(cards[0].closest('a')!).getByText(/Due/)).toBeInTheDocument();
  });
});
