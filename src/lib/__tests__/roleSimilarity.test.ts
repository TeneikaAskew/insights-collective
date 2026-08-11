// ABOUTME: Tests for content-based "similar roles" ranking. Pins the contract the
// ABOUTME: career dialog depends on — four neighbours, never the role itself,
// ABOUTME: stable order — and the property that makes the feature meaningful:
// ABOUTME: the ranking follows the role's text, not its pay or its list position.

import { describe, it, expect } from 'vitest';
import { getSimilarRoles, tokenize } from '@/lib/roleSimilarity';
import { dataCareerRoles, type DataCareerRole } from '@/data/dataCareerRoles';

const fixture = (id: string, overrides: Partial<DataCareerRole> = {}): DataCareerRole => ({
  id,
  title: id,
  category: 'Analytics',
  shortDescription: 'A role.',
  ...overrides,
});

describe('tokenize', () => {
  it('drops stopwords and folds inflections onto one term', () => {
    expect(tokenize('Building dashboards and the dashboard')).toEqual(['build', 'dashboard', 'dashboard']);
  });

  it('keeps the two-letter domain terms a length floor would eat', () => {
    expect(tokenize('AI and ML and BI')).toEqual(['ai', 'ml', 'bi']);
  });

  it('splits slashed tool names and bare numbers out', () => {
    expect(tokenize('Python/R 2024')).toEqual(['python', 'r']);
  });
});

describe('getSimilarRoles', () => {
  it('returns four neighbours and never the role itself', () => {
    for (const role of dataCareerRoles) {
      const similar = getSimilarRoles(role.id);
      expect(similar).toHaveLength(4);
      expect(similar.map(entry => entry.role.id)).not.toContain(role.id);
    }
  });

  it('orders by descending score', () => {
    const scores = getSimilarRoles('data-analyst').map(entry => entry.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('is stable across calls', () => {
    const first = getSimilarRoles('bi-analyst').map(entry => entry.role.id);
    const second = getSimilarRoles('bi-analyst').map(entry => entry.role.id);
    expect(second).toEqual(first);
  });

  it('honours the limit', () => {
    expect(getSimilarRoles('data-analyst', { limit: 3 })).toHaveLength(3);
  });

  it('returns nothing for an unknown role', () => {
    expect(getSimilarRoles('not-a-role')).toEqual([]);
  });

  it('puts genuinely adjacent roles at the top of the list', () => {
    // Chosen because the pairing is obvious to a human reading the catalog: a
    // BI analyst is nearer a data analyst than a cloud security engineer.
    const bi = getSimilarRoles('bi-analyst').map(entry => entry.role.id);
    expect(bi).toContain('data-analyst');
    expect(bi).not.toContain('cloud-security-engineer');

    const ml = getSimilarRoles('machine-learning-engineer').map(entry => entry.role.id);
    expect(ml.slice(0, 3)).toContain('ai-engineer');

    const governance = getSimilarRoles('data-governance-analyst').map(entry => entry.role.id);
    expect(governance).toContain('metadata-specialist');
  });

  it('ranks on the role text rather than catalog position', () => {
    const roles = [
      fixture('a', {
        shortDescription: 'Builds dashboards.',
        responsibilities: ['Design dashboards for stakeholders', 'Model reporting tables'],
        skills: ['Dashboard Design', 'SQL'],
      }),
      // Adjacent in the array, unrelated in content.
      fixture('b', {
        shortDescription: 'Secures cloud networks.',
        responsibilities: ['Harden firewall rules', 'Respond to intrusion alerts'],
        skills: ['Network Security', 'Incident Response'],
      }),
      fixture('c', {
        shortDescription: 'Builds reporting dashboards.',
        responsibilities: ['Design dashboards for stakeholders', 'Write SQL for reporting'],
        skills: ['Dashboard Design', 'SQL'],
      }),
    ];
    expect(getSimilarRoles('a', { roles, limit: 1 })[0].role.id).toBe('c');
  });

  it('reports the skills and tools the two roles share', () => {
    const roles = [
      fixture('a', { skills: ['SQL'], tools: ['Tableau'] }),
      fixture('b', { skills: ['sql'], tools: ['Power BI'] }),
    ];
    // Matched case-insensitively, shown in the neighbour's own casing.
    expect(getSimilarRoles('a', { roles })[0].sharedSkills).toEqual(['sql']);
  });

  it('ignores pay entirely — a role carries no wage text to rank on', () => {
    // The wage figures live in `career_role_wages` and reach the UI through
    // useCareerRoleWages, so there is nothing salary-shaped in the role text.
    // This asserts that stays true: a field named for pay would start steering
    // the ranking the moment someone adds one.
    const payFields = ['salary', 'salaryRange', 'pay', 'compensation', 'wage'];
    for (const role of dataCareerRoles) {
      for (const field of payFields) {
        expect(role).not.toHaveProperty(field);
      }
    }
  });

  it('handles a single-role catalog', () => {
    expect(getSimilarRoles('a', { roles: [fixture('a')] })).toEqual([]);
  });
});
