// ABOUTME: Tests the Coursera page parser used by the coursera-refresh Edge
// ABOUTME: Function, and asserts it extracts the same facts as the parser in
// ABOUTME: scripts/fetch-coursera-courses.mjs. Two implementations exist because one
// ABOUTME: runs in Deno and one in Node; this is what stops them drifting apart.

import { describe, it, expect } from 'vitest';
import {
  parseCoursePage,
  parseCourseUrl,
  extractApolloState,
  isoDurationToHours,
  truncate,
} from '../../../supabase/functions/coursera-refresh/parser';
// The script guards its entry point so importing it does not start a crawl.
import { parseCoursePage as parseCoursePageNode } from '../../../scripts/fetch-coursera-courses.mjs';

/**
 * Minimal stand-in for a real course page. Real pages are ~880KB, far too large to
 * commit, but the parser only ever reads this handful of Apollo nodes.
 */
function makePage(overrides: Record<string, unknown> = {}): string {
  const state = {
    'DescriptionPage_CoursePage:abc': {
      __typename: 'DescriptionPage_CoursePage',
      id: 'abc',
      name: 'Supervised Machine Learning: Regression and Classification',
      slug: 'machine-learning',
      // Braces and quotes inside a string value: the reason extraction is
      // brace-matched with string awareness rather than regex-captured.
      description: 'Build ML models in Python. Uses {curly braces} and "quotes" inline.',
      difficultyLevel: 'BEGINNER',
      primaryLanguages: ['en'],
      // Availability, not the teaching language — must be ignored.
      subtitleLanguages: ['es', 'fr', 'zh-CN'],
      totalEnrollmentCount: 1219611,
      ratings: { __ref: 'Ratings:abc' },
      partners: [{ __ref: 'DescriptionPage_Partner:475' }],
      skillTags: [
        { __ref: 'DescriptionPage_SkillTag:a' },
        { __ref: 'DescriptionPage_SkillTag:b' },
      ],
      material: { __ref: 'DescriptionPage_WeeklyMaterial:m' },
      ...overrides,
    },
    'Ratings:abc': {
      __typename: 'DescriptionPage_Ratings',
      averageFiveStarRating: 4.896022201665125,
      ratingCount: 32430,
    },
    'DescriptionPage_Partner:475': {
      __typename: 'DescriptionPage_Partner',
      id: '475',
      name: 'DeepLearning.AI',
    },
    'DescriptionPage_SkillTag:a': { __typename: 'DescriptionPage_SkillTag', name: 'Python Programming' },
    'DescriptionPage_SkillTag:b': { __typename: 'DescriptionPage_SkillTag', name: 'Machine Learning' },
    'DescriptionPage_WeeklyMaterial:m': {
      __typename: 'DescriptionPage_WeeklyMaterial',
      totalDuration: 'PT7H4M54S',
    },
    'DescriptionPage_Review:r1': {
      __typename: 'DescriptionPage_Review',
      rating: 5,
      comment: 'Excellent   course,  well   paced.',
    },
  };

  return [
    '<!doctype html><html><head><title>x</title></head><body>',
    '<script>window.__APOLLO_STATE__ = ',
    JSON.stringify(state),
    ';</script></body></html>',
  ].join('');
}

const URL = 'https://www.coursera.org/learn/machine-learning';

describe('parseCourseUrl', () => {
  it('maps each Coursera path prefix to its format', () => {
    expect(parseCourseUrl('https://www.coursera.org/learn/x')).toMatchObject({
      slug: 'x',
      format: 'Course',
    });
    expect(parseCourseUrl('https://www.coursera.org/specializations/y')).toMatchObject({
      slug: 'y',
      format: 'Specialization',
    });
    // The distinction the old hand-built catalog got wrong 11 times.
    expect(parseCourseUrl('https://www.coursera.org/professional-certificates/z')).toMatchObject({
      slug: 'z',
      format: 'Professional Certificate',
    });
  });

  it('canonicalizes the URL, dropping query and fragment', () => {
    expect(parseCourseUrl('http://coursera.org/learn/abc?utm_source=x#syllabus')?.url).toBe(
      'https://www.coursera.org/learn/abc',
    );
  });

  it('rejects paths outside the three course prefixes', () => {
    expect(parseCourseUrl('https://www.coursera.org/browse/data-science')).toBeNull();
    expect(parseCourseUrl('https://example.com/learn/abc')).toBeNull();
    expect(parseCourseUrl('')).toBeNull();
  });
});

describe('extractApolloState', () => {
  it('reads a blob containing braces and quotes inside string values', () => {
    const state = extractApolloState(makePage());
    expect(state).not.toBeNull();
    expect(Object.keys(state!)).toContain('DescriptionPage_CoursePage:abc');
  });

  it('returns null when the page has no blob', () => {
    expect(extractApolloState('<html><body>nothing here</body></html>')).toBeNull();
  });

  it('returns null rather than throwing on a truncated blob', () => {
    expect(extractApolloState('<script>window.__APOLLO_STATE__ = {"a": {"b": 1}')).toBeNull();
  });
});

