// ABOUTME: Pulls course facts out of a Coursera course page. Deliberately free of
// ABOUTME: Deno and Node APIs — pure string/JSON work — so vitest can import it and
// ABOUTME: assert it agrees with scripts/fetch-coursera-courses.mjs, which
// ABOUTME: reimplements the same extraction for local bulk runs.

export interface ParsedCourse {
  url: string;
  slug: string;
  format: 'Course' | 'Specialization' | 'Professional Certificate';
  title: string;
  /** Empty when the page shipped no partner node — the caller must reject the row. */
  partner: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number | null;
  reviews: number | null;
  enrolled: number | null;
  estimatedHours: number | null;
  skills: string[];
  description: string;
  topReviews: Array<{ rating: number | null; comment: string }>;
}

/** How many skill tags to keep. Subjects are inferred from exactly these. */
export const MAX_SKILLS = 8;
/** Description cap. Keeps rows small; full prose is not worth storing. */
export const MAX_DESCRIPTION = 180;

const URL_FORMATS: Record<string, ParsedCourse['format']> = {
  learn: 'Course',
  specializations: 'Specialization',
  'professional-certificates': 'Professional Certificate',
};

/**
 * Slug, canonical URL and format from a course URL.
 *
 * The path prefix is the authority for format. Deriving the prefix from a format
 * field instead is what previously produced 11 broken links out of 34: Coursera
 * serves professional certificates from /professional-certificates/, not
 * /specializations/.
 */
export function parseCourseUrl(raw: string): Pick<ParsedCourse, 'slug' | 'url' | 'format'> | null {
  const match = /coursera\.org\/(learn|specializations|professional-certificates)\/([^/?#]+)/.exec(
    raw ?? '',
  );
  if (!match) return null;
  return {
    slug: match[2],
    format: URL_FORMATS[match[1]],
    // Rebuilt rather than passed through, to drop tracking params.
    url: `https://www.coursera.org/${match[1]}/${match[2]}`,
  };
}

/**
 * Extract the Apollo cache from a course page.
 *
 * Brace-matched rather than regex-captured. The blob is ~150KB of nested JSON with
 * braces inside string values, which a lazy regex truncates in the wrong place, and
 * a greedy one runs past the end of.
 */
export function extractApolloState(html: string): Record<string, unknown> | null {
  const markerAt = html.indexOf('window.__APOLLO_STATE__');
  if (markerAt === -1) return null;

  const start = html.indexOf('{', markerAt);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type Node = Record<string, any>;

function nodesOfType(state: Record<string, unknown>, typename: string): Node[] {
  return Object.values(state).filter(
    (node): node is Node =>
      !!node && typeof node === 'object' && (node as Node).__typename === typename,
  );
}

/** Resolve Apollo's `{__ref: "Type:id"}` indirection, including inside arrays. */
function deref(state: Record<string, unknown>, value: any): any {
  if (Array.isArray(value)) return value.map((item) => deref(state, item));
  if (value && typeof value === 'object' && typeof value.__ref === 'string') {
    return (state as Node)[value.__ref] ?? null;
  }
  return value;
}

/** "PT7H4M54S" -> 7.1 hours. */
export function isoDurationToHours(value: unknown): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value ?? ''));
  if (!match) return null;
  const hours = Number(match[1] ?? 0) + Number(match[2] ?? 0) / 60 + Number(match[3] ?? 0) / 3600;
  return hours > 0 ? Math.round(hours * 10) / 10 : null;
}

