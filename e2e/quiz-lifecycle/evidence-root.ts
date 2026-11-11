// ABOUTME: Evidence root for the learner quiz lifecycle fixtures: the job's QLC_EVIDENCE_DIR when set, otherwise ONE
// ABOUTME: private, unpredictably named directory per process (mkdtemp, 0700), created lazily on first use.
//
// Why: the previous fallback was the fixed shared path <os tmpdir>/qlc-evidence (CodeQL js/insecure-temporary-file at
// session.fixture.ts:121). Another local user could pre-create or link that path and receive or replace evidence. The
// job always sets QLC_EVIDENCE_DIR (e2e.yml, runner temp), so its behavior is unchanged; only the unset (local) case moves
// to a fresh private directory. Pure: the filesystem calls are injected, so the controls run on fakes.
import path from 'node:path';

export type EvidenceRootDeps = {
  env: Record<string, string | undefined>;
  tmpdir: () => string;
  /** Must create a NEW directory from the prefix with owner-only permissions and return its path (fs.mkdtempSync). */
  mkdtemp: (prefix: string) => string;
};

export const EVIDENCE_PREFIX = 'qlc-evidence-';

/** Returns a memoized getter. Nothing is created until the getter is first called, and nothing when the env var is set. */
export function evidenceRootResolver(deps: EvidenceRootDeps): () => string {
  let root: string | null = null;
  return () => {
    if (root !== null) return root;
    const configured = deps.env.QLC_EVIDENCE_DIR;
    root = configured ? configured : deps.mkdtemp(path.join(deps.tmpdir(), EVIDENCE_PREFIX));
    return root;
  };
}
