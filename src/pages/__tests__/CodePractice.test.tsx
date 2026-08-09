import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CodePractice from '@/pages/interview-prep/CodePractice';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const userState = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user, loading: userState.loading }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Monaco is bundled rather than fetched now, and the page imports the loader
// binding for its side effect. That module pulls in the real monaco-editor plus
// two `?worker` entry points, none of which jsdom can load or needs — the editor
// itself is stubbed below. Mocked to nothing so the import stays harmless here.
vi.mock('@/lib/monaco-setup', () => ({}));

// Monaco renders into a canvas the assertions cannot read; stub it with a plain
// textarea.
const editorOnChange = vi.hoisted(() => ({ current: null as null | ((v: string) => void) }));
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    editorOnChange.current = onChange;
    return <textarea aria-label="code editor" value={value} readOnly />;
  },
}));

const DB_CHALLENGE = {
  id: 'c0de0007-0000-4000-8000-000000000007',
  title: 'Two Sum',
  difficulty: 'easy',
  prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  detail: 'Return the indices in ascending order.',
  example: 'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]',
  constraints: ['Only one valid answer exists.'],
  hints: ['Consider using a hash map.'],
  language: 'javascript',
  starter_code: 'function solution(nums, target) {\n}',
  function_name: 'solution',
};

// Mock the code_challenges lookup; the page falls back to the hardcoded
// demo challenges when the query returns no rows.
function mockChallengeQuery(rows: unknown[]) {
  mockSupabaseClient.from.mockImplementation(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      contains: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    return chain;
  });
}

beforeEach(() => {
  navigate.mockClear();
  userState.user = null;
  userState.loading = false;
  mockChallengeQuery([]);
  vi.useRealTimers();
});

