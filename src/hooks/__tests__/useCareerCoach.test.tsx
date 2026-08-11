// ABOUTME: Covers useCareerCoach's storage decisions — that an empty result is
// ABOUTME: refused with a toast that says so rather than "try again", that a
// ABOUTME: known attempt is reused instead of duplicated, and that the silent
// ABOUTME: background sync skips an empty payload without writing it.
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerTrack } from '@/data/careerQuizData';

const storeQuizAttempt = vi.fn();
const startCareerCoachConversation = vi.fn();
const toast = vi.fn();
const navigate = vi.fn();

vi.mock('@/services/quizService', () => ({
  storeQuizAttempt: (...args: unknown[]) => storeQuizAttempt(...args),
  startCareerCoachConversation: (...args: unknown[]) => startCareerCoachConversation(...args),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

let isAuthenticated = true;
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated, storeRedirectPath: vi.fn() }),
}));

import { useCareerCoach } from '../useCareerCoach';
import { EmptyResultError } from '@/lib/resultIntegrity';

const REAL_SCORES = {
  'AI/ML': 16,
  Analytics: 20,
  'Data Engineering': 17,
  'Business Intelligence': 18,
} as Record<CareerTrack, number>;

const EMPTY_SCORES = {
  'AI/ML': 0,
  Analytics: 0,
  'Data Engineering': 0,
  'Business Intelligence': 0,
} as Record<CareerTrack, number>;

const store: Record<string, string> = {};

describe('useCareerCoach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAuthenticated = true;
    for (const key of Object.keys(store)) delete store[key];
    vi.mocked(localStorage.getItem).mockImplementation((k: string) => store[k] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k: string, v: string) => {
      store[k] = v;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((k: string) => {
      delete store[k];
    });
    storeQuizAttempt.mockResolvedValue('attempt-new');
    startCareerCoachConversation.mockResolvedValue('conversation-1');
  });

  it('shows a "nothing to save" toast when the service refuses an empty result', async () => {
    storeQuizAttempt.mockRejectedValue(
      new EmptyResultError('quiz attempt', 'every track scored 0'),
    );

    const { result } = renderHook(() => useCareerCoach());
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.initiateCareerCoachChat({}, EMPTY_SCORES);
    });

    expect(outcome).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nothing to save', variant: 'destructive' }),
    );
    // And specifically NOT the connection message: retrying will be refused for
    // exactly the same reason, so telling someone to try again is a dead end.
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error starting chat' }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still reports an ordinary failure as a connection problem', async () => {
    storeQuizAttempt.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useCareerCoach());
    await act(async () => {
      await result.current.initiateCareerCoachChat({ 1: 4 }, REAL_SCORES);
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error starting chat', variant: 'destructive' }),
    );
  });

  it('reuses an attempt it was given instead of storing another', async () => {
    // Every click used to write a new row, so opening the coach three times
    // from the profile left three attempts describing one quiz — each newer
    // than the last.
    const { result } = renderHook(() => useCareerCoach());
    await act(async () => {
      await result.current.initiateCareerCoachChat({ 1: 4 }, REAL_SCORES, 'attempt-existing');
    });

    expect(storeQuizAttempt).not.toHaveBeenCalled();
    expect(startCareerCoachConversation).toHaveBeenCalledWith('attempt-existing');
    expect(navigate).toHaveBeenCalledWith('/assistant/career-coach');
  });

  it('stores a new attempt when it was not given one', async () => {
    const { result } = renderHook(() => useCareerCoach());
    await act(async () => {
      await result.current.initiateCareerCoachChat({ 1: 4 }, REAL_SCORES);
    });

    expect(storeQuizAttempt).toHaveBeenCalledWith({ 1: 4 }, REAL_SCORES);
    expect(startCareerCoachConversation).toHaveBeenCalledWith('attempt-new');
  });

  it('does not sync an all-zero payload left in localStorage', async () => {
    // The leftover here is well-formed and entirely zeros, so a key count calls
    // it valid. That is precisely the row that must never be written.
    store.quizScores = JSON.stringify(EMPTY_SCORES);
    store.quizAnswers = JSON.stringify({});

    renderHook(() => useCareerCoach());

    await waitFor(() => expect(storeQuizAttempt).not.toHaveBeenCalled());
    // Silent by design: nothing was lost, so an unprompted toast on page load
    // would be noise about a background sync the reader never asked for.
    expect(toast).not.toHaveBeenCalled();
  });

  it('does sync a real payload left in localStorage', async () => {
    store.quizScores = JSON.stringify(REAL_SCORES);
    store.quizAnswers = JSON.stringify({ 1: 4, 2: 3 });

    renderHook(() => useCareerCoach());

    await waitFor(() => expect(storeQuizAttempt).toHaveBeenCalled());
  });
});
