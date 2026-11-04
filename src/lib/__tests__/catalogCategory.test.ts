// ABOUTME: Contract for the catalog ?category= slug and its resolution against fetched names and CATEGORY_DISPLAY_MAP.
// ABOUTME: Pure functions; fixture names only, never a claim about stored production values.
import { describe, it, expect } from 'vitest';
import { ALL_CATEGORIES, categorySlug, resolveCategoryParam, LEGACY_CATEGORY_ALIASES } from '@/lib/catalogCategory';

describe('categorySlug', () => {
  it.each([
    ['AI/ML', 'ai-ml'],
    ['ML/AI', 'ml-ai'],
    ['Analytics & BI', 'analytics-bi'],
    ['Business Intelligence', 'business-intelligence'],
    ['  Data   Engineering ', 'data-engineering'],
    ['data-engineering', 'data-engineering'],
    ['analytics-&-bi', 'analytics-bi'], // QuizResults' own slugging of "Analytics & BI"
    ['', ''],
    [null, ''],
    [42, ''],
  ])('%j -> %j', (name, want) => expect(categorySlug(name)).toBe(want));
});

describe('resolveCategoryParam', () => {
  const NAMES = ['Data Science', 'Analytics & BI', 'Business Intelligence', 'AI/ML', 'Data Engineering', 'Productivity'];

  it.each([null, '', '   '])('%j (absent or blank) is none', (raw) => expect(resolveCategoryParam(raw, NAMES)).toEqual({ kind: 'none' }));

  it('a stored name match wins and keeps only that name', () => {
    expect(resolveCategoryParam('business-intelligence', NAMES)).toMatchObject({
      kind: 'match', slug: 'business-intelligence', label: 'Business Intelligence', names: ['Business Intelligence'], via: 'name',
    });
  });

  it('the only alias is analytics, to the display group Analytics & BI', () => {
    expect(LEGACY_CATEGORY_ALIASES).toEqual({ analytics: 'Analytics & BI' });
    expect(resolveCategoryParam('analytics', NAMES)).toMatchObject({
      kind: 'match', slug: 'analytics', label: 'Analytics & BI', names: ['Analytics & BI', 'Business Intelligence'], via: 'group',
    });
  });

  it('a CATEGORY_DISPLAY_MAP key resolves to its group when no stored name has the slug', () => {
    expect(resolveCategoryParam('ai-ml', ['ML/AI', 'Machine Learning & Artificial Intelligence', 'Data Science'])).toMatchObject({
      kind: 'match', slug: 'ai-ml', label: 'ML/AI', names: ['ML/AI', 'Machine Learning & Artificial Intelligence'], via: 'group',
    });
  });

  it('a known group with no fetched member is unknown, not a silent All', () => {
    expect(resolveCategoryParam('analytics', ['Data Science'])).toEqual({ kind: 'unknown', slug: 'analytics', raw: 'analytics' });
  });

  it('an unknown slug is unknown and keeps the raw text for the notice', () => {
    expect(resolveCategoryParam('Quantum!', NAMES)).toEqual({ kind: 'unknown', slug: 'quantum', raw: 'Quantum!' });
  });

  it('two stored names sharing a slug are both kept, labelled by the first', () => {
    expect(resolveCategoryParam('data-engineering', ['Data Engineering', 'Data-Engineering'])).toMatchObject({
      kind: 'match', label: 'Data Engineering', names: ['Data Engineering', 'Data-Engineering'],
    });
  });

  it('ignores empty and duplicate fetched names', () => {
    expect(resolveCategoryParam('ai-ml', ['', 'AI/ML', 'AI/ML'])).toMatchObject({ names: ['AI/ML'] });
  });
});

describe('P2 input contract (synthetic boundary values; not a claim about stored production names)', () => {
  const NAMES_P2 = ['Data Science', 'Analytics & BI', 'Business Intelligence', 'AI/ML', 'Data Engineering', 'Productivity'];
  it.each([
    ['数据科学', '数据科学'],
    ['Données & IA', 'données-ia'],
    ['Ｆｕｌｌｗｉｄｔｈ', 'fullwidth'], // NFKC
    ['!!!', '!!!'], // letterless free text keeps its own text and stays selectable
    [' !! ', '!!'],
    ['All', 'all'],
  ])('categorySlug(%j) is %j and non-empty', (name, want) => expect(categorySlug(name)).toBe(want));

  it('no slug can equal the reserved ALL_CATEGORIES value', () => {
    for (const n of ['All', '__all__', 'ALL', '_all_', '__', 'all categories']) expect(categorySlug(n)).not.toBe(ALL_CATEGORIES);
  });

  it.each(['数据科学', 'Données & IA', '!!!', 'All'])('a stored %j round-trips through its own slug', (name) => {
    expect(resolveCategoryParam(categorySlug(name), [name, 'Data Science'])).toMatchObject({ kind: 'match', names: [name], optionValue: categorySlug(name) });
  });

  it.each(['未知', '---', '!!!', 'all'])('a non-blank %j that names nothing fetched is unknown, not none', (raw) => {
    expect(resolveCategoryParam(raw, ['Data Science'])).toMatchObject({ kind: 'unknown', raw });
  });

  it.each([
    ['business-intelligence', NAMES_P2, 'business-intelligence', 'Business Intelligence', false],
    ['analytics', NAMES_P2, 'analytics', 'All in Analytics & BI (2 categories)', true],
    ['ai-ml', ['ML/AI', 'Machine Learning & Artificial Intelligence'], 'ai-ml', 'All in ML/AI (2 categories)', true],
  ])('?category=%s gives the selector entry for exactly its set', (slug, names, optionValue, optionLabel, groupOption) => {
    const r = resolveCategoryParam(slug, names);
    expect(r).toMatchObject({ kind: 'match', optionValue, optionLabel, groupOption });
    // A group entry's label can never be any stored name's own label.
    if (groupOption) expect(names).not.toContain(optionLabel);
  });

  it('a one-name group match selects that name\'s own option instead of adding a second, identically labelled one', () => {
    expect(resolveCategoryParam('ai-ml', ['ML/AI', 'Data Science'])).toMatchObject({
      kind: 'match', names: ['ML/AI'], optionValue: 'ml-ai', optionLabel: 'ML/AI', groupOption: false,
    });
  });
});
