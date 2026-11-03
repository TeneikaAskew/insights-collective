// ABOUTME: The three shared local actors (scripts/local-db/local-preseed.sql), keyed by user id, for telemetry attribution.
// ABOUTME: The log writer itself is scripts/roster-reports-fixture/policy-log.mjs (no fs writer in the e2e tree).

export const ACTOR_IDS = Object.freeze({
  'e2e00000-0000-4000-8000-000000000001': 'admin',
  'e2e00000-0000-4000-8000-000000000002': 'instructor',
  'e2e00000-0000-4000-8000-000000000003': 'member',
});
export const actorOf = (id) => ACTOR_IDS[id] ?? 'other';
