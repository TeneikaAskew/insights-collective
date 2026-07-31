// ABOUTME: Pins the report contract that keeps salary figures out of model output.
// ABOUTME: A role without a slug joins to no BLS occupation, so it must be dropped, not defaulted.
import { describe, it, expect } from 'vitest';
import { parseCareerReport } from '../CareerReportParser';

/**
 * The parser used to fill gaps: `title || 'Unknown Role'` and
 * `salaryRange || 'Not specified'`. Both rendered as ordinary report content,
 * so a role the model half-invented was indistinguishable from a real one, and
 * a salary that had never been sourced looked like a deliberate omission rather
 * than a missing lookup.
 */
describe('parseCareerReport recommendedRoles', () => {
  it('keeps roles that carry a slug', () => {
    const report = parseCareerReport(
      JSON.stringify({
        summary: 'x',
        recommendedRoles: [
          { roleSlug: 'data-analyst', description: 'Reporting and dashboards.', matchPercentage: 88 },
        ],
      }),
    );

    expect(report.recommendedRoles).toHaveLength(1);
    expect(report.recommendedRoles[0].roleSlug).toBe('data-analyst');
    expect(report.recommendedRoles[0].matchPercentage).toBe(88);
  });

  it('accepts the snake_case spelling the model sometimes emits', () => {
    const report = parseCareerReport(
      JSON.stringify({
        summary: 'x',
        recommended_roles: [{ role_slug: 'data-engineer', description: 'Pipelines.' }],
      }),
    );

    expect(report.recommendedRoles.map((r) => r.roleSlug)).toEqual(['data-engineer']);
  });

  it('drops a role with no slug rather than inventing a title', () => {
    const report = parseCareerReport(
      JSON.stringify({
        summary: 'x',
        recommendedRoles: [
          { title: 'Chief Vibes Officer', description: 'Made up.', salaryRange: '$200k-$300k' },
          { roleSlug: 'data-analyst', description: 'Real.' },
        ],
      }),
    );

    expect(report.recommendedRoles).toHaveLength(1);
    expect(report.recommendedRoles[0].roleSlug).toBe('data-analyst');
  });

  it('carries no salary field at all', () => {
    const report = parseCareerReport(
      JSON.stringify({
        summary: 'x',
        recommendedRoles: [
          { roleSlug: 'data-analyst', description: 'Real.', salaryRange: '$1-$2' },
        ],
      }),
    );

    // Even when the model volunteers one, it must not survive into the report:
    // pay is resolved from career_role_wages by slug, never taken from the LLM.
    expect(report.recommendedRoles[0]).not.toHaveProperty('salaryRange');
    expect(JSON.stringify(report)).not.toContain('$1-$2');
  });
});
