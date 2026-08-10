// ABOUTME: Guards every date-fns format string in src/ against unescaped literal text.
// ABOUTME: An unquoted word in a format string is parsed as tokens, not printed as text.
//
// THE BUG THIS EXISTS TO PREVENT
//
// `format(d, 'MMM d, yyyy at h:mm a')` does not print "at". In date-fns every
// unquoted letter is a token: `a` is AM/PM and `t` is the seconds-since-epoch
// timestamp. So that string rendered
//
//     Aug 3, 2026 AM1785716390 12:19 AM
//
// on the quiz results page, and in six other places — assignment due dates, the
// grading interface, the submission page, the blog editor's "Last saved". Seven
// occurrences across five files, every one showing a Unix timestamp in the
// middle of a human date.
//
// It is invisible to typechecking, to lint and to every existing test, because
// the format string is just a string. This test reads the source instead.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every string literal handed to a date-fns `format(...)` call, with the file
 * and line it came from. Deliberately a source scan and not a runtime spy: the
 * bad strings are spread across pages that no unit test renders, which is
 * exactly how seven of them survived.
 */
function formatStringsInSource(): Array<{ file: string; line: number; pattern: string }> {
  const found: Array<{ file: string; line: number; pattern: string }> = [];
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('date-fns')) continue;
    text.split('\n').forEach((lineText, i) => {
      // format(<something>, '<pattern>') / "<pattern>" — the second argument.
      for (const m of lineText.matchAll(/\bformat\s*\([^,]+,\s*(['"])([^'"]+)\1/g)) {
        found.push({ file: file.replace(process.cwd() + '/', ''), line: i + 1, pattern: m[2] });
      }
    });
  }
  return found;
}

/**
 * Strip the parts date-fns treats as literal — anything inside single quotes,
 * plus punctuation and whitespace — and return the runs of letters that remain.
 * Those runs are what date-fns will interpret as tokens.
 */
function unquotedLetterRuns(pattern: string): string[] {
  const withoutQuoted = pattern.replace(/'[^']*'/g, ' ');
  return withoutQuoted.match(/[A-Za-z]+/g) ?? [];
}

// The date-fns token letters. A token is one of these REPEATED — MMM, yyyy,
// dd, EEEE, LLL — so a run of identical token letters is legitimate and a run
// of mixed letters is a word.
//
// This started as a hand-listed set of known-good runs, which promptly failed
// on "LLL" (standalone month) and "y" — both real tokens I had not thought to
// enumerate. Enumerating outputs instead of encoding the rule is how the dead-
// file detector once reported button.tsx as unreferenced; the rule is short
// enough to write down properly.
const TOKEN_LETTERS = new Set('GyYRuQqMLwIdDEiecabBhHKkmsSXxOzt TPp'.replace(/\s/g, '').split(''));

// Two-letter tokens that are not repeats: `do` is the ordinal day of month.
const MIXED_TOKENS = new Set(['do']);

function isTokenRun(run: string): boolean {
  if (MIXED_TOKENS.has(run)) return true;
  const first = run[0];
  return TOKEN_LETTERS.has(first) && [...run].every(c => c === first);
}

describe('date-fns format strings', () => {
  const patterns = formatStringsInSource();

  it('finds the format calls it is meant to be checking', () => {
    // A scan that silently matches nothing would pass forever. This is the
    // instrument checking itself — the lesson from the dead-file detector that
    // reported button.tsx as unreferenced.
    expect(patterns.length).toBeGreaterThan(20);
  });

  it('contains no unescaped literal words', () => {
    const offenders = patterns
      .map(p => ({ ...p, bad: unquotedLetterRuns(p.pattern).filter(run => !isTokenRun(run)) }))
      .filter(p => p.bad.length > 0);

    expect(
      offenders.map(o => `${o.file}:${o.line} — "${o.pattern}" would interpret ${o.bad.map(b => `"${b}"`).join(', ')} as tokens; wrap literal text in single quotes`),
    ).toEqual([]);
  });

  it("renders 'at' as the word, not as AM/PM plus a Unix timestamp", () => {
    // The specific regression, pinned by behavior rather than by source shape.
    const when = new Date('2026-08-03T12:19:00Z');
    const wrong = format(when, 'MMM d, yyyy at h:mm a');
    const right = format(when, "MMM d, yyyy 'at' h:mm a");

    expect(wrong).toMatch(/\d{9,}/);          // the bare `t` emits a timestamp
    expect(right).toContain(' at ');
    expect(right).not.toMatch(/\d{9,}/);
  });
});
