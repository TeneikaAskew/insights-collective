// ABOUTME: Tests for the role course resolver. The property that matters is the
// ABOUTME: precedence rule: platform courses are primary, and Coursera appears
// ABOUTME: only for subjects the platform leaves uncovered.

import { describe, it, expect } from 'vitest';
import { resolveRoleCourses, scorePlatformCourse } from '../roleCourseResolver';
import type { PublishedCourse } from '@/hooks/usePublishedCourses';
import {
  catalogByUrl,
  courseraCoursesForSubject,
  courseraUrl,
  indexCatalogBySubject,
  type CourseraCourse,
} from '@/data/courseraCatalog';
// The generated file is no longer importable from src/ — it lives outside the
// bundle now precisely so the app cannot reach it. The `data integrity` block
// below validates the OFFLINE PIPELINE'S OUTPUT, not app behavior, so it reads
// the artifact from where the pipeline writes it. `tsconfig.app.json` includes
// only src/, so this file is outside `tsc` coverage; these assertions are what
// check it instead.
import { generatedCourseraCatalog } from '../../../scripts/data/courseraCatalog.generated';

import { roleLearningPaths } from '@/data/roleLearningPaths';
import { BUSINESS_SUBJECTS, LEARNING_SUBJECTS, SUBJECT_LABELS, inferSubjects } from '@/data/learningSubjects';
import { dataCareerRoles } from '@/data/dataCareerRoles';

const courseraCatalog = generatedCourseraCatalog;
const courseraCatalogByUrl = catalogByUrl(courseraCatalog);
const bundledIndex = indexCatalogBySubject(courseraCatalog);

