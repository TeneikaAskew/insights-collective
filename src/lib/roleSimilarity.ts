// ABOUTME: Ranks career roles by how similar their *content* is — description,
// ABOUTME: responsibilities, skills, tools, collaborators, day/month in the life,
// ABOUTME: project timeline and career path. Pay is deliberately not an input:
// ABOUTME: the wage figures live in `career_role_wages` (BLS) and two roles that
// ABOUTME: pay alike are not thereby similar work. Pure functions, no fetching.

import { dataCareerRoles, type DataCareerRole } from '@/data/dataCareerRoles';
import { eng } from '@/lib/stopwords_eng';

/** One neighbour of a role, ordered by descending `score`. */
export interface SimilarRole {
  role: DataCareerRole;
  /**
   * Cosine similarity of the two roles' tf-idf vectors, in [0, 1]. Useful for
   * ordering and for thresholds; it is not a percentage anyone should read as
   * "83% the same job", so surfaces show the shared skills instead.
   */
  score: number;
  /**
   * Skills and tools both roles list, matched case-insensitively and rendered
   * in the neighbour's own casing. This is the human-readable "why" behind the
   * ranking — the score itself is driven by the whole text, not just these.
   */
  sharedSkills: string[];
}

/**
 * How many times each field's tokens are counted. Skills and tools are the most
 * concentrated signal per word, so they weigh heaviest; the long prose fields
 * carry plenty of tokens on their own and would swamp everything else at parity.
 */
const FIELD_WEIGHTS = {
  title: 3,
  category: 2,
  shortDescription: 2,
  longDescription: 2,
  responsibilities: 2,
  skills: 4,
  tools: 3,
  collaborators: 1,
  dayInLife: 1,
  monthInLife: 1,
  schedule: 1,
  projectTimeline: 1,
  careerPath: 1,
} as const;

/**
 * Short tokens worth keeping. The length floor below drops one- and two-letter
 * noise, which in this vocabulary would otherwise take "AI", "ML" and "BI" with
 * it — the three most discriminating tokens in the whole catalog.
 */
const SHORT_TOKEN_ALLOWLIST = new Set(['ai', 'ml', 'bi', 'qa', 'ux', 'ui', 'nl', 'ab', 'r']);

const STOPWORDS = new Set(eng as string[]);

/**
 * Words that appear in nearly every role and describe the domain rather than
 * the job. Inverse document frequency already discounts them, but they are
 * frequent enough inside a single role that leaving them in lets tf alone push
 * two unrelated roles together.
 */
const DOMAIN_STOPWORDS = new Set([
  'data',
  'work',
  'working',
  'team',
  'teams',
  'role',
  'roles',
  'year',
  'years',
  'week',
  'weeks',
  'month',
  'months',
  'day',
  'days',
  'time',
  'typical',
  'various',
  'new',
  'help',
  'use',
  'using',
  'need',
  'needs',
  'may',
  'might',
  'business',
  'company',
  'organization',
  'organizations',
]);

/**
 * Light suffix stripping so "modeling"/"models"/"model" collapse to one term.
 * Deliberately not a full Porter stemmer: the vocabulary is small and the
 * failure mode of over-stemming (merging unrelated terms) costs more here than
 * the occasional missed pair.
 */
const stem = (token: string): string => {
  let out = token;
  if (out.length > 4 && out.endsWith('ies')) out = `${out.slice(0, -3)}y`;
  else if (out.length > 5 && (out.endsWith('sses') || out.endsWith('shes') || out.endsWith('ches'))) out = out.slice(0, -2);
  else if (out.length > 3 && out.endsWith('s') && !out.endsWith('ss') && !out.endsWith('us')) out = out.slice(0, -1);
  if (out.length > 5 && out.endsWith('ing')) out = out.slice(0, -3);
  else if (out.length > 4 && out.endsWith('ed')) out = out.slice(0, -2);
  if (out.length > 5 && out.endsWith('ment')) out = out.slice(0, -4);
  return out;
};

/**
 * Splits prose into stemmed content tokens. `+` and `#` survive so "C++" and
 * "C#" stay distinct from "c"; everything else non-alphanumeric is a boundary,
 * which also splits the slashed tool names ("Python/R", "Tableau/Power BI").
 */
export const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#]+/)) {
    if (!raw) continue;
    if (/^\d+$/.test(raw)) continue;
    // Checked before the stoplist, not after: the generic English list contains
    // "bi" and "qa", which here are the abbreviations two whole roles turn on.
    if (SHORT_TOKEN_ALLOWLIST.has(raw)) {
      tokens.push(raw);
      continue;
    }
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw) || DOMAIN_STOPWORDS.has(raw)) continue;
    const stemmed = stem(raw);
    if (!stemmed || STOPWORDS.has(stemmed) || DOMAIN_STOPWORDS.has(stemmed)) continue;
    tokens.push(stemmed);
  }
  return tokens;
};

