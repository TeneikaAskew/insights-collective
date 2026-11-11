// ABOUTME: Pins security.yml's fs-write ALLOWED list: every reviewed entry, the one exact roster telemetry sink entry
// ABOUTME: (approved 2026-11-03), neighbour paths that must stay outside it, and the gate result with and without it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SECURITY = readFileSync('.github/workflows/security.yml', 'utf8');
// The gate's own grep pattern, read from security.yml (single source of truth; this test performs no writes).
const gatePattern = (): string => {
  const m = SECURITY.match(/xargs -r grep -nE '([^']+)'/);
  if (!m) throw new Error('gate grep pattern not found');
  return m[1];
};
const WRITE_CALL = new RegExp(gatePattern());
const ROSTER_ENTRY = 'e2e/roster-reports/actors\\.mjs$';
// The sealed video lane record writer (#173 P4(a) review candidate; its own controls are in checkSealedVideoLane.test.ts).
const SEALED_VIDEO_ENTRY = 'e2e/stubbed/sandboxed-test\\.ts$';

const allowedSource = (): string => {
  const m = SECURITY.match(/^\s*ALLOWED='([^']+)'$/m);
  if (!m) throw new Error('ALLOWED line not found');
  return m[1];
};

// The top-level alternation inside ^( ... ), split on '|' at depth 0 only.
const topLevelEntries = (src: string): string[] => {
  expect(src.startsWith('^(') && src.endsWith(')')).toBe(true);
  const body = src.slice(2, -1);
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '|' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
};

const PREVIOUS = [
  'scripts/',
  'e2e/fixtures/console-errors\\.fixture\\.ts$',
  'e2e/quiz-lifecycle/session\\.fixture\\.ts$',
  'src/test/ci/(checkLocalTarget|caseDiagnostics|checkLearnerAuthGate|checkT09StageContract|gbJobHolds|checkGradebookJourneyJob)\\.test\\.ts$',
];

const tracked = (): string[] =>
  execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'], { encoding: 'utf8' })
    .split('\n').filter(Boolean);

const hitsFor = (allowed: RegExp): string[] => {
  const hits: string[] = [];
  for (const f of tracked()) {
    if (allowed.test(f)) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (WRITE_CALL.test(line)) hits.push(`${f}:${i + 1}`);
    });
  }
  return hits;
};

describe('security.yml fs-write ALLOWED list', () => {
  it('keeps every previously reviewed entry and adds exactly one anchored roster entry (and the sealed video entry after it)', () => {
    const entries = topLevelEntries(allowedSource());
    expect(entries).toEqual([PREVIOUS[0], PREVIOUS[1], PREVIOUS[2], ROSTER_ENTRY, SEALED_VIDEO_ENTRY, PREVIOUS[3]]);
    expect(entries.filter((e) => e === ROSTER_ENTRY)).toHaveLength(1);
  });

  it('admits the one exact writer file and refuses its neighbours', () => {
    const re = new RegExp(allowedSource());
    expect(re.test('e2e/roster-reports/actors.mjs')).toBe(true);
    for (const p of [
      'e2e/roster-reports/actors.mjs.bak',
      'e2e/roster-reports/actors.mjsx',
      'e2e/roster-reports/actors.js',
      'e2e/roster-reports/actors.ts',
      'e2e/roster-reports/Actors.mjs',
      'e2e/roster-reports/actorsXmjs',
      'e2e/roster-reports/request-policy.mjs',
      'e2e/roster-reports/guarded-test.ts',
      'e2e/roster-reports/session-setup.ts',
      'e2e/roster-reports/sub/actors.mjs',
      'e2e/roster-reports-x/actors.mjs',
      'e2e/actors.mjs',
      'x/e2e/roster-reports/actors.mjs',
      'src/e2e/roster-reports/actors.mjs',
      'e2e/builder-authoring/observe.ts',
    ]) {
      expect(re.test(p), p).toBe(false);
    }
  });

  it('documents the entry in the reviewed-locations comment and the CodeQL config note', () => {
    expect(SECURITY).toMatch(/^\s*# {3}e2e\/roster-reports\/actors\.mjs$/m);
    expect(SECURITY).toContain('approved 2026-11-03: user 02:53:20Z');
    expect(readFileSync('.github/codeql/codeql-config.yml', 'utf8')).toContain('e2e/roster-reports/actors.mjs');
  });

  it('source contract: actors.mjs has exactly one write call, the same-fd append in the sink', () => {
    const lines = readFileSync('e2e/roster-reports/actors.mjs', 'utf8').split('\n');
    const writes = lines.map((l, i) => [i + 1, l] as const).filter(([, l]) => WRITE_CALL.test(l) && !/^\s*\/\//.test(l));
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatch(new RegExp(`fs\\.(${gatePattern()})\\(fd, line\\)`));
    expect(writes[0][1].match(WRITE_CALL)?.[0].startsWith('append')).toBe(true);
    const opens = lines.filter((l) => /fs\.openSync\(/.test(l));
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatch(/O_WRONLY \| fs\.constants\.O_APPEND \| fs\.constants\.O_NOFOLLOW \| fs\.constants\.O_NONBLOCK, 0o600\)/);
    expect(opens[0]).not.toMatch(/O_CREAT|O_TRUNC|O_EXCL/);
    expect(lines.filter((l) => /\b(f?chmod|f?chown|umask)(Sync)?\(/.test(l))).toEqual([]);
  });

  it('gate is clean with the entry and flags exactly the roster sink without it', () => {
    const src = allowedSource();
    expect(hitsFor(new RegExp(src))).toEqual([]);
    const without = new RegExp(src.replace(`${ROSTER_ENTRY}|`, ''));
    const hits = hitsFor(without);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^e2e\/roster-reports\/actors\.mjs:\d+$/);
  });
});