// The resolver no longer defaults to a bundled catalog, so these tests pass one
// explicitly. It is still the real pipeline artifact rather than a hand-made
// stub: the precedence assertions below ("Coursera only fills subjects the
// platform leaves uncovered") are only meaningful against a catalog with real
// subject coverage, and inventing one would test the fixture, not the rule.
const catalog = courseraCatalog;

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
    const result = resolveRoleCourses({ id: 'data-analyst' }, [], { catalog });

    expect(result.platform).toEqual([]);
    expect(result.platformIsEmpty).toBe(true);
    expect(result.coursera.length).toBeGreaterThan(0);
    expect(result.coursera.every((c) => c.source === 'coursera')).toBe(true);
    expect(result.coursera.every((c) => c.external)).toBe(true);
  });

  it('reserves the last all-Coursera slot for the business subject', () => {
    // data-analyst's path ends with communication; with the default limit of
    // four and five technical subjects uncovered, priority order alone would
    // never reach it — the reserved slot must.
    const result = resolveRoleCourses({ id: 'data-analyst' }, [], { catalog });

    expect(result.coursera.length).toBe(4);
    expect(result.coursera.flatMap((c) => c.matchedSubjects)).toContain('communication');
  });

  it('releases the reserved slot back to technical subjects when no business course exists', () => {
    const noBusinessCatalog = catalog.filter(
      (c) => !c.subjects.some((s) => BUSINESS_SUBJECTS.has(s)),
    );
    const result = resolveRoleCourses({ id: 'data-analyst' }, [], { catalog: noBusinessCatalog });

    expect(result.coursera.length).toBe(4);
    for (const course of result.coursera) {
      expect(course.matchedSubjects.some((s) => BUSINESS_SUBJECTS.has(s))).toBe(false);
    }
  });

  it('falls back to Coursera when the platform has courses but none are relevant', () => {
    const result = resolveRoleCourses({ id: 'data-analyst' }, [unrelatedCourse], { catalog });

    expect(result.platform).toEqual([]);
    expect(result.platformIsEmpty).toBe(true);
    expect(result.coursera.length).toBeGreaterThan(0);
  });

  it('puts relevant platform courses first and links them internally', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse, unrelatedCourse], { catalog });

    expect(result.platform.map((c) => c.id)).toEqual(['uuid-tableau']);
    expect(result.platform[0].source).toBe('platform');
    expect(result.platform[0].external).toBe(false);
    expect(result.platform[0].href).toBe('/courses/uuid-tableau');
    expect(result.platform[0].provider).toBe('Insights Collective');
    expect(result.platformIsEmpty).toBe(false);
  });

  it('does not recommend Coursera for a subject a platform course already covers', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse], { catalog });

    // The Tableau course covers data-visualization and business-intelligence.
    expect(result.platform[0].matchedSubjects).toContain('data-visualization');
    expect(result.uncoveredSubjects).not.toContain('data-visualization');
    for (const course of result.coursera) {
      expect(course.matchedSubjects).not.toContain('data-visualization');
    }
  });

  it('still recommends Coursera for the subjects the platform course misses', () => {
    const result = resolveRoleCourses({ id: 'bi-analyst' }, [tableauCourse], { catalog });

    // bi-analyst also needs SQL and data modeling, which the Tableau course
    // does not teach — those are exactly the gaps Coursera should fill.
    expect(result.uncoveredSubjects).toContain('sql');
    expect(result.coursera.length).toBeGreaterThan(0);
    expect(result.coursera.flatMap((c) => c.matchedSubjects)).toContain('sql');
  });

  it('carries the Coursera rating through but leaves platform ratings null', () => {
    const result = resolveRoleCourses({ id: 'data-analyst' }, [tableauCourse], { catalog });

    for (const course of result.platform) {
      // The platform does not collect course ratings, so showing one would be
      // inventing it.
      expect(course.rating).toBeNull();
      expect(course.reviews).toBeNull();
    }
    for (const course of result.coursera) {
      const source = courseraCatalogByUrl[course.id];
      expect(course.rating).toBe(source.rating);
      expect(course.reviews).toBe(source.reviews);
    }
  });

  it('ranks the more central platform course higher', () => {
    const result = resolveRoleCourses({ id: 'data-engineer' }, [tableauCourse, sqlCourse], { catalog });

    expect(result.platform[0].id).toBe('uuid-sql');
  });

  it('never repeats a Coursera course within one role', () => {
    for (const roleId of Object.keys(roleLearningPaths)) {
      const { coursera } = resolveRoleCourses({ id: roleId }, [], { catalog });
      const ids = coursera.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('honors the platform and Coursera limits independently', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeCourse({
        id: `uuid-${i}`,
        title: `SQL Deep Dive ${i}`,
        category: 'Data Engineering',
        tags: ['SQL', 'ETL'],
      }),
    );

    const result = resolveRoleCourses({ id: 'data-engineer' }, many, {
      catalog,
      platformLimit: 2,
      courseraLimit: 1,
    });

    expect(result.platform).toHaveLength(2);
    expect(result.coursera.length).toBeLessThanOrEqual(1);
  });

  it('recommends something for every role, with or without platform courses', () => {
    for (const role of dataCareerRoles) {
      const empty = resolveRoleCourses(role, [], { catalog });
      expect(
        empty.platform.length + empty.coursera.length,
        `no recommendations for ${role.id}`,
      ).toBeGreaterThan(0);

      const seeded = resolveRoleCourses(role, [sqlCourse, tableauCourse, unrelatedCourse], { catalog });
      expect(
        seeded.platform.length + seeded.coursera.length,
        `no recommendations for ${role.id} with platform courses`,
      ).toBeGreaterThan(0);
    }
  });

  it('uses the category fallback for a role with no curated path', () => {
    const result = resolveRoleCourses({ id: 'not-a-real-role', category: 'AI/ML' }, [], { catalog });

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
    const result = resolveRoleCourses({ id: 'sql-developer' }, [passingMention], { catalog });

    expect(score).toBeGreaterThan(0);
    expect(result.platform).toEqual([]);
  });
});

