// ABOUTME: Tests for the quiz results' Coursera block. Each top track gets a
// ABOUTME: "From Coursera" section of real external course links below the
// ABOUTME: internal Recommended Courses block, which stays untouched.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import QuizResults from '../QuizResults';
import type { CareerTrack } from '@/data/careerQuizData';

// The Coursera block used to populate itself from the bundled catalog whenever
// the database read did not resolve. That fallback is gone, so the fixture says
// explicitly what the catalog returns.
const mockUseCourseraCatalog = vi.fn();
vi.mock('@/hooks/useCourseraCatalog', () => ({
  useCourseraCatalog: () => mockUseCourseraCatalog(),
  MIN_RATING: 4.3,
  MIN_REVIEWS: 50,
  PLATFORM_LANGUAGE: 'en',
}));

vi.mock('@/hooks/useCareerCoach', () => ({
  useCareerCoach: () => ({ initiateCareerCoachChat: vi.fn(), isProcessing: false }),
}));

const scores: Record<CareerTrack, number> = {
  'AI/ML': 18,
  'Analytics': 14,
  'Data Engineering': 10,
  'Business Intelligence': 6,
};

// Subjects the quiz-track category fallback maps to, so one of these matches
// whichever track is rendered.
const courseraFixture = ['data-analysis', 'sql', 'machine-learning', 'data-visualization'].map(
  (subject, i) => ({
    slug: `course-${subject}`,
    url: `https://www.coursera.org/learn/course-${subject}`,
    title: `Course for ${subject}`,
    partner: 'Coursera Partner',
    format: 'Course' as const,
    level: 'Beginner' as const,
    rating: 4.7 - i * 0.05,
    reviews: 5000 - i * 100,
    subjects: [subject],
    primarySubjects: [subject],
    skills: [subject],
    description: `Learn ${subject}.`,
    languages: ['en'],
  }),
);

describe('QuizResults Coursera block', () => {
  beforeEach(() => {
    mockUseCourseraCatalog.mockReturnValue({
      catalog: courseraFixture,
      loading: false,
      error: null,
      isEmpty: false,
      retry: vi.fn(),
    });
  });

  it('renders a From Coursera section per top track, below the internal courses', () => {
    render(<QuizResults scores={scores} answers={{}} onReset={vi.fn()} />);

    // Three top tracks are shown; each gets its own external block, fed by the
    // catalog fixture above rather than by a bundled file.
    const sections = screen.getAllByText(/From Coursera/);
    expect(sections.length).toBe(3);

    // Internal block heading is untouched and precedes the external one.
    const internal = screen.getAllByText('Recommended Courses');
    expect(internal.length).toBe(3);
    const position = internal[0].compareDocumentPosition(sections[0]);
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
