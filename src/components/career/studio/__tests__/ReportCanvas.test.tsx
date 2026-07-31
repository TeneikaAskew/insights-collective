// ABOUTME: Tests for the pathway report canvas's Skills & courses card. A skill
// ABOUTME: with a catalog match links to the real course; a skill without one
// ABOUTME: keeps the LLM's `course · provider` text as its sub-label.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import ReportCanvas, { ALL_REVEALED } from '../ReportCanvas';
import type { CareerReportData } from '@/components/assistants/types';
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

const report = {
  summary: 'You are on a solid analytics path.',
  recommendedRoles: [{ title: 'Data Analyst', matchPercentage: 82 }],
  skillsAndCourses: [
    { skill: 'SQL', course: 'Invented SQL Course', provider: 'Made-up U', level: 'Beginner' },
    { skill: 'Public Speaking', course: 'Speak Well', provider: 'Talk School', level: 'Intermediate' },
  ],
  keyTakeaways: ['Keep practicing.'],
} as unknown as CareerReportData;

describe('ReportCanvas skills & courses grounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSkillCourses.mockReturnValue({
      coursesBySkill: new Map([
        ['SQL', [sqlCourse]],
        ['Public Speaking', []],
      ]),
      loading: false,
      usedBundledCatalog: false,
    });
  });

  it('links a matched skill to the real catalog course', () => {
    render(<ReportCanvas report={report} revealStage={ALL_REVEALED} />);

    const link = screen.getByRole('link', { name: /SQL Foundations/ });
    expect(link).toHaveAttribute('href', sqlCourse.href);
    expect(link).toHaveAttribute('target', '_blank');
    // The invented LLM course text is replaced for matched skills.
    expect(screen.queryByText(/Invented SQL Course/)).not.toBeInTheDocument();
  });

  it('keeps the LLM course text for skills without a match', () => {
    render(<ReportCanvas report={report} revealStage={ALL_REVEALED} />);

    expect(screen.getByText(/Speak Well · Talk School/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Speak Well/ })).not.toBeInTheDocument();
  });

  it('asks the hook for exactly the rendered skills', () => {
    render(<ReportCanvas report={report} revealStage={ALL_REVEALED} />);

    expect(mockUseSkillCourses).toHaveBeenCalledWith(['SQL', 'Public Speaking']);
  });
});
