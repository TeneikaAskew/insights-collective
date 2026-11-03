#!/usr/bin/env node
// ABOUTME: No-browser, no-database self-test for the E1 body oracle: fake row/editor values, the fixture pin and a static check
// ABOUTME: that the spec's E1 block uses the exact oracle at all three sources. Labelled FAKE: it proves the oracle, not the app.
// Usage: body-oracle-selftest.mjs [--oracle new|old] [--spec <path>]
//   --oracle old  judges the cases with the previous `contains "E1 body"` rule (the le-r1 E1 assertion), to show what it let pass.
//   --spec <path> runs the static E1-block check against another spec copy (e.g. the le-r1 spec, which must FAIL it).
// Output: one PASS/FAIL line per case, then a fixed summary line; exit 0 only when every case meets its expectation.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED_A_HTML, SEEDED_A_TEXT, E1_APPEND, E1_EXPECTED_TEXT, e1Body } from './body-oracle.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('--oracle', 'new');
if (!['new', 'old'].includes(MODE)) { console.log('usage: --oracle new|old'); process.exit(2); }
const SPEC = path.resolve(arg('--spec', path.join(HERE, 'lesson-editor.spec.ts')));

const oldRule = (_kind, v) => ({ ok: typeof v === 'string' && v.includes('E1 body') });
const judge = MODE === 'new' ? e1Body : oldRule;

let pass = 0, fail = 0;
const say = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };

// B: fake bodies. `want` is what a CORRECT oracle must say. Under --oracle old the same expectations are applied, so every case
// the old rule gets wrong shows up as FAIL (that is the point of the OLD receipt).
const CASES = [
  ['B1 html exact seeded+appended', 'html', '<p>Body A E1 body</p>', true],
  ['B2 html NBSP between (TipTap may emit &nbsp;)', 'html', '<p>Body A&nbsp;E1 body</p>', true],
  ['B3 MUTANT html seeded text dropped', 'html', '<p> E1 body</p>', false],
  ['B4 MUTANT html seeded text dropped, no space', 'html', '<p>E1 body</p>', false],
  ['B5 MUTANT html append lost', 'html', '<p>Body A</p>', false],
  ['B6 MUTANT html append duplicated', 'html', '<p>Body A E1 body E1 body</p>', false],
  ['B7 MUTANT html reordered', 'html', '<p> E1 body Body A</p>', false],
  ['B8 MUTANT html seeded text partly lost', 'html', '<p>Body E1 body</p>', false],
  ['B9 MUTANT html extra text', 'html', '<p>Body A E1 body</p><p>stray</p>', false],
  ['B10 text (reloaded innerText) exact', 'text', 'Body A E1 body\n', true],
  // Tokenizer controls (CodeQL 629): nested and split openers never reassemble into a tag; leftovers stay text and fail.
  ['B13 MUTANT nested opener <<p>p>', 'html', '<<p>p>Body A E1 body</p>', false],
  ['B14 MUTANT split script opener <scr<script>ipt>', 'html', '<p>Body A E1 body</p><scr<script>ipt>', false],
  ['B15 MUTANT unterminated tag at the end', 'html', '<p>Body A E1 body</p><script', false],
  ['B16 MUTANT escaped markup is visible text', 'html', '<p>Body A E1 body &lt;script&gt;</p>', false],
  ['B17 quoted > inside an attribute value stays inside the tag', 'html', '<p data-x="a>b">Body A E1 body</p>', true],
  ['B18 upper-case tags with attributes and a <br/>', 'html', '<P class="x">Body A<BR/>E1 body</P>', true],
  ['B19 MUTANT double-decoding would hide &amp;lt;', 'html', '<p>Body A E1 body&amp;lt;</p>', false],
  ['B11 MUTANT text seeded text dropped', 'text', ' E1 body', false],
  ['B12 MUTANT text empty editor', 'text', '', false],
];
for (const [name, kind, value, want] of CASES) say(`${name} -> ${want ? 'accept' : 'refuse'}`, judge(kind, value).ok === want);

// P: the expected body is independent of the run and pinned to the fixture.
const fixture = readFileSync(path.join(ROOT, 'scripts/local-stack/lesson-editor/fixture.sql'), 'utf8');
const aRow = fixture.match(/\('ed170000-0000-4000-8000-0000000000a1',[\s\S]*?\)/);
say('P1 fixture.sql seeds lesson A with exactly SEEDED_A_HTML', !!aRow && aRow[0].includes(`'${SEEDED_A_HTML}'`));
say('P2 expected text = seeded text + appended text', E1_EXPECTED_TEXT === `${SEEDED_A_TEXT}${E1_APPEND}`.trim() && E1_EXPECTED_TEXT === 'Body A E1 body');

// S: the spec's E1 block uses the exact oracle at the returned row, the DB row and the reloaded editor, and no contains-check.
let block = '';
try {
  const src = readFileSync(SPEC, 'utf8');
  const a = src.indexOf("test('E1 save:"); const b = src.indexOf("test('E2 ", a);
  block = a >= 0 && b > a ? src.slice(a, b) : '';
} catch { block = ''; }
say('S1 E1 block found', block !== '');
say('S2 E1 pins the baseline body to the fixture (DB and editor)', /expect\(before\.content[^\n]*\.toBe\(SEEDED_A_HTML\)/.test(block) && /toHaveText\(SEEDED_A_TEXT\)/.test(block));
say("S3 E1 judges the returned row: e1Body('html', last.row!.content)", block.includes("e1Body('html', last.row!.content)"));
say("S4 E1 judges the DB row: e1Body('html', stored.content)", block.includes("e1Body('html', stored.content)"));
say("S5 E1 judges the reloaded editor: e1Body('text', await editor(page).innerText())", block.includes("e1Body('text', await editor(page).innerText())"));
say('S6 E1 keeps the returned-row == stored-row, title, type, version and 200/1/eq checks',
  ['.toEqual({ id: stored.id, title: stored.title, content: stored.content, updated_at: stored.updated_at })',
    "expect(stored.title).toBe('E1 saved title')", "expect(stored.type).toBe('page')", 'trigger advanced updated_at',
    "toEqual([200, 1, 'eq'])", "toHaveValue('E1 saved title'"].every((t) => block.includes(t)));
say("S7 E1 has no contains-only body check (toContain('E1 body') / toContainText('E1 body'))", block !== '' && !/toContain(Text)?\(\s*'E1 body'/.test(block));

console.log(`le body-oracle-selftest (FAKE values, no browser, no database; oracle=${MODE}; spec=${path.relative(ROOT, SPEC) || SPEC}): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