describe('data integrity', () => {
  it('has a unique URL for every Coursera entry', () => {
    // URL, not slug: /learn/<slug> and /specializations/<slug> are different courses
    // that share a slug, so slug uniqueness is not a property this data has.
    const urls = courseraCatalog.map((c) => c.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('uses the stored URL verbatim rather than rebuilding it', () => {
    for (const course of courseraCatalog) {
      expect(courseraUrl(course)).toBe(course.url);
    }
  });

  it('puts each format on the URL path Coursera actually serves it from', () => {
    // Regression: an earlier hand-written catalog derived URLs from `format` and
    // mapped Professional Certificate to /specializations/. Coursera serves those
    // from /professional-certificates/, so 11 of 34 links 404'd.
    const expectedPath = {
      Course: 'learn',
      Specialization: 'specializations',
      'Professional Certificate': 'professional-certificates',
    } as const;

    for (const course of courseraCatalog) {
      expect(course.url, `${course.slug} (${course.format})`).toBe(
        `https://www.coursera.org/${expectedPath[course.format]}/${course.slug}`,
      );
    }
  });

  it('covers all three Coursera URL formats', () => {
    const formats = new Set(courseraCatalog.map((c) => c.format));
    expect(formats).toContain('Course');
    expect(formats).toContain('Specialization');
    expect(formats).toContain('Professional Certificate');
  });

  it('keeps generated subjects in sync with inferSubjects', () => {
    // scripts/build-coursera-catalog.mjs cannot import TypeScript, so it
    // reimplements matching over the shared subjectKeywords.json. This re-derives
    // every row the same way the generator did — from title and skills only, NOT
    // description — so any drift between the two implementations fails here.
    for (const course of courseraCatalog) {
      expect(inferSubjects(course.title, course.skills.join(', ')), course.slug).toEqual(
        course.subjects,
      );
      expect(inferSubjects(course.title), course.slug).toEqual(course.primarySubjects);
    }
  });

  it('prefers a multi-course program over a comparable single course', () => {
    // Coursera lists a specialization AND its member courses, and members often have
    // more reviews than the program. Without the boost a capstone or single module
    // outranked the program it belongs to — "Google Data Analytics Capstone" won
    // `data-analysis`, and a module of the Cybersecurity certificate won `sql`.
    const program: CourseraCourse = {
      slug: 'prog',
      url: 'https://www.coursera.org/professional-certificates/prog',
      title: 'Data Analytics Professional Certificate',
      partner: 'Test',
      format: 'Professional Certificate',
      level: 'Beginner',
      rating: 4.7,
      reviews: 20000,
      subjects: ['data-analysis'],
      primarySubjects: ['data-analysis'],
      skills: [],
      description: '',
    };
    const capstone: CourseraCourse = {
      ...program,
      slug: 'capstone',
      url: 'https://www.coursera.org/learn/capstone',
      title: 'Data Analytics Capstone',
      format: 'Course',
      // Slightly better on both raw signals, and still must not win.
      rating: 4.78,
      reviews: 21000,
    };

    const ranked = indexCatalogBySubject([capstone, program]).get('data-analysis')!;
    expect(ranked[0].slug).toBe('prog');
  });

  it('still lets a clearly stronger single course beat a weak program', () => {
    // The boost is a thumb on the scale, not a hard tier — some of the best
    // recommendations are standalone courses.
    const weakProgram: CourseraCourse = {
      slug: 'weak',
      url: 'https://www.coursera.org/specializations/weak',
      title: 'Weak Specialization',
      partner: 'Test',
      format: 'Specialization',
      level: 'Beginner',
      rating: 4.31,
      reviews: 60,
      subjects: ['generative-ai'],
      primarySubjects: ['generative-ai'],
      skills: [],
      description: '',
    };
    const strongCourse: CourseraCourse = {
      ...weakProgram,
      slug: 'strong',
      url: 'https://www.coursera.org/learn/strong',
      title: 'Generative AI with Large Language Models',
      format: 'Course',
      rating: 4.8,
      reviews: 30000,
    };

    const ranked = indexCatalogBySubject([weakProgram, strongCourse]).get('generative-ai')!;
    expect(ranked[0].slug).toBe('strong');
  });

  it('puts an admin-featured course above everything else', () => {
    // is_featured exists so an admin can override the algorithm. If quality could
    // still beat it, it would not be an override — and the column would be inert,
    // which is what it was until this was wired up.
    const featured: CourseraCourse = {
      slug: 'curated',
      url: 'https://www.coursera.org/learn/curated',
      title: 'A Modest Course We Chose Anyway',
      partner: 'Test',
      format: 'Course',
      level: 'Beginner',
      rating: 4.31,
      reviews: 51,
      subjects: ['sql'],
      primarySubjects: ['sql'],
      skills: [],
      description: '',
      isFeatured: true,
    };
    const popular: CourseraCourse = {
      ...featured,
      slug: 'popular',
      url: 'https://www.coursera.org/specializations/popular',
      title: 'Wildly Popular SQL Specialization',
      format: 'Specialization',
      rating: 4.9,
      reviews: 250000,
      isFeatured: false,
    };

    const ranked = indexCatalogBySubject([popular, featured]).get('sql')!;
    expect(ranked[0].slug).toBe('curated');
  });

  it('keeps primarySubjects a subset of subjects', () => {
    for (const course of courseraCatalog) {
      for (const subject of course.primarySubjects) {
        expect(course.subjects, course.slug).toContain(subject);
      }
    }
  });

  it('prefers a course the subject is central to over one that merely touches it', () => {
    for (const subject of LEARNING_SUBJECTS) {
      const ranked = courseraCoursesForSubject(subject, bundledIndex);
      const firstIncidental = ranked.findIndex((c) => !c.primarySubjects.includes(subject));
      if (firstIncidental === -1) continue;

      // Once an incidental match appears, no central match may follow it.
      const laterCentral = ranked
        .slice(firstIncidental)
        .find((c) => c.primarySubjects.includes(subject));
      expect(laterCentral, `${subject} ranks an incidental match above a central one`)
        .toBeUndefined();
    }
  });

  it('has plausible ratings and a real partner on every row', () => {
    for (const course of courseraCatalog) {
      expect(course.rating, course.slug).toBeGreaterThanOrEqual(4);
      expect(course.rating, course.slug).toBeLessThanOrEqual(5);
      expect(course.reviews, course.slug).toBeGreaterThan(0);
      expect(course.partner.trim(), course.slug).not.toBe('');
      expect(course.partner, course.slug).not.toBe('Coursera');
    }
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

  it('keeps browser work out of software-engineering', () => {
    // Regression: `software-engineering` used to carry javascript/react/frontend
    // keywords, so "HTML, CSS, and Javascript for Web Developers" was recommended to
    // an MLOps Engineer and a Cloud Security Engineer.
    const webTitles = [
      'HTML, CSS, and Javascript for Web Developers',
      'Meta Front-End Developer',
      'React Basics',
    ];
    for (const title of webTitles) {
      const subjects = inferSubjects(title);
      expect(subjects, title).toContain('web-development');
      expect(subjects, title).not.toContain('software-engineering');
    }

    // …while general engineering still lands on software-engineering.
    for (const title of ['IBM DevOps and Software Engineering', 'Software Development Lifecycle']) {
      const subjects = inferSubjects(title);
      expect(subjects, title).toContain('software-engineering');
      expect(subjects, title).not.toContain('web-development');
    }
  });

  it('only gives web-development to roles that actually do browser work', () => {
    const webRoles = Object.entries(roleLearningPaths)
      .filter(([, subjects]) => subjects.includes('web-development'))
      .map(([role]) => role);

    // Full-stack is obvious; the visualization specialist's toolset is Tableau,
    // Power BI and D3.js, and D3 is a browser library.
    expect(new Set(webRoles)).toEqual(
      new Set(['full-stack-developer', 'data-visualization-specialist']),
    );
    // The roles the bad recommendation actually reached must not list it.
    for (const role of ['mlops-engineer', 'cloud-security-engineer', 'ai-test-engineer']) {
      expect(roleLearningPaths[role]).not.toContain('web-development');
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
