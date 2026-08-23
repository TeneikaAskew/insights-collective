import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import StarPractice from '@/pages/interview-prep/StarPractice';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useSearchParams: () => [new URLSearchParams(''), vi.fn()],
  };
});

const userState = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user }),
}));

// The toast has to be observable. Nothing in this file renders a Toaster, so
// asserting on toast copy with queryByText matches nothing whether the toast
// fired or not — a check that cannot fail.
const toastFn = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-toast')>();
  return { ...actual, useToast: () => ({ toast: toastFn, dismiss: vi.fn(), toasts: [] }) };
});

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const QUESTIONS = [
  { id: 'q1', type: 'behavioral', question: 'Tell me about a hard stakeholder conversation.', targetCompetency: 'Stakeholder Communication', preparationTips: '' },
  { id: 'q2', type: 'behavioral', question: 'Describe mentoring a struggling teammate.', targetCompetency: 'Mentorship', preparationTips: '' },
  { id: 'q3', type: 'technical', question: 'Not shown (technical).', targetCompetency: 'SQL', preparationTips: '' },
];

function mockStudyGuideQuery(questions: typeof QUESTIONS | null = QUESTIONS) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    // Modeled on how PostgREST actually behaves, because the difference is
    // the whole point: on zero rows `single` returns a PGRST116 error and
    // `maybeSingle` returns a null with no error. A mock that resolved both
    // identically would let the page go back to `single` and stay green.
    const hasRow = table === 'study_guides' && !!questions;
    const resolveGuide = (strict: boolean) =>
      Promise.resolve(
        hasRow
          ? { data: { questions }, error: null }
          : strict
            ? {
                data: null,
                error: {
                  code: 'PGRST116',
                  message: 'JSON object requested, multiple (or no) rows returned',
                },
              }
            : { data: null, error: null }
      );
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => {
        if (table === 'star_responses') {
          return Promise.resolve({ data: [], error: null });
        }
        return chain;
      }),
      // The page reads a study guide with maybeSingle — no row is an ordinary
      // state, not a 406. `single` stays on the mock so any other caller that
      // still uses it keeps working; both resolve the same way.
      single: vi.fn(() => resolveGuide(true)),
      maybeSingle: vi.fn(() => resolveGuide(false)),
      insert: vi.fn(() => chain),
    };
    return chain;
  });
}

beforeEach(() => {
  navigate.mockClear();
  toastFn.mockClear();
  userState.user = null;
  vi.spyOn(LocalStorageUtils, 'getSavedStarResponses').mockReturnValue(null as any);
  vi.spyOn(LocalStorageUtils, 'getStarResponseDraftForQuestion').mockReturnValue(null as any);
  vi.spyOn(LocalStorageUtils, 'saveStarResponseDraftForQuestion').mockImplementation(() => {});
});

