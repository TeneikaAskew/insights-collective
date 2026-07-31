// ABOUTME: Tests for the skill-gap chart's Coursera section. Matched skills get
// ABOUTME: real course links; the generic coursera.org browse button survives
// ABOUTME: only as the fallback when nothing matched.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { SkillGapChart } from '../SkillGapChart';
import type { SkillCourse } from '@/lib/skillCourseResolver';

const mockUseSkillCourses = vi.fn();
vi.mock('@/hooks/useSkillCourses', () => ({
  useSkillCourses: (skills: string[]) => mockUseSkillCourses(skills),
}));

const sqlCourse: SkillCourse = {
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

describe('SkillGapChart Coursera section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders matched courses per missing skill and drops the browse fallback', () => {
    mockUseSkillCourses.mockReturnValue({
      coursesBySkill: new Map([['SQL', [sqlCourse]]]),
      loading: false,
      usedBundledCatalog: false,
    });

    render(<SkillGapChart userSkills={['Excel']} missingSkills={['SQL']} learningResources={[]} />);

    expect(screen.getByText(/From Coursera/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /SQL Foundations/ });
    expect(link).toHaveAttribute('href', sqlCourse.href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('Explore More Learning Resources')).not.toBeInTheDocument();
  });

  it('falls back to the generic browse button when nothing matched', () => {
    mockUseSkillCourses.mockReturnValue({
      coursesBySkill: new Map([['Public Speaking', []]]),
      loading: false,
      usedBundledCatalog: false,
    });

    render(
      <SkillGapChart userSkills={[]} missingSkills={['Public Speaking']} learningResources={[]} />,
    );

    expect(screen.queryByText(/From Coursera/)).not.toBeInTheDocument();
    const browse = screen.getByRole('link', { name: /Explore More Learning Resources/ });
    expect(browse).toHaveAttribute('href', 'https://www.coursera.org/browse/data-science');
  });

  it('keeps the LLM learning resources above the Coursera block', () => {
    mockUseSkillCourses.mockReturnValue({
      coursesBySkill: new Map([['SQL', [sqlCourse]]]),
      loading: false,
      usedBundledCatalog: false,
    });

    const { container } = render(
      <SkillGapChart
        userSkills={[]}
        missingSkills={['SQL']}
        learningResources={[{ skill: 'SQL', resources: ['Read the platform SQL primer'] }]}
      />,
    );

    const internal = screen.getByText('Read the platform SQL primer');
    const external = screen.getByText(/From Coursera/);
    const position = internal.compareDocumentPosition(external);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).toBeInTheDocument();
  });
});
