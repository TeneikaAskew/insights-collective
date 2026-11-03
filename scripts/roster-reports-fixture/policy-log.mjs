// ABOUTME: The telemetry log writer the roster-reports request policy appends to (RR_POLICY_LOG, inside run.sh's private
// ABOUTME: 0700 dir). One JSON object per line with fixed fields only. Lives under scripts/ so the e2e tree has no fs writer.
import fs from 'node:fs';
import path from 'node:path';

/** Append one telemetry record. Refuses unless RR_POLICY_LOG is absolute and its parent is a real 0700 dir owned by this user. */
export function appendTelemetry(rec, env = process.env) {
  const p = env.RR_POLICY_LOG ?? '';
  const refuse = () => { throw new Error('roster-reports refused: RR_POLICY_LOG must be an absolute path in a private dir'); };
  if (!path.isAbsolute(p)) refuse();
  let st;
  try { st = fs.lstatSync(path.dirname(p)); } catch { refuse(); }
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || (typeof process.getuid === 'function' && st.uid !== process.getuid())) refuse();
  const line = JSON.stringify({ rpc: String(rec.rpc), actor: String(rec.actor), status: Number(rec.status) });
  fs.appendFileSync(p, `${line}\n`, { mode: 0o600 });
}
