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

// The Top match card resolves its title and pay from career_role_wages by slug.
// Stubbed here so these tests exercise the Skills & courses card without a live
// Supabase read deciding whether the card above it renders.
const wageRow = {
  slug: 'data-analyst',
  title: 'Data Analyst',
  occupation_title: 'Data Scientists',
  soc_code: '15-2051',
  pct25: 91_000,
  pct75: 151_000,
  reference_period: 'May 2025',
};
vi.mock('@/hooks/useCareerRoleWages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useCareerRoleWages')>()),
  useCareerRoleWages: () => ({ bySlug: new Map([[wageRow.slug, wageRow]]) }),
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
  // Reports carry a slug, not a title — the title and pay are resolved from
  // career_role_wages so neither can be model-invented.
  recommendedRoles: [{ roleSlug: 'data-analyst', matchPercentage: 82 }],
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

  it('titles the top match from the wage row, not from the report', () => {
    render(<ReportCanvas report={report} revealStage={ALL_REVEALED} />);

    // The report carries only a slug. Both the heading and the pay chip come
    // from career_role_wages, so a figure cannot render without a BLS
    // occupation behind it — the chip is annotated with which one.
    expect(screen.getAllByText('Data Analyst').length).toBeGreaterThan(0);
    const chip = screen.getByText('$91k–$151k');
    expect(chip).toHaveAttribute('title', 'Data Scientists (15-2051), May 2025');
    // The raw slug is a fallback for a role the wage table does not know.
    expect(screen.queryByText('data-analyst')).not.toBeInTheDocument();
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