describe('isoDurationToHours', () => {
  it('converts hours, minutes and seconds', () => {
    expect(isoDurationToHours('PT7H4M54S')).toBe(7.1);
    expect(isoDurationToHours('PT2M44S')).toBe(0);
    expect(isoDurationToHours('PT30M')).toBe(0.5);
  });

  it('returns null for anything unparseable', () => {
    expect(isoDurationToHours('7 hours')).toBeNull();
    expect(isoDurationToHours(null)).toBeNull();
  });
});

describe('truncate', () => {
  it('collapses whitespace and cuts on a word boundary', () => {
    expect(truncate('a   b\n\nc', 100)).toBe('a b c');
    const long = truncate('alpha beta gamma delta epsilon', 14);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(15);
  });
});

describe('parseCoursePage', () => {
  it('extracts the fields the catalog stores', () => {
    const result = parseCoursePage(makePage(), URL);
    expect('course' in result).toBe(true);
    if (!('course' in result)) return;

    expect(result.course).toMatchObject({
      slug: 'machine-learning',
      url: URL,
      format: 'Course',
      partner: 'DeepLearning.AI',
      level: 'Beginner',
      rating: 4.9,
      reviews: 32430,
      enrolled: 1219611,
      estimatedHours: 7.1,
    });
    expect(result.course.skills).toEqual(['Python Programming', 'Machine Learning']);
    expect(result.course.languages).toEqual(['en']);
    expect(result.course.topReviews[0].comment).toBe('Excellent course, well paced.');
  });

  it('returns empty partner rather than a "Coursera" placeholder', () => {
    // Some real pages ship a payload with no partner nodes at all. Inventing an
    // attribution is worse than dropping the row, which is what the caller does.
    const page = makePage().replace(/"DescriptionPage_Partner:475":\{[^}]*\}/, '"unused":{}');
    const result = parseCoursePage(page.replace(/"partners":\[[^\]]*\]/, '"partners":[]'), URL);
    if (!('course' in result)) throw new Error('expected a parsed course');
    expect(result.course.partner).toBe('');
  });

  it('reads the teaching language, not the subtitle list', () => {
    // A popular English course lists dozens of subtitle languages; using those would
    // make every course look multilingual and defeat the filter.
    const spanish = parseCoursePage(makePage({ primaryLanguages: ['es'] }), URL);
    if (!('course' in spanish)) throw new Error('expected a parsed course');
    expect(spanish.course.languages).toEqual(['es']);

    const unknown = parseCoursePage(makePage({ primaryLanguages: null }), URL);
    if (!('course' in unknown)) throw new Error('expected a parsed course');
    // Empty means unknown — the caller keeps the row rather than hiding it.
    expect(unknown.course.languages).toEqual([]);
  });

  it('defaults an unlabelled level to Intermediate', () => {
    const result = parseCoursePage(makePage({ difficultyLevel: null }), URL);
    if (!('course' in result)) throw new Error('expected a parsed course');
    expect(result.course.level).toBe('Intermediate');
  });

  it('reports a reason instead of throwing on a page it cannot read', () => {
    expect(parseCoursePage('<html></html>', URL)).toEqual({ error: 'no state blob' });
    expect(parseCoursePage(makePage(), 'https://example.com/x')).toEqual({
      error: 'unsupported url',
    });
  });
});

describe('parser equivalence with scripts/fetch-coursera-courses.mjs', () => {
  it('extracts the same facts from the same page', () => {
    const html = makePage();
    const edge = parseCoursePage(html, URL);
    const node = parseCoursePageNode(html, URL) as Record<string, any>;

    if (!('course' in edge)) throw new Error('edge parser failed');
    expect(node.error).toBeUndefined();

    // Shapes differ on purpose — the script emits CSV-shaped rows and normalizes
    // `level` on the way out — so compare the extracted facts, not the envelopes.
    expect(node.title).toBe(edge.course.title);
    expect(node.partner).toBe(edge.course.partner);
    expect(node.description).toBe(edge.course.description);
    expect(node.rating).toBe(edge.course.rating);
    expect(node.reviews).toBe(edge.course.reviews);
    expect(node.enrolled).toBe(edge.course.enrolled);
    expect(node.estimatedHours).toBe(edge.course.estimatedHours);
    expect(node.skills).toEqual(edge.course.skills);
    expect(node.reviewComments).toEqual(edge.course.topReviews);
    expect(node.languages).toEqual(edge.course.languages);
    // The script keeps Coursera's raw casing; the Edge Function normalizes it.
    expect(String(node.level).toLowerCase()).toContain(edge.course.level.toLowerCase());
  });

  it('agrees that a page with no blob is unreadable', () => {
    const html = '<html><body>no state</body></html>';
    expect(parseCoursePage(html, URL)).toEqual({ error: 'no state blob' });
    expect((parseCoursePageNode(html, URL) as Record<string, any>).error).toBe('no state blob');
  });
});
