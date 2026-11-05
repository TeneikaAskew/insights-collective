// Static coverage for run 41340995609's exit 126: every script e2e.yml runs directly by path must be 100755 with a shebang.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { runBlocks, directInvocations, problems } from '../../../scripts/ci/check-invoked-modes.mjs';

const gitMode = (p: string) => { const o = execFileSync('git', ['ls-files', '-s', '--', p], { encoding: 'utf8' }).trim(); return o ? o.split(/\s+/)[0] : null; };
const first = (p: string) => readFileSync(p, 'utf8').split('\n')[0];

describe('directly invoked workflow scripts are executable', () => {
  for (const wf of ['.github/workflows/e2e.yml', '.github/workflows/db-migrate.yml']) {
    it(`${wf}: every directly invoked script is 100755 with a shebang`, () => {
      const paths = [...new Set(runBlocks(readFileSync(wf, 'utf8')).flatMap((b) => directInvocations(b.run)))];
      if (wf.endsWith('e2e.yml')) expect(paths).toContain('scripts/served-app/tests/hermetic-dist-selftest.sh');
      expect(problems(paths, gitMode, first)).toEqual([]);
    });
  }
  it('finds command positions, skips interpreter arguments and comments', () => {
    const run = [
      'scripts/a.sh dist | tee x', 'node scripts/b.mjs arg', 'out=$(scripts/c.sh) || exit 1', 'if ! scripts/d.sh; then echo no; fi',
      'X=1 scripts/e.sh', '# scripts/f.sh in a comment', 'bash scripts/g.sh', 'foo && ./scripts/h.sh', 'echo scripts/i.sh',
    ].join('\n');
    expect(directInvocations(run).sort()).toEqual(['scripts/a.sh', 'scripts/c.sh', 'scripts/d.sh', 'scripts/e.sh', 'scripts/h.sh']);
  });
  it('causal: the 1570a4e state (100644) is flagged; 100755 without a shebang is flagged; untracked is flagged', () => {
    expect(problems(['scripts/x.sh'], () => '100644', () => '#!/usr/bin/env bash')).toEqual(['scripts/x.sh: invoked directly but committed as 100644 (needs 100755)']);
    expect(problems(['scripts/x.sh'], () => '100755', () => 'echo hi')).toEqual(['scripts/x.sh: invoked directly but has no shebang']);
    expect(problems(['scripts/x.sh'], () => null, () => null)).toEqual(['scripts/x.sh: not tracked by git']);
  });
});
