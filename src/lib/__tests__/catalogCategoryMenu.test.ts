// ABOUTME: Contract for disambiguateCategoryMenu: every entry gets a unique text; non-colliding captions are unchanged.
// ABOUTME: Synthetic free-text names, including ones equal to generated or already-qualified captions.
import { describe, it, expect } from 'vitest';
import { ALL_CATEGORIES, assertUniqueMenuNames, disambiguateCategoryMenu, normalizeMenuName, type CategoryMenuEntry } from '@/lib/catalogCategory';

const texts = (e: CategoryMenuEntry[]) => disambiguateCategoryMenu(e).map((x) => x.text);
const all: CategoryMenuEntry = { value: ALL_CATEGORIES, label: 'All categories', kind: 'all' };
const cat = (label: string, value = label.toLowerCase()): CategoryMenuEntry => ({ value, label, kind: 'category' });
const grp = (label: string, value: string): CategoryMenuEntry => ({ value, label, kind: 'group' });

describe('disambiguateCategoryMenu', () => {
  it('leaves a menu with no collisions unchanged', () => {
    expect(texts([all, cat('Data Science'), grp('All in ML/AI (2 categories)', 'ai-ml')])).toEqual(['All categories', 'Data Science', 'All in ML/AI (2 categories)']);
  });

  it('qualifies both sides of a sentinel / stored-name collision by kind', () => {
    expect(texts([all, cat('All categories')])).toEqual(['All categories (show all)', 'All categories (category)']);
  });

  it('qualifies both sides of a group-caption / stored-name collision by kind', () => {
    expect(texts([cat('All in X (2 categories)', 'a'), grp('All in X (2 categories)', 'x')])).toEqual(['All in X (2 categories) (category)', 'All in X (2 categories) (group)']);
  });

  it('resolves a second-order collision with an already-qualified caption', () => {
    expect(texts([all, cat('All categories', 'a'), cat('All categories (show all)', 'b')])).toEqual([
      'All categories (show all)', 'All categories (category)', 'All categories (show all) (category)',
    ]);
  });

  it.each([
    [[all, cat('All categories', 'a'), cat('All categories (category)', 'b'), cat('All categories (show all)', 'c'), cat('All categories (show all) (category)', 'd')]],
    [[all, grp('All categories', 'g'), cat('All categories', 'c'), cat('All categories (group)', 'd')]],
  ])('always ends with unique texts and keeps every value (%#)', (entries) => {
    const out = disambiguateCategoryMenu(entries);
    expect(new Set(out.map((x) => x.text)).size).toBe(out.length);
    expect(out.map((x) => x.value)).toEqual(entries.map((x) => x.value));
    expect(out.map((x) => x.kind)).toEqual(entries.map((x) => x.kind));
  });
});

/** The display/accessibility whitespace rule, written out independently of the helper under test. */
const displayName = (t: string) => t.replace(/[\s\u00a0\u2028\u3000]+/gu, ' ').trim();