describe('CodePractice page (Problem Book)', () => {
  // Submitting before auth or the challenge has resolved used to take the demo
  // path, handing a signed-in user invented "3/3 test cases passed" feedback
  // for code that was never executed.
  describe('does not fake a result before it knows what it is evaluating', () => {
    const submitButton = () => screen.getByRole('button', { name: /submit solution/i });

    it('blocks submitting while auth is still resolving', async () => {
      userState.loading = true;
      render(<CodePractice />);

      await waitFor(() => expect(submitButton()).toBeDisabled());
      fireEvent.click(submitButton());
      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
      expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    });

    it('blocks a signed-in submit while the challenge query is in flight', async () => {
      userState.user = { id: 'user-1' };
      // Never resolves: the challenge stays in flight for the whole test.
      mockSupabaseClient.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn(() => chain),
          contains: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => new Promise(() => {})),
        };
        return chain;
      });
      render(<CodePractice />);

      await waitFor(() => expect(submitButton()).toBeDisabled());
      fireEvent.click(submitButton());
      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
      expect(screen.queryByText('Demo')).not.toBeInTheDocument();
    });

    it('blocks a signed-in submit when the challenge lookup fails, and offers a retry', async () => {
      userState.user = { id: 'user-1' };
      // A failed lookup is not evidence that no challenge exists.
      mockSupabaseClient.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn(() => chain),
          contains: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn(() => Promise.resolve({ data: null, error: { message: 'permission denied' } })),
        };
        return chain;
      });
      render(<CodePractice />);

      expect(await screen.findByTestId('challenge-load-error')).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
      fireEvent.click(submitButton());
      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
      expect(screen.queryByText('Demo')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('still allows the honest demo once the query comes back empty', async () => {
      userState.user = null;
      mockChallengeQuery([]);
      render(<CodePractice />);

      await waitFor(() => expect(submitButton()).toBeEnabled());
    });
  });

  it('renders the original heading, role selector, and default challenge', () => {
    render(<CodePractice />);

    expect(screen.getByText('Code Challenge Practice')).toBeInTheDocument();
    expect(screen.getByText('Practice technical coding challenges with real-time feedback.')).toBeInTheDocument();
    expect(screen.getByText('Select your target role:')).toBeInTheDocument();

    // Default role is All Roles -> Two Sum, JavaScript
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Constraints')).toBeInTheDocument();
    expect(screen.getByText('Hints')).toBeInTheDocument();
    expect(screen.getByText(/Hint 1\./)).toBeInTheDocument();
  });

  it('shows the editor chrome with a gated feedback tab', () => {
    render(<CodePractice />);

    // Default role (All Roles) is a JavaScript challenge
    expect(screen.getByText('solution.js')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Code Editor' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('navigates back to the interview prep hub', () => {
    render(<CodePractice />);
    fireEvent.click(screen.getByRole('button', { name: /interview prep/i }));
    expect(navigate).toHaveBeenCalledWith('/interview-prep');
  });

  it('replaces the problem page with the result card after submitting', async () => {
    render(<CodePractice />);

    fireEvent.click(screen.getByRole('button', { name: /submit solution/i }));

    // Simulated evaluation resolves after 1.5s
    expect(await screen.findByText('Result', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    // Logged out with no DB rows, the simulation is clearly labeled as a demo
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
    expect(screen.getByText('8.2MB')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('test cases passed')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText(/your solution for the two sum challenge/i)).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/for all roles roles, consider focusing on performance/i)).toBeInTheDocument();

    // Problem page is swapped out while viewing feedback
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument();

    // Continue Editing flips back to the problem page
    fireEvent.click(screen.getByRole('button', { name: /continue editing/i }));
    await waitFor(() => {
      expect(screen.getByText('Constraints')).toBeInTheDocument();
    });
    // Feedback stays reachable from the editor chrome
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeEnabled();
  });

  it('runs execute-code then review-code for signed-in users (Phase 3 combined flow)', async () => {
    userState.user = { id: 'user-1' };
    mockChallengeQuery([DB_CHALLENGE]);
    (mockSupabaseClient.functions.invoke as any).mockImplementation((fn: string) => {
      if (fn === 'execute-code') {
        return Promise.resolve({
          data: {
            evaluationMode: 'executed',
            allTestsPassed: true,
            testsPassed: 3,
            testsTotal: 3,
            results: [
              { input: '[2,7,11,15], 9', expected: '[0, 1]', actual: '[0,1]', passed: true, hidden: false },
              { input: '(hidden)', expected: '(hidden)', actual: '(hidden)', passed: true, hidden: true },
              { input: '(hidden)', expected: '(hidden)', actual: '(hidden)', passed: true, hidden: true },
            ],
            runtimeMs: 23,
            memoryKb: 7868,
            attemptId: 'attempt-1',
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          evaluationMode: 'executed',
          correct: true,
          testsPassed: 3,
          testsTotal: 3,
          review: 'Clean nested-loop solution; a hash map would bring it to O(n).',
          suggestions: ['Use a hash map', 'Handle empty input', 'Add a docstring'],
        },
        error: null,
      });
    });

    render(<CodePractice />);

    // DB starter code replaces the role template once the challenge loads
    await waitFor(() => {
      expect(screen.getByLabelText('code editor')).toHaveValue('function solution(nums, target) {\n}');
    });
    expect(screen.getByText('Return the indices in ascending order.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /submit solution/i }));

    expect(await screen.findByText('Result')).toBeInTheDocument();
    expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('execute-code', {
      body: {
        challengeId: DB_CHALLENGE.id,
        code: 'function solution(nums, target) {\n}',
        language: 'javascript',
      },
    });
    // Review receives only the attemptId — the verdict is derived from the
    // execution record stored server-side, never from client-sent results
    expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('review-code', {
      body: {
        challengeId: DB_CHALLENGE.id,
        code: 'function solution(nums, target) {\n}',
        language: 'javascript',
        attemptId: 'attempt-1',
      },
    });

    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Executed')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    // Real sandbox numbers populate the tiles
    expect(screen.getByText('23ms')).toBeInTheDocument();
    expect(screen.getByText('7.7MB')).toBeInTheDocument();
    expect(screen.getByText(/hash map would bring it to O\(n\)/i)).toBeInTheDocument();
    // Hidden cases stay out of the per-test list (one visible row)
    expect(screen.getByText('([2,7,11,15], 9)')).toBeInTheDocument();
    expect(screen.queryByText('((hidden))')).not.toBeInTheDocument();
  });

  it('resets to the database starter code, not the role template', async () => {
    userState.user = { id: 'user-1' };
    mockChallengeQuery([DB_CHALLENGE]);

    render(<CodePractice />);
    await waitFor(() => {
      expect(screen.getByLabelText('code editor')).toHaveValue('function solution(nums, target) {\n}');
    });

    // Simulate the user editing, then resetting
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByLabelText('code editor')).toHaveValue('function solution(nums, target) {\n}');
  });

  it('falls back to the AI judge when the sandbox is unavailable', async () => {
    userState.user = { id: 'user-1' };
    mockChallengeQuery([DB_CHALLENGE]);
    (mockSupabaseClient.functions.invoke as any).mockImplementation((fn: string) => {
      if (fn === 'execute-code') {
        return Promise.resolve({ data: null, error: new Error('sandbox down') });
      }
      return Promise.resolve({
        data: {
          evaluationMode: 'ai-judged',
          correct: false,
          testsPassed: 1,
          testsTotal: 3,
          testResults: [{ case: 1, input: '[2,7,11,15], 9', predicted_output: '[0,1]', passed: true }],
          review: 'The loop stops one element early, so the last pair is never checked.',
          suggestions: ['Fix the loop bound', 'Use a hash map', 'Add input validation'],
        },
        error: null,
      });
    });

    render(<CodePractice />);
    await waitFor(() => {
      expect(screen.getByLabelText('code editor')).toHaveValue('function solution(nums, target) {\n}');
    });

    fireEvent.click(screen.getByRole('button', { name: /submit solution/i }));

    expect(await screen.findByText('Result')).toBeInTheDocument();
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(screen.getByText('AI-judged')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    // AI judging cannot measure runtime/memory — those tiles are hidden
    expect(screen.queryByText('runtime')).not.toBeInTheDocument();
    expect(screen.queryByText('memory')).not.toBeInTheDocument();
    expect(screen.getByText(/loop stops one element early/i)).toBeInTheDocument();
  });
});
