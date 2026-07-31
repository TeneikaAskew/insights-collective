// ABOUTME: Tests for the career detail tab's course section. Pins the precedence
// ABOUTME: users actually see — platform courses in their own section linking
// ABOUTME: internally, Coursera below as the fallback — and guards the regression
// ABOUTME: this replaced: links to placeholder ids like /courses/da101 that 404'd.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { CareerPathTab } from '../CareerPathTab';
import type { DataCareerRole } from '@/data/dataCareerRoles';
import type { PublishedCourse } from '@/hooks/usePublishedCourses';

const mockUsePublishedCourses = vi.fn();
vi.mock('@/hooks/usePublishedCourses', () => ({
  usePublishedCourses: () => mockUsePublishedCourses(),
}));

const role: DataCareerRole = {
  id: 'bi-analyst',
  title: 'Business Intelligence Analyst',
  category: 'Business Intelligence',
  shortDescription: 'Turn data into dashboards.',
  careerPath: {
    description: 'Grow from analyst into BI leadership.',
    progressionSteps: [{ title: 'Junior BI Analyst', description: 'Learn the stack.' }],
  },
  // The legacy placeholder field must no longer produce links.
  courses: [{ id: 'da101', title: 'Legacy Placeholder', description: 'Should not render.' }],
};

const tableauCourse: PublishedCourse = {
  id: '660e8400-e29b-41d4-a716-446655440005',
  title: 'Visualization with Tableau',
  description: 'Design dashboards that hold up in a review.',
  category: 'Analytics & BI',
  level: 'Beginner',
  image_url: null,
  thumbnail: null,
  estimated_hours: 8,
  tags: ['visualization', 'tableau', 'dashboard'],
};

describe('CareerPathTab course recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows platform courses first, linked to their real course route', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [tableauCourse], loading: false });

    render(<CareerPathTab role={role} />);

    const link = screen.getByRole('link', { name: /Visualization with Tableau/ });
    expect(link).toHaveAttribute('href', `/courses/${tableauCourse.id}`);
    expect(screen.getByText('Courses on Insights Collective')).toBeInTheDocument();
  });

  it('never renders the deprecated placeholder course ids', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [tableauCourse], loading: false });

    render(<CareerPathTab role={role} />);

    expect(screen.queryByText('Legacy Placeholder')).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/courses/da101');
    }
  });

  it('falls back to Coursera when the platform has nothing for the role', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [], loading: false });

    render(<CareerPathTab role={role} />);

    expect(screen.queryByText('Courses on Insights Collective')).not.toBeInTheDocument();
    expect(screen.getByText(/don't have a course for this role yet/i)).toBeInTheDocument();
  });

  it('opens Coursera links in a new tab with a safe rel', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [], loading: false });

    render(<CareerPathTab role={role} />);

    // Parse the URL and compare the host exactly. A substring check would also match
    // https://evil.example/?redirect=coursera.org, which is precisely the confusion
    // this assertion is supposed to rule out.
    const isCoursera = (href: string | null) => {
      if (!href) return false;
      try {
        return new URL(href).hostname === 'www.coursera.org';
      } catch {
        return false;
      }
    };
    const external = screen
      .getAllByRole('link')
      .filter((link) => isCoursera(link.getAttribute('href')));

    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('shows a star rating on Coursera rows but not on platform rows', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [tableauCourse], loading: false });

    render(<CareerPathTab role={role} />);

    // Coursera rows carry a real rating; the platform has none to show.
    expect(screen.getAllByText(/^\d\.\d( \([\d,]+\))?$/).length).toBeGreaterThan(0);

    const platformRow = screen
      .getByRole('link', { name: /Visualization with Tableau/ });
    expect(platformRow.textContent).not.toMatch(/^\s*\d\.\d/);
  });

  it('keeps Coursera below the platform section when both are present', () => {
    mockUsePublishedCourses.mockReturnValue({ courses: [tableauCourse], loading: false });

    const { container } = render(<CareerPathTab role={role} />);

    const platformHeading = screen.getByText('Courses on Insights Collective');
    const courseraHeading = screen.getByText('Also Worth Studying Elsewhere');

    expect(
      platformHeading.compareDocumentPosition(courseraHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The visualization subject is covered in-house, so no Coursera Tableau
    // course should duplicate it.
    const courseraSection = courseraHeading.closest('div')!;
    expect(within(courseraSection).queryByText(/Data Visualization with Tableau/)).toBeNull();
    expect(container).toBeTruthy();
  });
});
