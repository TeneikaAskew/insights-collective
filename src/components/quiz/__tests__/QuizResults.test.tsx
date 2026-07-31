// ABOUTME: Tests for the quiz results' Coursera block. Each top track gets a
// ABOUTME: "From Coursera" section of real external course links below the
// ABOUTME: internal Recommended Courses block, which stays untouched.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import QuizResults from '../QuizResults';
import type { CareerTrack } from '@/data/careerQuizData';

vi.mock('@/hooks/useCareerCoach', () => ({
  useCareerCoach: () => ({ initiateCareerCoachChat: vi.fn(), isProcessing: false }),
}));

const scores: Record<CareerTrack, number> = {
  'AI/ML': 18,
  'Analytics': 14,
  'Data Engineering': 10,
  'Business Intelligence': 6,
};

describe('QuizResults Coursera block', () => {
  it('renders a From Coursera section per top track, below the internal courses', () => {
    render(<QuizResults scores={scores} answers={{}} onReset={vi.fn()} />);

    // Three top tracks are shown; each gets its own external block (the
    // bundled catalog always has courses for the track fallback subjects).
    const sections = screen.getAllByText(/From Coursera/);
    expect(sections.length).toBe(3);

    // Internal block heading is untouched and precedes the external one.
    const internal = screen.getAllByText('Recommended Courses');
    expect(internal.length).toBe(3);
    const position = internal[0].compareDocumentPosition(sections[0]);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links external courses safely to coursera.org', () => {
    render(<QuizResults scores={scores} answers={{}} onReset={vi.fn()} />);

    const external = screen
      .getAllByRole('link')
      .filter((l) => (l.getAttribute('href') || '').startsWith('https://www.coursera.org/'));
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
