// ABOUTME: Regression tests for OnboardingContext: localStorage persistence failures
// ABOUTME: must not crash tour completion, and corrupted progress must reset visibly.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

import { OnboardingProvider, useOnboarding } from '../OnboardingContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OnboardingProvider>{children}</OnboardingProvider>
);

describe('OnboardingContext', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReset();
    vi.mocked(localStorage.setItem).mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('treats corrupted saved progress as a first visit', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('{not-valid-json');

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await waitFor(() => expect(result.current.isFirstVisit).toBe(true));
    expect(result.current.completedTours).toEqual([]);
  });

  it('does not crash completeTour when localStorage.setItem throws (quota/private mode)', async () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useOnboarding(), { wrapper });

    act(() => {
      result.current.startTour('welcome-tour', true);
    });
    expect(result.current.isOnboardingActive).toBe(true);

    // Previously this threw synchronously out of the click handler
    expect(() => {
      act(() => {
        result.current.completeTour();
      });
    }).not.toThrow();

    expect(result.current.isOnboardingActive).toBe(false);
    expect(result.current.completedTours).toContain('welcome-tour');
  });

  it('persists completed tours when localStorage works', async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    act(() => {
      result.current.startTour('welcome-tour', true);
    });
    act(() => {
      result.current.completeTour();
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'onboarding_progress',
      expect.stringContaining('welcome-tour')
    );
  });
});