function collapse(text: unknown): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: unknown, limit: number): string {
  const collapsed = collapse(text);
  if (collapsed.length <= limit) return collapsed;
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).trimEnd()}…`;
}

function parseLevel(raw: unknown): ParsedCourse['level'] {
  const match = /(beginner|intermediate|advanced)/i.exec(String(raw ?? ''));
  if (!match) return 'Intermediate';
  const word = match[1].toLowerCase();
  return (word[0].toUpperCase() + word.slice(1)) as ParsedCourse['level'];
}

/**
 * Normalize one fetched course page.
 *
 * Returns `{ error }` rather than throwing: a crawl over thousands of pages hits
 * enough odd payloads that a failure has to be a record, not an exception.
 */
export function parseCoursePage(
  html: string,
  url: string,
): { course: ParsedCourse } | { error: string } {
  const parsedUrl = parseCourseUrl(url);
  if (!parsedUrl) return { error: 'unsupported url' };

  const state = extractApolloState(html);
  if (!state) return { error: 'no state blob' };

  const page =
    nodesOfType(state, 'DescriptionPage_CoursePage')[0] ??
    nodesOfType(state, 'DescriptionPage_SpecializationPage')[0] ??
    nodesOfType(state, 'DescriptionPage_Specialization')[0];
  if (!page) return { error: 'no course node' };

  const title = truncate(page.name, 120);
  if (!title) return { error: 'no title' };

  const partners: string[] = (deref(state, page.partners) ?? [])
    .map((partner: Node | null) => partner?.name)
    .filter(Boolean);

  // Empty rather than a "Coursera" placeholder when nothing is found. Some pages
  // ship a payload with no partner nodes at all, and a placeholder is
  // indistinguishable from the genuine "Coursera Instructor Network" partner once
  // stored. The caller rejects rows with no partner.
  const partner = partners[0] ?? nodesOfType(state, 'DescriptionPage_Partner')[0]?.name ?? '';

  // Slice before returning: subjects are inferred from exactly the skills stored,
  // so anything not stored must not have influenced classification.
  const skills = [
    ...new Set(
      (deref(state, page.skillTags) ?? nodesOfType(state, 'DescriptionPage_SkillTag'))
        .map((tag: Node | null) => collapse(tag?.name))
        .filter(Boolean),
    ),
  ].slice(0, MAX_SKILLS) as string[];

  const ratings = deref(state, page.ratings) ?? {};
  const rawRating = ratings.averageFiveStarRating ?? page.averageFiveStarRating ?? null;
  const rawReviews = ratings.ratingCount ?? page.ratingCount ?? null;

  // Course pages nest week records under `material.weeks`; some payloads point
  // `material` straight at a single week instead. Normalize to an array so one
  // shape does not silently yield a null duration.
  const material = deref(state, page.material);
  const derefedWeeks = material ? deref(state, material.weeks ?? material) : null;
  const weeks: Node[] = Array.isArray(derefedWeeks)
    ? derefedWeeks
    : derefedWeeks
      ? [derefedWeeks]
      : [];
  const totalHours = weeks.reduce(
    (sum: number, week: Node) => sum + (isoDurationToHours(week?.totalDuration) ?? 0),
    0,
  );

  const topReviews = nodesOfType(state, 'DescriptionPage_Review')
    .map((review) => ({
      rating: review.rating ?? null,
      comment: collapse(review.comment).slice(0, 400),
    }))
    .filter((review) => review.comment)
    .slice(0, 5);

  return {
    course: {
      ...parsedUrl,
      title,
      partner,
      level: parseLevel(page.difficultyLevel),
      rating: rawRating === null ? null : Math.round(Number(rawRating) * 100) / 100,
      reviews: rawReviews === null ? null : Number(rawReviews),
      enrolled: page.totalEnrollmentCount ? Number(page.totalEnrollmentCount) : null,
      estimatedHours: totalHours > 0 ? Math.round(totalHours * 10) / 10 : null,
      skills,
      description: truncate(page.description, MAX_DESCRIPTION),
      topReviews,
    },
  };
}

/**
 * Subjects mentioned in the given text, using a keyword table loaded from the
 * database. Word-boundary matched and case-insensitive, so "ml" fires on "ML/AI"
 * but not inside "html".
 *
 * Mirrors inferSubjects() in src/data/learningSubjects.ts. Both ultimately read
 * src/data/subjectKeywords.json — the app imports it, the database is seeded from
 * it — and a test asserts the two agree.
 */
export function inferSubjects(
  keywordsBySubject: Map<string, string[]>,
  subjectOrder: string[],
  ...fragments: Array<string | null | undefined>
): string[] {
  const haystack = fragments.filter(Boolean).join(' \n ');
  if (!haystack.trim()) return [];

  return subjectOrder.filter((subject) =>
    (keywordsBySubject.get(subject) ?? []).some((keyword) =>
      new RegExp(
        `(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
        'i',
      ).test(haystack),
    ),
  );
}