describe('StarPractice page (Guided Coach)', () => {
  it('shows the no-questions state when logged out', async () => {
    render(<StarPractice />);
    expect(await screen.findByText('No Questions Available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('shows the no-questions state, not an error, when the user has no study guide', async () => {
    // This used to be an HTTP 406. The query ended in `.single()`, so a user
    // who had simply never analyzed a job description got PGRST116, which the
    // page rethrew into a red "Failed to load questions. Please try again."
    // toast. There was nothing to retry. `maybeSingle` makes no-row an ordinary
    // null and the empty state below is what they see.
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery(null);

    render(<StarPractice />);

    expect(await screen.findByText('No Questions Available')).toBeInTheDocument();
    expect(
      screen.getByText(/analyze a job description first/i),
    ).toBeInTheDocument();
    // The assertion that actually pins the fix: with `.single()` the mock
    // returns PGRST116, the page rethrows, and this toast fires.
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('renders the question, step segments, and coach rail for a signed-in user', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();

    render(<StarPractice />);

    expect(await screen.findByText(/tell me about a hard stakeholder conversation/i)).toBeInTheDocument();
    // Only behavioral questions are practiced (2 of the 3 in the guide)
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /situation/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /result/i })).toBeInTheDocument();
    // Coach rail highlights the active step's tip
    expect(screen.getByText('Your coach')).toBeInTheDocument();
    expect(screen.getByText(/set the scene with specific details/i)).toBeInTheDocument();
  });

  it('gates Next on the current step having content, and advances the coach', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();

    render(<StarPractice />);
    await screen.findByText('Your coach');

    const next = screen.getByRole('button', { name: /^next$/i });
    expect(next).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Describe the situation...'), {
      target: { value: 'Our team faced a deadline.' },
    });
    expect(next).toBeEnabled();

    fireEvent.click(next);
    // Coach rail now coaches the Task step
    await waitFor(() => {
      expect(screen.getByText(/explain your responsibility or goal/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('What was your task or goal?')).toBeInTheDocument();
  });

  it('lets the user jump between steps via the segment bar', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();

    render(<StarPractice />);
    await screen.findByText('Your coach');

    fireEvent.click(screen.getByRole('tab', { name: /result/i }));
    expect(screen.getByPlaceholderText('What were the results?')).toBeInTheDocument();
    // Submit appears on the final step, gated on all steps being filled
    expect(screen.getByRole('button', { name: /submit response/i })).toBeDisabled();
  });

  it('renders recaps with scores and the AI feedback rail for a submitted response', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();
    vi.spyOn(LocalStorageUtils, 'getSavedStarResponses').mockReturnValue({
      q1: {
        response: { situation: 'S text', task: 'T text', action: 'A text', result: 'R text' },
        feedback: {
          score_scale: 5,
          scores: { situation: 5, task: 4, action: 2, result: 1, overall: 3 },
          analysis: { completeness: 'ok', specificity: 'ok', relevance: 'ok', impact: 'ok', communication: 'ok' },
          feedback: {
            strengths: ['Clear scene-setting'],
            improvements: ['Quantify the result'],
            suggestions: ['Add a number to the outcome'],
          },
        },
        timestamp: 1,
      },
    } as any);

    render(<StarPractice />);

    expect(await screen.findByText('AI Feedback')).toBeInTheDocument();
    expect(screen.getByText('Your response')).toBeInTheDocument();
    // Situation score appears twice by design: recap chip + rail bar
    expect(screen.getAllByText('5/5').length).toBe(2);
    expect(screen.getByText('3/5')).toBeInTheDocument(); // overall
    expect(screen.getByText('Clear scene-setting')).toBeInTheDocument();
    expect(screen.getByText('Quantify the result')).toBeInTheDocument();
    expect(screen.getByText('Add a number to the outcome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update response/i })).toBeInTheDocument();
  });

  // This cache is read before the database and returns early, so an entry left
  // from before the 1-5 switch would shadow the row forever — and it holds
  // scores out of 10. Skipping it is what makes the server-side cleanup visible
  // in a browser that already has the old blob.
  it('ignores cached feedback saved before the 5-point switch', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();
    vi.spyOn(LocalStorageUtils, 'getSavedStarResponses').mockReturnValue({
      q1: {
        response: { situation: 'S text', task: 'T text', action: 'A text', result: 'R text' },
        feedback: {
          scores: { situation: 8, task: 7, action: 6, result: 5, overall: 6.5 },
          analysis: { completeness: 'ok', specificity: 'ok', relevance: 'ok', impact: 'ok', communication: 'ok' },
          feedback: {
            strengths: ['Clear scene-setting'],
            improvements: ['Quantify the result'],
            suggestions: ['Add a number to the outcome'],
          },
        },
        timestamp: 1,
      },
    } as any);

    render(<StarPractice />);

    // Falls through to the database, which has nothing, so the user is back on
    // the compose view rather than looking at a stale 8/10.
    await screen.findByText('Your coach');
    expect(screen.queryByText('AI Feedback')).not.toBeInTheDocument();
    expect(screen.queryByText('8/10')).not.toBeInTheDocument();
  });

  // The score bars read feedback.scores unconditionally. A payload without it
  // used to take the whole rail down with a TypeError, losing the written
  // feedback the user could still have acted on.
  it('renders the written feedback when the payload carries no scores', async () => {
    userState.user = { id: 'user-1' };
    mockStudyGuideQuery();
    vi.spyOn(LocalStorageUtils, 'getSavedStarResponses').mockReturnValue({
      q1: {
        response: { situation: 'S text', task: 'T text', action: 'A text', result: 'R text' },
        feedback: {
          score_scale: 5,
          analysis: { completeness: 'ok', specificity: 'ok', relevance: 'ok', impact: 'ok', communication: 'ok' },
          feedback: {
            strengths: ['Clear scene-setting'],
            improvements: ['Quantify the result'],
            suggestions: ['Add a number to the outcome'],
          },
        },
        timestamp: 1,
      },
    } as any);

    render(<StarPractice />);

    expect(await screen.findByText('AI Feedback')).toBeInTheDocument();
    expect(screen.getByText('Clear scene-setting')).toBeInTheDocument();
    expect(screen.getByText('Quantify the result')).toBeInTheDocument();
    expect(screen.queryByText('Overall')).not.toBeInTheDocument();
  });
});
