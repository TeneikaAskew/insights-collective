// ABOUTME: Binds the catalog's ?category= URL slug to fetched course category names, without a live taxonomy query.
// ABOUTME: Resolution order: stored name slug, then CATEGORY_DISPLAY_MAP group, then the documented legacy footer alias.
import { CATEGORY_DISPLAY_MAP, getCategoryDisplayName } from '@/constants/courseCategories';

/** "AI/ML" -> "ai-ml", "Analytics & BI" -> "analytics-bi", "Données & IA" -> "données-ia", "数据科学" -> "数据科学".
 *  NFKC + lowercase, then every run of characters that are not Unicode letters or numbers becomes one "-", so an
 *  already-slugged value maps to itself and QuizResults' "analytics-&-bi" normalises to "analytics-bi".
 *  Builder Category is free text, so a name with no letters or numbers at all (e.g. "!!!") keeps its own trimmed,
 *  lowercased text as its slug: it stays selectable and round-trips instead of vanishing. Only a missing or
 *  blank value gives "". */
export function categorySlug(name: unknown): string {
  if (typeof name !== 'string') return '';
  const text = name.normalize('NFKC').trim().toLowerCase();
  const slug = text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug || text;
}

/** The selector's "All categories" value. No categorySlug output can equal it (slugs with letters never contain
 *  "_", and the letterless fallback cannot contain "all"), so a stored category named "All" is a real category. */
export const ALL_CATEGORIES = '__all__';

/**
 * Footer links are the expected input contract: ai-ml, analytics, data-engineering, business-intelligence.
 * Three resolve from source without an alias (data-engineering by name; ai-ml and business-intelligence through
 * CATEGORY_DISPLAY_MAP keys "AI/ML" and "Business Intelligence"). "analytics" matches no name or map key, so it is
 * the ONE explicit alias. It points at the display group "Analytics & BI" because that is the only group in the
 * source taxonomy (COURSE_CATEGORIES.ANALYTICS_BI, VALID_CATEGORIES, CATEGORY_DISPLAY_MAP values, FeaturedCourses
 * colours) whose label contains "Analytics". It is a UI-label mapping, not a claim about stored category values.
 */
export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, string>> = { analytics: 'Analytics & BI' };

/** Display group a slug names: a group label itself, a CATEGORY_DISPLAY_MAP key, or a legacy alias. */
function groupForSlug(slug: string): string | null {
  for (const [key, group] of Object.entries(CATEGORY_DISPLAY_MAP)) {
    if (categorySlug(key) === slug || categorySlug(group) === slug) return group;
  }
  return LEGACY_CATEGORY_ALIASES[slug] ?? null;
}

export type CategoryResolution =
  /** No ?category= (or an empty one): All. */
  | { kind: 'none' }
  /** The slug names one or more fetched category names; `names` is exactly the set the filter keeps.
   *  `optionValue`/`optionLabel` is the selector entry that represents exactly that set: the stored name's own
   *  option when the set is one name, otherwise a group option labelled distinctly from every stored name. */
  | { kind: 'match'; slug: string; label: string; names: string[]; via: 'name' | 'group'; optionValue: string; optionLabel: string; groupOption: boolean }
  /** A non-blank value that names nothing fetched: the page drops ONLY the category filter AND says so; it never
   *  presents this as a selected category. Distinct from 'none' (absent or blank). */
  | { kind: 'unknown'; slug: string; raw: string };

export function resolveCategoryParam(raw: string | null, loadedNames: readonly string[]): CategoryResolution {
  if (raw == null || raw.trim() === '') return { kind: 'none' };
  const slug = categorySlug(raw);
  const names = [...new Set(loadedNames.filter((n) => typeof n === 'string' && n !== ''))];

  // 1. A fetched name whose own slug matches wins (two names sharing a slug are both kept).
  const byName = names.filter((n) => categorySlug(n) === slug);
  if (byName.length) {
    return { kind: 'match', slug, label: byName[0], names: byName, via: 'name', optionValue: slug, optionLabel: byName[0], groupOption: false };
  }

  // 2. Otherwise a display group: every fetched name whose display group is that group.
  const group = groupForSlug(slug);
  if (group) {
    const inGroup = names.filter((n) => getCategoryDisplayName(n) === group);
    if (inGroup.length === 1) {
      // One stored name: select that name's own option, so the menu never shows two entries with one label.
      const only = inGroup[0];
      return { kind: 'match', slug, label: only, names: inGroup, via: 'group', optionValue: categorySlug(only), optionLabel: only, groupOption: false };
    }
    if (inGroup.length > 1) {
      // Several stored names: a separate entry for the whole group, never labelled like any one of them.
      const optionLabel = `All in ${group} (${inGroup.length} categories)`;
      return { kind: 'match', slug, label: group, names: inGroup, via: 'group', optionValue: slug, optionLabel, groupOption: true };
    }
  }
  return { kind: 'unknown', slug, raw: raw ?? '' };
}

