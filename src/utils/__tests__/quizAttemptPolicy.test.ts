import { describe, it, expect } from 'vitest';
import {
  attemptsRemaining,
  canStartNewAttempt,
  isAttemptInProgress,
  isUnlimitedAttempts,
  secondsRemaining,
} from '@/utils/quizAttemptPolicy';

const pending = { attempt: 1, workflow_state: 'pending_review', finished_at: null };
const done = { attempt: 1, workflow_state: 'complete', finished_at: '2026-10-01T00:00:00Z' };

describe('quizAttemptPolicy', () => {
  it('treats NULL and 0 as unlimited, like start_quiz_attempt', () => {
    expect(isUnlimitedAttempts(null)).toBe(true);
    expect(isUnlimitedAttempts(undefined)).toBe(true);
    expect(isUnlimitedAttempts(0)).toBe(true);
    expect(isUnlimitedAttempts(1)).toBe(false);
  });

  it('an attempt is in progress until finalized', () => {
    expect(isAttemptInProgress(pending)).toBe(true);
    expect(isAttemptInProgress(done)).toBe(false);
    expect(isAttemptInProgress({ ...pending, finished_at: '2026-10-01T00:00:00Z' })).toBe(false);
    expect(isAttemptInProgress(null)).toBe(false);
  });

  it('continuing an in-progress attempt is not "starting another"', () => {
    expect(canStartNewAttempt(pending, 1)).toBe(false);
    expect(canStartNewAttempt(null, 1)).toBe(true);
    expect(canStartNewAttempt(done, 1)).toBe(false);
    expect(canStartNewAttempt(done, 2)).toBe(true);
    expect(canStartNewAttempt({ ...done, attempt: 2 }, 2)).toBe(false);
    expect(canStartNewAttempt({ ...done, attempt: 9 }, 0)).toBe(true);
    expect(canStartNewAttempt({ ...done, attempt: 9 }, null)).toBe(true);
  });

  it('reports remaining attempts, or null when unlimited', () => {
    expect(attemptsRemaining(done, 2)).toBe(1);
    expect(attemptsRemaining({ ...done, attempt: 3 }, 2)).toBe(0);
    expect(attemptsRemaining(done, 0)).toBeNull();
    expect(attemptsRemaining(null, 3)).toBe(3);
  });

  it('derives the clock from started_at', () => {
    const now = Date.parse('2026-11-01T12:10:00Z');
    expect(secondsRemaining('2026-11-01T12:04:00Z', 10, now)).toBe(240);
    expect(secondsRemaining('2026-11-01T11:00:00Z', 10, now)).toBe(0);
    expect(secondsRemaining('2026-11-01T12:04:00Z', null, now)).toBeNull();
    expect(secondsRemaining(null, 10, now)).toBeNull();
    expect(secondsRemaining('not a date', 10, now)).toBeNull();
  });
});
