// ABOUTME: Tests for the role course resolver. The property that matters is the
// ABOUTME: precedence rule: platform courses are primary, and Coursera appears
// ABOUTME: only for subjects the platform leaves uncovered.

import { describe, it, expect } from 'vitest';
import { resolveRoleCourses, scorePlatformCourse } from '../roleCourseResolver';
import type { PublishedCourse } from '@/hooks/usePublishedCourses';
import { courseraCatalog, courseraUrl } from '@/data/courseraCatalog';
import { roleLearningPaths } from '@/data/roleLearningPaths';
import { LEARNING_SUBJECTS, SUBJECT_LABELS, inferSubjects } from '@/data/learningSubjects';
import { dataCareerRoles } from '@/data/dataCareerRoles';

function makeCourse(overrides: Partial<PublishedCourse> = {}): PublishedCourse {
  return {
    id: 'course-uuid-1',
    title: 'Untitled',
    description: '',
    category: 'General',
    level: 'Beginner',
    image_url: null,
    thumbnail: null,
    estimated_hours: null,
    tags: null,
    ...overrides,
  };
}

// Mirrors the real seeded rows, so the fixtures stay honest about the shape of
// instructor-authored category/tag text.
const sqlCourse = makeCourse({
  id: 'uuid-sql',
  title: 'Data Engineering Fundamentals',
  description: 'Build pipelines end to end.',
  category: 'Data Engineering',
  tags: ['data engineering', 'SQL', 'ETL'],
  level: 'Intermediate',
});

const tableauCourse = makeCourse({
  id: 'uuid-tableau',
  title: 'Visualization with Tableau',
  description: 'Design dashboards that hold up in a review.',
  category: 'Analytics & BI',
  tags: ['visualization', 'tableau', 'dashboard'],
  level: 'Beginner',
});

const unrelatedCourse = makeCourse({
  id: 'uuid-unrelated',
  title: 'Public Speaking for Introverts',
  description: 'Find your voice in the room.',
  category: 'General',
  tags: ['speaking'],
});

describe('resolveRoleCourses', () => {
  it('falls back entirely to Coursera when the platform has no courses', () => {
    const result = resolveRoleCourses({ id: 'data-analyst' }, []);

    expect(result.platform).toEqual([]);
    expect(result.platformIsEmpty).toBe(true);
    expect(result.coursera.length).toBeGreaterThan(0);
    expect(result.coursera.every((c) => c.source === 'coursera')).toBe(true);
    expect(result.coursera.every((c) => c.external)).toBe(true);
  });

  it('falls back to Coursera when the platform has courses but none are relevant', () => {
    const result = resolveRoleCourses({ id: 'data-analyst' }, [unrelatedCourse]);

    expect(result.platform).toEqual([]);
    expect(result.platformIsEmpty).toBe(true);
    expect(result.coursera.length).toBeGreaterThan(0);
  });

  it('puts relevant platform courses first and links them internally', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse, unrelatedCourse]);

    expect(result.platform.map((c) => c.id)).toEqual(['uuid-tableau']);
    expect(result.platform[0].source).toBe('platform');
    expect(result.platform[0].external).toBe(false);
    expect(result.platform[0].href).toBe('/courses/uuid-tableau');
    expect(result.platform[0].provider).toBe('Insights Collective');
    expect(result.platformIsEmpty).toBe(false);
  });

  it('does not recommend Coursera for a subject a platform course already covers', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse]);

    // The Tableau course covers data-visualization and business-intelligence.
    expect(result.platform[0].matchedSubjects).toContain('data-visualization');
    expect(result.uncoveredSubjects).not.toContain('data-visualization');
    for (const course of result.coursera) {
      expect(course.matchedSubjects).not.toContain('data-visualization');
    }
  });

  it('still recommends Coursera for the subjects the platform course misses', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse]);

    // bi-analyst also needs SQL and data modeling, which the Tableau course
    // does not teach — those are exactly the gaps Coursera should fill.
    expect(result.uncoveredSubjects).toContain('sql');
    expect(result.coursera.length).toBeGreaterThan(0);
    expect(result.coursera.flatMap((c) => c.matchedSubjects)).toContain('sql');
  });

  it('ranks the more central platform course higher', () => {
    const result = resolveRoleCourses({ id: 'data-engineer' }, [tableauCourse, sqlCourse]);

    expect(result.platform[0].id).toBe('uuid-sql');
  });

  it('never repeats a Coursera course within one role', () => {
    for (const roleId of Object.keys(roleLearningPaths)) {
      const { coursera } = resolveRoleCourses({ id: roleId }, []);
      const slugs = coursera.map((c) => c.id);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('honours the platform and Coursera limits independently', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeCourse({
        id: `uuid-${i}`,
        title: `SQL Deep Dive ${i}`,
        category: 'Data Engineering',
        tags: ['SQL', 'ETL'],
      }),
    );

    const result = resolveRoleCourses({ id: 'data-engineer' }, many, {
      platformLimit: 2,
      courseraLimit: 1,
    });

    expect(result.platform).toHaveLength(2);
    expect(result.coursera.length).toBeLessThanOrEqual(1);
  });

  it('recommends something for every role, with or without platform courses', () => {
    for (const role of dataCareerRoles) {
      const empty = resolveRoleCourses(role, []);
      expect(
        empty.platform.length + empty.coursera.length,
        `no recommendations for ${role.id}`,
      ).toBeGreaterThan(0);

      const seeded = resolveRoleCourses(role, [sqlCourse, tableauCourse, unrelatedCourse]);
      expect(
        seeded.platform.length + seeded.coursera.length,
        `no recommendations for ${role.id} with platform courses`,
      ).toBeGreaterThan(0);
    }
  });

  it('uses the category fallback for a role with no curated path', () => {
    const result = resolveRoleCourses({ id: 'not-a-real-role', category: 'AI/ML' }, []);

    expect(result.coursera.length).toBeGreaterThan(0);
    expect(result.uncoveredSubjects).toContain('machine-learning');
  });

  it('ignores a subject mentioned only in prose when scoring', () => {
    const passingMention = makeCourse({
      id: 'uuid-prose',
      title: 'Storytelling for Analysts',
      description: 'We briefly mention SQL, but this is a communication course.',
      category: 'General',
      tags: null,
    });

    const { score } = scorePlatformCourse(passingMention, ['sql', 'data-analysis']);
    // Prose-only evidence must land under the relevance floor.
    const result = resolveRoleCourses({ id: 'sql-developer' }, [passingMention]);

    expect(score).toBeGreaterThan(0);
    expect(result.platform).toEqual([]);
  });
});