describe('disambiguateCategoryMenu: one whitespace normalization for keys, rendered text and validation', () => {
  it.each([
    ['leading space', ' All categories'],
    ['trailing space', 'All categories '],
    ['repeated space', 'All  categories'],
    ['tab', 'All\tcategories'],
    ['newline', 'All\ncategories'],
    ['NBSP', 'All\u00a0categories'],
    ['mixed', ' \n All \t\r categories\u3000'],
  ])('a stored name equal to "All categories" up to whitespace (%s) collides with the sentinel', (_, raw) => {
    expect(texts([all, cat(raw, 'all-categories')])).toEqual(['All categories (show all)', 'All categories (category)']);
  });

  it('a whitespace-varied group caption collides with the generated group caption', () => {
    expect(texts([cat('All in X\t(2  categories)', 'a'), grp('All in X (2 categories)', 'x')])).toEqual([
      'All in X (2 categories) (category)', 'All in X (2 categories) (group)',
    ]);
  });

  it('a whitespace-varied second-order caption collides with the qualified sentinel caption', () => {
    expect(texts([all, cat('All categories', 'a'), cat('All categories\n (show all) ', 'b')])).toEqual([
      'All categories (show all)', 'All categories (category)', 'All categories (show all) (category)',
    ]);
  });

  it('a non-colliding name renders normalized and otherwise unchanged (no casefold, no transliteration)', () => {
    expect(texts([all, cat('  Données\t&  IA ', 'donnees'), cat('data\nSCIENCE', 'ds')])).toEqual(['All categories', 'Données & IA', 'data SCIENCE']);
  });

  it('numbers identical qualified texts with the smallest free suffix, skipping one a stored name already holds', () => {
    expect(texts([cat('X', 'a'), cat('X ', 'b'), cat('X  (category) #2', 'c')])).toEqual(['X (category)', 'X (category) #3', 'X (category) #2']);
  });

  it('resolves a kind-qualification chain longer than 8 rounds with exact, unchanged-meaning names (no pass cap)', () => {
    const chain = Array.from({ length: 11 }, (_, j) => cat('All categories (show all)' + ' (category)'.repeat(j), `c${j}`));
    const out = texts([all, cat('All categories', 'a'), ...chain]);
    expect(out).toEqual([
      'All categories (show all)',
      'All categories (category)',
      ...chain.map((_, j) => 'All categories (show all)' + ' (category)'.repeat(j + 1)),
    ]);
    expect(out.some((t) => t.includes('['))).toBe(false);
  });

  it('resolves a numbering chain longer than 8 with a free suffix for every holder', () => {
    const same = Array.from({ length: 12 }, (_, j) => cat(j % 2 ? 'Same ' : 'Same', `s${j}`));
    const taken = Array.from({ length: 5 }, (_, j) => cat(`Same (category) #${j + 2}`, `t${j}`));
    const out = texts([...same, ...taken]);
    expect(out.slice(12)).toEqual(['Same (category) #2', 'Same (category) #3', 'Same (category) #4', 'Same (category) #5', 'Same (category) #6']);
    expect(out.slice(0, 12)).toEqual(['Same (category)', ...Array.from({ length: 11 }, (_, j) => `Same (category) #${j + 7}`)]);
  });

  it('holds the invariant over generated finite lists: normalized, non-empty, distinct names; values, kinds and order kept', () => {
    let seed = 20261101;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pick = <T,>(xs: readonly T[]) => xs[rnd(xs.length)];
    const ws = [' ', '  ', '\t', '\n', '\u00a0', ' \r\n '];
    const words = ['All', 'categories', 'in', 'X', '(show all)', '(category)', '(group)', '(2 categories)', '#2', '#3'];
    const captions = ['All categories', 'All in X (2 categories)', 'All categories (show all)', 'All categories (category)', 'X (category) #2'];
    for (let run = 0; run < 400; run++) {
      const entries: CategoryMenuEntry[] = [all];
      const size = 1 + rnd(16);
      for (let i = 0; i < size; i++) {
        const base = rnd(2) ? pick(captions) : Array.from({ length: 1 + rnd(4) }, () => pick(words)).join(' ');
        const label = (rnd(2) ? pick(ws) : '') + base.split(' ').join(pick(ws)) + (rnd(2) ? pick(ws) : '');
        entries.push({ value: `v${i}`, label, kind: rnd(6) ? 'category' : 'group' });
      }
      const out = disambiguateCategoryMenu(entries);
      const names = out.map((x) => x.text);
      expect(names.map(displayName)).toEqual(names);
      expect(names.every((t) => t !== '')).toBe(true);
      expect(new Set(names.map(displayName)).size).toBe(names.length);
      expect(out.map((x) => [x.value, x.kind, x.label])).toEqual(entries.map((x) => [x.value, x.kind, x.label]));
      const keyCount = new Map<string, number>();
      for (const e of entries) keyCount.set(displayName(e.label), (keyCount.get(displayName(e.label)) ?? 0) + 1);
      out.forEach((x, i) => { if (keyCount.get(displayName(entries[i].label)) === 1 && !names.some((t, j) => j !== i && t === displayName(entries[i].label))) expect(x.text).toBe(displayName(entries[i].label)); });
      expect(disambiguateCategoryMenu(entries)).toEqual(out);
    }
  });

  it('normalizeMenuName is the display rule, and the final validation rejects duplicates and unnormalized text', () => {
    expect(normalizeMenuName(' a \t\n b\u00a0')).toBe('a b');
    expect(() => assertUniqueMenuNames(['a', 'b'])).not.toThrow();
    expect(() => assertUniqueMenuNames(['a b', 'a b'])).toThrow(/not unique/);
    expect(() => assertUniqueMenuNames(['a  b'])).toThrow(/not normalized/);
    expect(() => assertUniqueMenuNames([' '])).toThrow(/not normalized/);
  });
});
