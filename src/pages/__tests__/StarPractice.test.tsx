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

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const QUESTIONS = [
  { id: 'q1', type: 'behavioral', question: 'Tell me about a hard stakeholder conversation.', targetCompetency: 'Stakeholder Communication', preparationTips: '' },
  { id: 'q2', type: 'behavioral', question: 'Describe mentoring a struggling teammate.', targetCompetency: 'Mentorship', preparationTips: '' },
  { id: 'q3', type: 'technical', question: 'Not shown (technical).', targetCompetency: 'SQL', preparationTips: '' },
];

function mockStudyGuideQuery() {
  mockSupabaseClient.from.mockImplementation((table: string) => {
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
      single: vi.fn(() =>
        Promise.resolve(
          table === 'study_guides'
            ? { data: { questions: QUESTIONS }, error: null }
            : { data: null, error: null }
        )
      ),
      insert: vi.fn(() => chain),
    };
    return chain;
  });
}

beforeEach(() => {
  navigate.mockClear();
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

    expect(await screen.findByText('AI Feedback')).toBeInTheDocument();
    expect(screen.getByText('Your response')).toBeInTheDocument();
    // Situation score appears twice by design: recap chip + rail bar
    expect(screen.getAllByText('8/10').length).toBe(2);
    expect(screen.getByText('6.5/10')).toBeInTheDocument(); // overall
    expect(screen.getByText('Clear scene-setting')).toBeInTheDocument();
    expect(screen.getByText('Quantify the result')).toBeInTheDocument();
    expect(screen.getByText('Add a number to the outcome')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update response/i })).toBeInTheDocument();
  });
});
