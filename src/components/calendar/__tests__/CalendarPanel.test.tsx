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

  it('names the course on every card', () => {
    render(<CalendarPanel view="upcoming" />);
    const cards = screen.getAllByText('Introduction to Data Science');
    expect(cards).toHaveLength(EVENTS.length);
    expect(within(cards[0].closest('a')!).getByText(/Due/)).toBeInTheDocument();
  });
});