describe('data integrity', () => {
  it('has a unique slug for every Coursera entry', () => {
    const slugs = courseraCatalog.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('builds specialization and single-course URLs from the right path', () => {
    const single = courseraCatalog.find((c) => c.format === 'Course')!;
    const spec = courseraCatalog.find((c) => c.format === 'Specialization')!;

    expect(courseraUrl(single)).toBe(`https://www.coursera.org/learn/${single.slug}`);
    expect(courseraUrl(spec)).toBe(`https://www.coursera.org/specializations/${spec.slug}`);
  });

  it('only uses subjects that exist in the taxonomy', () => {
    for (const course of courseraCatalog) {
      for (const subject of course.subjects) {
        expect(LEARNING_SUBJECTS, `${course.slug} has unknown subject`).toContain(subject);
      }
    }
    for (const [roleId, subjects] of Object.entries(roleLearningPaths)) {
      for (const subject of subjects) {
        expect(LEARNING_SUBJECTS, `${roleId} has unknown subject`).toContain(subject);
      }
    }
  });

  it('labels every subject', () => {
    for (const subject of LEARNING_SUBJECTS) {
      expect(SUBJECT_LABELS[subject]).toBeTruthy();
    }
  });

  it('has at least one Coursera course for every subject a role asks for', () => {
    const requested = new Set(Object.values(roleLearningPaths).flat());
    for (const subject of requested) {
      const covered = courseraCatalog.some((c) => c.subjects.includes(subject));
      expect(covered, `no Coursera fallback teaches ${subject}`).toBe(true);
    }
  });

  it('has a learning path for every career role', () => {
    for (const role of dataCareerRoles) {
      expect(roleLearningPaths[role.id], `no path for ${role.id}`).toBeDefined();
    }
  });
});

describe('inferSubjects', () => {
  it('reads subjects out of instructor-authored category text', () => {
    expect(inferSubjects('Analytics & BI')).toContain('data-analysis');
    expect(inferSubjects('ML/AI')).toContain('machine-learning');
  });

  it('does not match a keyword inside a larger word', () => {
    // "ml" must not fire on "html", nor "bi" on "ambient".
    expect(inferSubjects('html and css basics')).not.toContain('machine-learning');
    expect(inferSubjects('ambient computing')).not.toContain('business-intelligence');
  });

  it('returns nothing for empty input', () => {
    expect(inferSubjects(null, undefined, '  ')).toEqual([]);
  });
});
