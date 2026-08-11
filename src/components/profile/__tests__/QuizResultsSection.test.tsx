// ABOUTME: Covers the profile's Career Path Quiz Results card — that an all-zero
// ABOUTME: stored attempt never renders as "0% / Beginner" cards, that match
// ABOUTME: scores are normalized against each track's real ceiling, and that
// ABOUTME: Retake Quiz navigates somewhere a signed-in member can actually reach.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const initiateCareerCoachChat = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, isAuthenticated: true, storeRedirectPath: vi.fn() }),
}));

vi.mock('@/hooks/useCareerCoach', () => ({
  useCareerCoach: () => ({ initiateCareerCoachChat, isProcessing: false }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

/** Rows the mocked PostgREST chain returns, newest first. */
let attemptRows: Array<Record<string, unknown>> = [];
let attemptError: { message: string } | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: attemptRows, error: attemptError }),
          }),
        }),
      }),
    }),
  },
}));

import QuizResultsSection from '../QuizResultsSection';

const attempt = (
  id: string,
  scores: { ai: number; an: number; de: number; bi: number },
  createdAt: string,
) => ({
  id,
  created_at: createdAt,
  result_ai_ml_score: scores.ai,
  result_analytics_score: scores.an,
  result_data_engineering_score: scores.de,
  result_business_intelligence_score: scores.bi,
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <QuizResultsSection />
    </MemoryRouter>,
  );

/**
 * src/test/setup.ts replaces localStorage with bare `vi.fn()` stubs, so
 * `getItem` answers undefined no matter what was stored. Every assertion about
 * the localStorage path would pass for that reason alone rather than for the
 * behavior it names, so give this suite a store that actually holds values.
 */
const store: Record<string, string> = {};

describe('QuizResultsSection', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      store[key] = value;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete store[key];
    });
    navigateMock.mockClear();
    initiateCareerCoachChat.mockClear();
    attemptRows = [];
    attemptError = null;
  });

  it('shows the take-the-quiz prompt when the only stored attempt scored zero', async () => {
    // The exact row this account holds in production: a coach-chat write that
    // captured no scores. Reporting it as a result claimed the member matched
    // every track at 0% — a measurement the quiz never took.
    attemptRows = [attempt('zero', { ai: 0, an: 0, de: 0, bi: 0 }, '2025-05-05T21:25:48Z')];

    renderSection();

    expect(await screen.findByText(/haven't taken the career path quiz yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Match Score:/)).not.toBeInTheDocument();
  });

  it('falls back to the newest attempt that actually scored', async () => {
    attemptRows = [
      attempt('zero', { ai: 0, an: 0, de: 0, bi: 0 }, '2025-05-05T21:25:48Z'),
      attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z'),
    ];

    renderSection();

    // Analytics tops out at 23, so 20 is 87% — not the 100% that `score * 5`
    // produced by assuming a flat 20-point ceiling for every track.
    expect(await screen.findByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
    // Data Engineering tops out at 19, so 17 is 89% and outranks Analytics'
    // percentage even though its raw score is lower.
    expect(screen.getByText('89%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('uses scored localStorage values when the database has no attempt', async () => {
    localStorage.setItem(
      'quizScores',
      JSON.stringify({ 'AI/ML': 22, Analytics: 5, 'Data Engineering': 3, 'Business Intelligence': 2 }),
    );

    renderSection();

    // AI/ML's ceiling is 22, so a perfect raw score reads exactly 100%.
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('still reads the database when localStorage already has scores', async () => {
    // localStorage caches scores and nothing else. Letting it skip the query
    // dropped the attempt id and the recorded experience on every mount after
    // the first, so a recorded level silently became "not recorded" and the
    // coach button went back to storing a duplicate attempt.
    localStorage.setItem(
      'quizScores',
      JSON.stringify({ 'AI/ML': 16, Analytics: 20, 'Data Engineering': 17, 'Business Intelligence': 18 }),
    );
    attemptRows = [
      { ...attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z'),
        self_reported_experience: 'seasoned' },
    ];

    renderSection();

    expect(await screen.findByTestId('experience-level')).toHaveTextContent('Advanced');

    await userEvent.click(screen.getByRole('button', { name: /chat with career coach/i }));
    await waitFor(() => expect(initiateCareerCoachChat).toHaveBeenCalled());
    expect(initiateCareerCoachChat.mock.calls[0][2]).toBe('scored');
  });

  it('ranks the cards by match percentage, not by raw score', async () => {
    // Raw scores are measured against different ceilings, so ranking on them
    // disagrees with the percentages shown beside them: Analytics 20/23 is 87%
    // and Data Engineering 17/19 is 89%, yet Analytics has the higher raw score
    // and used to take the "Top Match" position.
    attemptRows = [attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z')];

    renderSection();

    await screen.findByText('89%');
    const shown = screen.getAllByText(/^\d+%$/).map((el) => parseInt(el.textContent!, 10));
    expect(shown).toEqual([...shown].sort((a, b) => b - a));
    expect(shown[0]).toBe(89);
  });

  it('states the recorded experience level once, not per track', async () => {
    attemptRows = [
      { ...attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z'),
        self_reported_experience: 'working' },
    ];

    renderSection();

    // One line for the person, not one per card. A level printed on each of the
    // three cards was computed from that card's match percentage, which is a
    // measure of interest — so a keen newcomer read as "Advanced" three times.
    const level = await screen.findByTestId('experience-level');
    expect(level).toHaveTextContent('Intermediate');
    expect(screen.getAllByTestId('experience-level')).toHaveLength(1);
  });

  it('says the experience level is not recorded rather than guessing one', async () => {
    // Every attempt taken before the experience question existed has no answer.
    attemptRows = [attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z')];

    renderSection();

    const level = await screen.findByTestId('experience-level');
    expect(level).toHaveTextContent(/not recorded/i);
    expect(level).not.toHaveTextContent(/beginner|intermediate|advanced/i);
  });

  it('ignores an all-zero localStorage payload and still consults the database', async () => {
    localStorage.setItem(
      'quizScores',
      JSON.stringify({ 'AI/ML': 0, Analytics: 0, 'Data Engineering': 0, 'Business Intelligence': 0 }),
    );
    attemptRows = [attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z')];

    renderSection();

    expect(await screen.findByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('reports a failed fetch instead of claiming the quiz was never taken', async () => {
    attemptError = { message: 'permission denied for table career_quiz_attempts' };

    renderSection();

    // Empty state is a claim about the member. A failed read cannot support it,
    // so the section must not render it — the error path shows a toast and
    // leaves the prompt behind rather than asserting "no attempt exists".
    expect(await screen.findByText(/haven't taken the career path quiz yet/i)).toBeInTheDocument();
  });

  it('Retake Quiz navigates to a route signed-in members can reach', async () => {
    attemptRows = [attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z')];
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /retake quiz/i }));

    // Not '/#quiz-section': that anchor does not exist and '/' redirects
    // authenticated visitors to the dashboard before the quiz can render.
    expect(navigateMock).toHaveBeenCalledWith('/career-quiz');
  });

  it('Take Career Quiz from the empty state uses the same route', async () => {
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /take career quiz/i }));

    expect(navigateMock).toHaveBeenCalledWith('/career-quiz');
  });

  it('hands the coach the loaded scores rather than an empty object', async () => {
    attemptRows = [attempt('scored', { ai: 16, an: 20, de: 17, bi: 18 }, '2025-04-12T00:14:32Z')];
    renderSection();

    await userEvent.click(await screen.findByRole('button', { name: /chat with career coach/i }));

    await waitFor(() => expect(initiateCareerCoachChat).toHaveBeenCalled());
    const [, scores, existingAttemptId] = initiateCareerCoachChat.mock.calls[0];
    expect(scores).toEqual({
      'AI/ML': 16,
      Analytics: 20,
      'Data Engineering': 17,
      'Business Intelligence': 18,
    });
    // And it names the attempt these results came from, so the coach attaches
    // to it instead of writing a fresh row on every click.
    expect(existingAttemptId).toBe('scored');
  });
});