export type CategoryMenuKind = 'all' | 'category' | 'group';
export type CategoryMenuEntry = { value: string; label: string; kind: CategoryMenuKind };

/** The word appended when an entry's caption collides with another entry's. */
export const CATEGORY_MENU_KIND_WORD: Readonly<Record<CategoryMenuKind, string>> = {
  all: 'show all',
  category: 'category',
  group: 'group',
};

/**
 * The ONE whitespace normalization for menu names: every run of Unicode whitespace (spaces, tabs, newlines, NBSP,
 * ...) becomes a single space, then the ends are trimmed. This is how rendered text and computed accessible names
 * treat whitespace, so it is the collision key, the rendered text and the final validation. It never casefolds or
 * transliterates, and it is display-only: stored taxonomy, slugs, URL values and matched name sets keep raw text.
 */
export function normalizeMenuName(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/** Throws unless every text is non-empty, already normalized, and distinct from every other text after normalization. */
export function assertUniqueMenuNames(texts: readonly string[]): void {
  const seen = new Set<string>();
  for (const t of texts) {
    const key = normalizeMenuName(t);
    if (key === '' || key !== t) throw new Error(`category menu name is not normalized: ${JSON.stringify(t)}`);
    if (seen.has(key)) throw new Error(`category menu name is not unique: ${JSON.stringify(t)}`);
    seen.add(key);
  }
}

/**
 * Gives every menu entry a unique visible text, which is also its computed accessible name, for ANY finite list of
 * entries with free-text labels. Every comparison uses normalizeMenuName, and every text it renders is normalized.
 *
 * 1. Each text starts as its normalized label.
 * 2. Kind rounds: while some colliding group still has an entry that was never kind-qualified, each such entry gets
 *    its kind word once ("All categories (show all)", "... (category)", "... (group)"). Every round qualifies at
 *    least one entry and an entry is qualified at most once, so there are at most N rounds; no pass cap is assumed.
 * 3. Numbering: texts that are now unique are reserved. Then, in menu order, the first holder of a still-shared text
 *    keeps it if nobody holds it yet, and every other holder takes the smallest "text #k" (k >= 2) nobody holds.
 *    Fewer than N texts are held at any time, so some k <= N + 1 is free: the search ends, and every assignment is
 *    checked against every text already held, so the final texts are pairwise distinct.
 * 4. assertUniqueMenuNames re-checks the result, so a violation can never render silently.
 *
 * Entries whose normalized label collides with nothing keep it unchanged. Values, kinds and order are kept.
 */
export function disambiguateCategoryMenu(entries: readonly CategoryMenuEntry[]): (CategoryMenuEntry & { text: string })[] {
  const out = entries.map((e) => ({ ...e, text: normalizeMenuName(e.label) || normalizeMenuName(e.value), qualified: false }));
  const counts = () => {
    const c = new Map<string, number>();
    for (const e of out) c.set(e.text, (c.get(e.text) ?? 0) + 1);
    return c;
  };

  for (;;) {
    const c = counts();
    const toQualify = out.filter((e) => !e.qualified && c.get(e.text)! > 1);
    if (!toQualify.length) break;
    for (const e of toQualify) {
      e.text = normalizeMenuName(`${e.text} (${CATEGORY_MENU_KIND_WORD[e.kind]})`);
      e.qualified = true;
    }
  }

  const c = counts();
  const held = new Set(out.filter((e) => c.get(e.text) === 1).map((e) => e.text));
  for (const e of out) {
    if (c.get(e.text) === 1) continue;
    if (!held.has(e.text)) { held.add(e.text); continue; }
    let k = 2;
    while (held.has(`${e.text} #${k}`)) k++;
    e.text = `${e.text} #${k}`;
    held.add(e.text);
  }

  const result = out.map(({ qualified, ...e }) => e);
  assertUniqueMenuNames(result.map((e) => e.text));
  return result;
}
