// ABOUTME: The three shared local actors (scripts/local-db/local-preseed.sql) and the telemetry log the request policy
// ABOUTME: appends to (RR_POLICY_LOG, absolute, inside run.sh's private 0700 dir). One JSON object per line, fixed fields.
import fs from 'node:fs';
import path from 'node:path';

export const ACTOR_IDS = Object.freeze({
  'e2e00000-0000-4000-8000-000000000001': 'admin',
  'e2e00000-0000-4000-8000-000000000002': 'instructor',
  'e2e00000-0000-4000-8000-000000000003': 'member',
});
export const actorOf = (id) => ACTOR_IDS[id] ?? 'other';

/** Append one telemetry record. Refuses unless RR_POLICY_LOG is an absolute path whose parent is an existing directory. */
export function appendTelemetry(rec, env = process.env) {
  const p = env.RR_POLICY_LOG ?? '';
  if (!path.isAbsolute(p) || !fs.statSync(path.dirname(p)).isDirectory()) throw new Error('roster-reports refused: RR_POLICY_LOG must be an absolute path in a private dir');
  const line = JSON.stringify({ rpc: String(rec.rpc), actor: String(rec.actor), status: Number(rec.status) });
  fs.appendFileSync(p, `${line}\n`, { mode: 0o600 });
}
