// ABOUTME: Fails if any tracked text file carries a `scheme://user:password@host` database URI literal with a
// ABOUTME: non-loopback host. The repository secret scan (TruffleHog, security.yml) reports that shape even for
// ABOUTME: placeholder passwords, and because it scans the commit RANGE a flagged line stays flagged for the life
// ABOUTME: of the branch. Test DSNs are assembled from parts instead (see assertLocalDsn.test.ts `uri`).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
// Built from parts so this file cannot trip the scan it enforces.
const SHAPE = new RegExp(['postgres', '(?:ql)?:', '//', '([^\\s:/@"\'`]+):([^\\s@"\'`]+)@([^\\s/:?#"\'`,]+)'].join(''), 'g');
const TEXT_LIMIT = 2 * 1024 * 1024;

const trackedFiles = () =>
  execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

describe('no credential-shaped database URI literals in tracked files', () => {
  it('finds none with a non-loopback host', () => {
    const hits: string[] = [];
    for (const rel of trackedFiles()) {
      const abs = resolve(ROOT, rel);
      // Check and read through the same descriptor, so the file checked is the file read.
      let fd: number; try { fd = openSync(abs, 'r'); } catch { continue; }
      let buf: Buffer;
      try {
        const st = fstatSync(fd);
        if (!st.isFile() || st.size > TEXT_LIMIT) continue;
        buf = readFileSync(fd);
      } finally { closeSync(fd); }
      if (buf.subarray(0, 8000).includes(0)) continue; // binary
      const text = buf.toString('utf8');
      let m: RegExpExecArray | null;
      SHAPE.lastIndex = 0;
      while ((m = SHAPE.exec(text)) !== null) {
        const host = m[3];
        if (LOOPBACK.has(host)) continue;
        const line = text.slice(0, m.index).split('\n').length;
        hits.push(`${rel}:${line} (user ${m[1].length} chars, password ${m[2].length} chars, host ${host})`);
      }
    }
    expect(hits, 'assemble test DSNs from parts; never commit user:password@host literals').toEqual([]);
  });
});