/** Every text fragment a role contributes, paired with its field weight. */
const weightedFragments = (role: DataCareerRole): Array<[string, number]> => {
  const fragments: Array<[string, number]> = [
    [role.title, FIELD_WEIGHTS.title],
    [role.category, FIELD_WEIGHTS.category],
    [role.shortDescription ?? '', FIELD_WEIGHTS.shortDescription],
    [role.longDescription ?? '', FIELD_WEIGHTS.longDescription],
    [(role.responsibilities ?? []).join(' '), FIELD_WEIGHTS.responsibilities],
    [(role.skills ?? []).join(' '), FIELD_WEIGHTS.skills],
    [(role.tools ?? []).join(' '), FIELD_WEIGHTS.tools],
    [(role.collaborators ?? []).join(' '), FIELD_WEIGHTS.collaborators],
    [role.dayInLife ?? '', FIELD_WEIGHTS.dayInLife],
    [role.monthInLife ?? '', FIELD_WEIGHTS.monthInLife],
    [(role.schedule ?? []).map(slot => slot.activity).join(' '), FIELD_WEIGHTS.schedule],
    [
      (role.projectTimeline ?? [])
        .map(phase => [phase.title, phase.description, ...(phase.activities ?? [])].join(' '))
        .join(' '),
      FIELD_WEIGHTS.projectTimeline,
    ],
    [
      role.careerPath
        ? [
            role.careerPath.description,
            ...role.careerPath.progressionSteps.map(step => `${step.title} ${step.description}`),
          ].join(' ')
        : '',
      FIELD_WEIGHTS.careerPath,
    ],
  ];
  return fragments.filter(([text]) => text.trim().length > 0);
};

/** L2-normalised tf-idf vector, keyed by term. */
type RoleVector = Map<string, number>;

interface SimilarityIndex {
  vectors: Map<string, RoleVector>;
  rolesById: Map<string, DataCareerRole>;
  order: string[];
}

const buildIndex = (roles: DataCareerRole[]): SimilarityIndex => {
  const counts = new Map<string, Map<string, number>>();
  const documentFrequency = new Map<string, number>();

  for (const role of roles) {
    const termCounts = new Map<string, number>();
    for (const [text, weight] of weightedFragments(role)) {
      for (const term of tokenize(text)) {
        termCounts.set(term, (termCounts.get(term) ?? 0) + weight);
      }
    }
    counts.set(role.id, termCounts);
    for (const term of termCounts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = roles.length;
  const vectors = new Map<string, RoleVector>();
  for (const role of roles) {
    const vector: RoleVector = new Map();
    let sumOfSquares = 0;
    for (const [term, count] of counts.get(role.id)!) {
      // Sublinear tf keeps a term repeated in six responsibilities from
      // outweighing six distinct terms; idf discounts what everyone says.
      const tf = 1 + Math.log(count);
      const idf = Math.log((total + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
      const weight = tf * idf;
      vector.set(term, weight);
      sumOfSquares += weight * weight;
    }
    const norm = Math.sqrt(sumOfSquares);
    if (norm > 0) {
      for (const [term, weight] of vector) vector.set(term, weight / norm);
    }
    vectors.set(role.id, vector);
  }

  return {
    vectors,
    rolesById: new Map(roles.map(role => [role.id, role])),
    order: roles.map(role => role.id),
  };
};

/**
 * One index per role array. The catalog is a module constant, so in the app
 * this builds once for the whole session; tests passing their own fixtures get
 * their own entry and the map does not retain them.
 */
const indexCache = new WeakMap<DataCareerRole[], SimilarityIndex>();

const indexFor = (roles: DataCareerRole[]): SimilarityIndex => {
  const cached = indexCache.get(roles);
  if (cached) return cached;
  const index = buildIndex(roles);
  indexCache.set(roles, index);
  return index;
};

const cosine = (a: RoleVector, b: RoleVector): number => {
  // Iterate the shorter vector; both are already L2-normalised, so the dot
  // product is the cosine.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  return dot;
};

const sharedSkillsBetween = (role: DataCareerRole, other: DataCareerRole): string[] => {
  const mine = new Set([...(role.skills ?? []), ...(role.tools ?? [])].map(item => item.toLowerCase().trim()));
  const seen = new Set<string>();
  const shared: string[] = [];
  for (const item of [...(other.skills ?? []), ...(other.tools ?? [])]) {
    const key = item.toLowerCase().trim();
    if (!mine.has(key) || seen.has(key)) continue;
    seen.add(key);
    shared.push(item);
  }
  return shared;
};

export interface SimilarRolesOptions {
  /** Catalog to rank within. Defaults to the bundled career roles. */
  roles?: DataCareerRole[];
  /** How many neighbours to return. Default 5. */
  limit?: number;
}

/**
 * The `limit` roles closest in content to `roleId`, most similar first.
 *
 * Returns `[]` for an unknown id or a single-role catalog. Ties break on title
 * so the list is stable across renders — a career page that reshuffled its
 * "similar roles" on every open would read as noise.
 */
export const getSimilarRoles = (roleId: string, options: SimilarRolesOptions = {}): SimilarRole[] => {
  const { roles = dataCareerRoles, limit = 5 } = options;
  const index = indexFor(roles);
  const source = index.rolesById.get(roleId);
  if (!source) return [];
  const sourceVector = index.vectors.get(roleId)!;

  const scored: SimilarRole[] = [];
  for (const otherId of index.order) {
    if (otherId === roleId) continue;
    const other = index.rolesById.get(otherId)!;
    const score = cosine(sourceVector, index.vectors.get(otherId)!);
    if (score <= 0) continue;
    scored.push({ role: other, score, sharedSkills: sharedSkillsBetween(source, other) });
  }

  scored.sort((a, b) => b.score - a.score || a.role.title.localeCompare(b.role.title));
  return scored.slice(0, Math.max(0, limit));
};
