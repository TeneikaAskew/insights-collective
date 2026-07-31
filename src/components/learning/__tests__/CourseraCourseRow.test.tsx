// ABOUTME: Tests for the shared course row. External rows must be safe links
// ABOUTME: (target=_blank + noopener), platform rows must stay internal Links,
// ABOUTME: and a null rating must render nothing rather than "0.0".

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { CourseraCourseRow } from '../CourseraCourseRow';
import type { ResolvedCourse } from '@/lib/roleCourseResolver';

const external: ResolvedCourse & { format?: string } = {
  source: 'coursera',
  id: 'https://www.coursera.org/learn/sql-foundations',
  title: 'SQL Foundations',
  description: 'Queries from the ground up.',
  href: 'https://www.coursera.org/learn/sql-foundations',
  external: true,
  level: 'Beginner',
  provider: 'Duke University',
  matchedSubjects: ['sql'],
  rating: 4.71,
  reviews: 4091,
  format: 'Course',
};

const platform: ResolvedCourse = {
  source: 'platform',
  id: '660e8400-e29b-41d4-a716-446655440005',
  title: 'Visualization with Tableau',
  description: 'Design dashboards that hold up in a review.',
  href: '/courses/660e8400-e29b-41d4-a716-446655440005',
  external: false,
  level: 'Beginner',
  provider: 'Insights Collective',
  matchedSubjects: ['data-visualization'],
  rating: null,
  reviews: null,
};

describe('CourseraCourseRow', () => {
  it('renders external courses as new-tab links with a safe rel', () => {
    render(<CourseraCourseRow course={external} />);
    const link = screen.getByRole('link', { name: /SQL Foundations/ });
    expect(link).toHaveAttribute('href', external.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows provider, format, level and the rating with review count', () => {
    render(<CourseraCourseRow course={external} />);
    expect(screen.getByText('Duke University · Course')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('4.7 (4,091)')).toBeInTheDocument();
  });

  it('renders platform courses as internal router links without a rating', () => {
    render(<CourseraCourseRow course={platform} />);
    const link = screen.getByRole('link', { name: /Visualization with Tableau/ });
    expect(link).toHaveAttribute('href', platform.href);
    expect(link).not.toHaveAttribute('target');
    expect(link.textContent).not.toMatch(/\d\.\d/);
  });

  it('compact variant stays a single line: title, provider, rating only', () => {
    render(<CourseraCourseRow course={external} variant="compact" />);
    const link = screen.getByRole('link', { name: /SQL Foundations/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Duke University')).toBeInTheDocument();
    // Compact drops the review count.
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.queryByText(/4,091/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Queries from the ground up/)).not.toBeInTheDocument();
  });

  it('shows description and subject chips only when asked', () => {
    render(<CourseraCourseRow course={external} showDescription showSubjects />);
    expect(screen.getByText('Queries from the ground up.')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
  });
});
