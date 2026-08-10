// ABOUTME: Tests for the skill course resolver. The properties that matter:
// ABOUTME: free-text skills classify into subjects (or into nothing, safely),
// ABOUTME: courses spread across skills without duplication, and every surface
// ABOUTME: gets an empty list — not a wrong course — for unmatchable skills.

import { describe, it, expect } from 'vitest';
import {
  resolveSkillCourses,
  resolvedFromCoursera,
  subjectsForSkills,
  subjectsForSkillSet,
} from '../skillCourseResolver';
import type { CourseraCourse } from '@/data/courseraCatalog';
import type { LearningSubject } from '@/data/learningSubjects';

function makeCourse(overrides: Partial<CourseraCourse> & { url: string }): CourseraCourse {
  return {
    slug: overrides.url.split('/').pop() ?? 'slug',
    title: 'Untitled',
    partner: 'Partner U',
    format: 'Course',
    level: 'Beginner',
    rating: 4.5,
    reviews: 1000,
    subjects: [],
    primarySubjects: [],
    skills: [],
    description: '',
    languages: ['en'],
    ...overrides,
  };
}

const sqlA = makeCourse({
  url: 'https://www.coursera.org/learn/sql-a',
  title: 'SQL Foundations',
  subjects: ['sql'],
  primarySubjects: ['sql'],
  rating: 4.9,
  reviews: 50000,
});
const sqlB = makeCourse({
  url: 'https://www.coursera.org/learn/sql-b',
  title: 'Advanced SQL',
  subjects: ['sql'],
  primarySubjects: ['sql'],
  rating: 4.7,
  reviews: 20000,
});
const vizA = makeCourse({
  url: 'https://www.coursera.org/learn/viz-a',
  title: 'Dashboards that Work',
  subjects: ['data-visualization'],
  primarySubjects: ['data-visualization'],
  rating: 4.8,
  reviews: 8000,
});
// Teaches both subjects — the course two skills will fight over.
const bothAB = makeCourse({
  url: 'https://www.coursera.org/specializations/both',
  title: 'SQL and Visualization Together',
  format: 'Specialization',
  subjects: ['sql', 'data-visualization'],
  primarySubjects: ['sql', 'data-visualization'],
  rating: 5.0,
  reviews: 100000,
});

const catalog = [sqlA, sqlB, vizA, bothAB];

describe('subjectsForSkills', () => {
  it('classifies plain skill names into subjects', () => {
    const map = subjectsForSkills(['SQL', 'Data Visualization']);
    expect(map.get('SQL')).toContain('sql');
    expect(map.get('Data Visualization')).toContain('data-visualization');
  });

  it('maps out-of-vocabulary skills to an empty list, never a guess', () => {
    const map = subjectsForSkills(['Empathy']);
    expect(map.get('Empathy')).toEqual([]);
  });

  it('classifies business and professional skills into the new subjects', () => {
    const map = subjectsForSkills([
      'Stakeholder Communication',
      'Executive Presence',
      'Agile Project Management',
      'Negotiation',
      'Team Leadership',
    ]);
    expect(map.get('Stakeholder Communication')).toEqual(['communication', 'stakeholder-management']);
    expect(map.get('Executive Presence')).toEqual(['leadership']);
    expect(map.get('Agile Project Management')).toEqual(['project-management']);
    expect(map.get('Negotiation')).toEqual(['negotiation']);
    expect(map.get('Team Leadership')).toEqual(['leadership']);
  });

  it('unions subjects across the skill set without duplicates', () => {
    const union = subjectsForSkillSet(['SQL', 'SQL queries', 'Data Visualization']);
    expect(union.filter((s) => s === 'sql')).toHaveLength(1);
    expect(union).toContain('data-visualization');
  });
});

describe('resolveSkillCourses', () => {
  it('returns up to perSkillLimit courses per matched skill', () => {
    const result = resolveSkillCourses(['SQL'], { catalog, perSkillLimit: 2 });
    const courses = result.get('SQL')!;
    expect(courses.length).toBe(2);
    for (const course of courses) {
      expect(course.external).toBe(true);
      expect(course.href).toMatch(/^https:\/\/www\.coursera\.org\//);
    }
  });

  it('never assigns the same course to two skills when alternatives exist', () => {
    const result = resolveSkillCourses(['SQL', 'Data Visualization'], {
      catalog,
      perSkillLimit: 2,
    });
    const urls = [...result.values()].flat().map((c) => c.id);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('lets a starved skill reuse courses rather than go empty', () => {
    // Only one course exists and it teaches both subjects; the second skill
    // must reuse it instead of rendering nothing.
    const tiny = [bothAB];
    const result = resolveSkillCourses(['SQL', 'Data Visualization'], {
      catalog: tiny,
      perSkillLimit: 2,
    });
    expect(result.get('SQL')!.map((c) => c.id)).toEqual([bothAB.url]);
    expect(result.get('Data Visualization')!.map((c) => c.id)).toEqual([bothAB.url]);
  });

  it('returns an empty list for skills the catalog has nothing for', () => {
    const result = resolveSkillCourses(['Empathy', 'SQL'], { catalog });
    expect(result.get('Empathy')).toEqual([]);
    expect(result.get('SQL')!.length).toBeGreaterThan(0);
  });

  it('credits a pick with the subjects it shares with the skill', () => {
    const result = resolveSkillCourses(['SQL'], { catalog: [bothAB] });
    const [course] = result.get('SQL')!;
    expect(course.matchedSubjects).toEqual(['sql']);
  });

  it('takes the ranked order from the catalog index (quality first)', () => {
    const result = resolveSkillCourses(['SQL'], { catalog, perSkillLimit: 3 });
    const titles = result.get('SQL')!.map((c) => c.title);
    // bothAB has the highest quality score and sql is primary for it.
    expect(titles[0]).toBe('SQL and Visualization Together');
  });

  it('handles duplicate skill names without duplicating work', () => {
    const result = resolveSkillCourses(['SQL', 'SQL'], { catalog });
    expect(result.size).toBe(1);
  });
});

describe('resolvedFromCoursera', () => {
  it('produces the shared resolved shape with format attached', () => {
    const resolved = resolvedFromCoursera(bothAB, ['sql'] as LearningSubject[]);
    expect(resolved).toMatchObject({
      source: 'coursera',
      id: bothAB.url,
      href: bothAB.url,
      external: true,
      provider: 'Partner U',
      format: 'Specialization',
      rating: 5.0,
      matchedSubjects: ['sql'],
    });
  });
});
