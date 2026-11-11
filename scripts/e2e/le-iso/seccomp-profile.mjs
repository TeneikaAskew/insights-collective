// ABOUTME: REVIEW DIFF (unapplied). Pure, strict builder for the le-iso seccomp profile: pinned Moby v28.0.4 default.json
// ABOUTME: plus exactly five reviewed rules. No I/O; callers pass bytes. Any deviation throws a fixed code, never a value.
import crypto from 'node:crypto';

export const UPSTREAM_SHA256 = '9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76'; // moby v28.0.4 profiles/seccomp/default.json
export const OUTPUT_SHA256 = 'e15422bbebcf05cda6c2db3d4ea4fe1eb8846fa3f4db439409a84b5dd8c82fe1';
export const UPSTREAM_RULES = 31;

const CLONE_NEWUSER = 0x10000000, CLONE_NEWPID = 0x20000000, CLONE_NEWNET = 0x40000000, SIGCHLD = 17;
/**
 * The ONLY rules the delta may hold, each exactly once, in this order. Values come from Chromium 147.0.7727.15:
 * credentials.cc:279-280 and :301/:329, namespace_sandbox.cc:142,177-198 and :217-219, credentials.cc:97-113 (chroot).
 * base::ForkWithFlags reaches clone through glibc's clone() wrapper (launch_posix.cc:757-772), flags forwarded unchanged.
 */
export const DELTA_SPEC = Object.freeze([
  { name: 'clone', value: CLONE_NEWUSER | SIGCHLD, exclCap: 'CAP_SYS_ADMIN' },
  { name: 'clone', value: CLONE_NEWUSER | CLONE_NEWPID | CLONE_NEWNET | SIGCHLD, exclCap: 'CAP_SYS_ADMIN' },
  { name: 'clone', value: CLONE_NEWPID | SIGCHLD, exclCap: 'CAP_SYS_ADMIN' },
  { name: 'unshare', value: CLONE_NEWUSER, exclCap: 'CAP_SYS_ADMIN' },
  { name: 'chroot', value: null, exclCap: 'CAP_SYS_CHROOT' },
]);

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const keys = (o) => Object.keys(o).sort().join(',');

/** Validate one delta rule against its spec entry; throws PROFILE_E_DELTA_RULE on any difference. */
export function checkRule(r, spec) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) fail('PROFILE_E_DELTA_RULE');
  const want = spec.value === null ? 'action,comment,excludes,includes,names' : 'action,args,comment,excludes,includes,names';
  if (keys(r) !== want) fail('PROFILE_E_DELTA_RULE');
  if (!Array.isArray(r.names) || r.names.length !== 1 || r.names[0] !== spec.name) fail('PROFILE_E_DELTA_RULE');
  if (r.action !== 'SCMP_ACT_ALLOW') fail('PROFILE_E_DELTA_RULE');
  if (typeof r.comment !== 'string' || !r.comment.startsWith('le-iso: Chromium 147 ')) fail('PROFILE_E_DELTA_RULE');
  if (JSON.stringify(r.includes) !== '{"arches":["amd64"]}') fail('PROFILE_E_DELTA_RULE');
  if (JSON.stringify(r.excludes) !== JSON.stringify({ caps: [spec.exclCap] })) fail('PROFILE_E_DELTA_RULE');
  if (spec.value !== null) {
    if (!Array.isArray(r.args) || r.args.length !== 1) fail('PROFILE_E_DELTA_RULE');
    const a = r.args[0];
    if (!a || keys(a) !== 'index,op,value,valueTwo' || a.index !== 0 || a.op !== 'SCMP_CMP_EQ' || a.valueTwo !== 0 || a.value !== spec.value) fail('PROFILE_E_DELTA_RULE');
  }
}

/**
 * Build the profile text from the raw upstream bytes and raw delta bytes. Throws PROFILE_E_UPSTREAM (hash or shape),
 * PROFILE_E_DELTA (not exactly five rules), PROFILE_E_DELTA_RULE or PROFILE_E_OUTPUT (final bytes not the reviewed hash).
 */
export function buildProfile(upstreamRaw, deltaRaw) {
  if (sha(upstreamRaw) !== UPSTREAM_SHA256) fail('PROFILE_E_UPSTREAM');
  const base = JSON.parse(Buffer.from(upstreamRaw).toString('utf8'));
  if (keys(base) !== 'archMap,defaultAction,defaultErrnoRet,syscalls' || base.syscalls.length !== UPSTREAM_RULES) fail('PROFILE_E_UPSTREAM');
  let delta;
  try { delta = JSON.parse(Buffer.from(deltaRaw).toString('utf8')); } catch { fail('PROFILE_E_DELTA'); }
  if (!Array.isArray(delta) || delta.length !== DELTA_SPEC.length) fail('PROFILE_E_DELTA');
  delta.forEach((r, i) => checkRule(r, DELTA_SPEC[i]));
  const text = `${JSON.stringify({ ...base, syscalls: [...base.syscalls, ...delta] }, null, '\t')}\n`;
  if (sha(Buffer.from(text, 'utf8')) !== OUTPUT_SHA256) fail('PROFILE_E_OUTPUT');
  return text;
}
