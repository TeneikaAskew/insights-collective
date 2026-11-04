// ABOUTME: S4 SQL policy probes for the journey stack, bound to the pinned LIVE pins (private runner input; sha256 below).
// ABOUTME: Each case is one session and one transaction that always ends in ROLLBACK; results are fixed tokens only.
//
// Actors are the frozen pre-seed's synthetic users and its reference course (scripts/local-db/local-preseed.sql):
//   C = 660e8400-e29b-41d4-a716-446655440001 (instructor I), I = e2e00000-...-0002 (instructor), M = ...-0003 (student),
//   A = ...-0001 (admin). M is NOT enrolled in C by the pre-seed; a case that needs enrollment inserts it inside its own
//   rolled-back transaction. Object names are run-owned: <prefix><case>.pdf with prefix probe-<run id>-<attempt>-.
// Expected outcomes are the reviewed intended access rules for course-documents (repository migrations and the gradebook
// journey contract), checked privately against the pinned predicates. They are bound to the pins sha256: a different
// pins file refuses before any probe runs. No policy name or predicate text appears in this public file. These probes
// prove policy behaviour on this stack. They do NOT prove what caused the HTTP 400 in run 41493619385, nor what HTTP
// status storage-api returns for a denial.
// Scope of the after-probe checks: the residue query counts run-owned names in storage.objects ONLY. Cases that enroll M
// also insert a public.enrollments row inside the same rolled-back transaction; that row (and any other public or Storage
// side effect, such as trigger writes) is covered by the rollback alone and is NOT separately counted. The S3 catalog
// re-check covers catalog and config, not rows. Actual rollback execution is UNRUN until a hosted receipt exists.
import { StorageError, wrapProbe, probePrefix } from './storage-core.mjs';

export const PROBE_PINS_SHA256 = '02ce9f854d091ee634cbbffbddabf8d94bec3c66f0d0ac91c8da2e42c7ae1124';
export const C = '660e8400-e29b-41d4-a716-446655440001';
export const U = Object.freeze({ A: 'e2e00000-0000-4000-8000-000000000001', I: 'e2e00000-0000-4000-8000-000000000002', M: 'e2e00000-0000-4000-8000-000000000003' });
const BUCKET = 'course-documents';
const refuse = (c) => { throw new StorageError(c); };

/** Become an API role with request claims (transaction-local). anon carries no sub. */
function as(role, uid) {
  const claims = uid ? `{"sub":"${uid}","role":"${role}"}` : `{"role":"${role}"}`;
  return `reset role;\nselect set_config('request.jwt.claims', '${claims}', true), set_config('request.jwt.claim.sub', '${uid ?? ''}', true), set_config('request.jwt.claim.role', '${role}', true) \\g /dev/null\nset local role ${role};\n`;
}
/** Attempt one statement; record ALLOWED or the SQLSTATE in a transaction-local setting, then print a fixed token. */
function attempt(tag, stmt) {
  return `do $p$ begin begin ${stmt}; perform set_config('st.r', 'ALLOWED', true); exception when others then perform set_config('st.r', 'SQLSTATE_' || sqlstate, true); end; end $p$;\nselect '${tag}=' || current_setting('st.r');\n`;
}
const count = (tag, name) => `select '${tag}=COUNT_' || count(*) from storage.objects where bucket_id = '${BUCKET}' and name = '${name}';\n`;
const enroll = `reset role;\ninsert into public.enrollments (user_id, course_id) values ('${U.M}', '${C}');\n`;
const asOwner = (name, uid) => `reset role;\ninsert into storage.objects (bucket_id, name) values ('${BUCKET}', '${name}');\n`;

/**
 * The case table. Each entry: id, label, EXPECT tokens in order, and a builder(name) for the body. Kinds:
 *   NEW positive, NEW negative, OLD EMULATED (every mirrored policy dropped inside the rolled-back transaction).
 */
export function cases(prefix, dropAll) {
  const n = (id) => `submissions/${C}/${U.M}/${prefix}${id}.pdf`;
  return [
    { id: 'N1', kind: 'NEW', label: 'learner enrolled: own submission INSERT, read-back, instructor SELECT, owner DELETE',
      // Intent: an enrolled learner may write, read and delete their own submission object; the course instructor may read it.
      expect: ['insert=ALLOWED', 'learner_select=COUNT_1', 'instructor_select=COUNT_1', 'owner_delete=ALLOWED', 'after_delete=COUNT_0'],
      body: (nm) => enroll + as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`)
        + count('learner_select', nm) + as('authenticated', U.I) + count('instructor_select', nm)
        + as('authenticated', U.M) + attempt('owner_delete', `delete from storage.objects where bucket_id = '${BUCKET}' and name = '${nm}'`)
        + as('authenticated', U.M) + count('after_delete', nm), name: n('N1') },
    { id: 'X1', kind: 'NEW', label: "learner enrolled writes another user's submission prefix",
      expect: ['insert=SQLSTATE_42501'],
      body: (nm) => enroll + as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`),
      name: `submissions/${C}/${U.A}/${prefix}X1.pdf` },
    { id: 'X2', kind: 'NEW', label: 'learner NOT enrolled writes own submission prefix',
      expect: ['insert=SQLSTATE_42501'],
      body: (nm) => as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`), name: n('X2') },
    { id: 'X3', kind: 'NEW', label: 'learner enrolled writes a course materials path (materials writes need course management)',
      expect: ['insert=SQLSTATE_42501'],
      body: (nm) => enroll + as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`),
      name: `${C}/${prefix}X3.pdf` },
    { id: 'X4', kind: 'NEW', label: 'anon INSERT own-shaped submission path; anon SELECT of an existing submission',
      // Intent: anonymous callers can neither write nor read course-documents objects.
      expect: ['insert=SQLSTATE_42501', 'anon_select=COUNT_0'],
      body: (nm) => as('anon', null) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`)
        + asOwner(nm) + as('anon', null) + count('anon_select', nm), name: n('X4') },
    { id: 'X5', kind: 'NEW', label: "enrolled non-instructor SELECT of another user's submission",
      expect: ['other_select=COUNT_0'],
      body: (nm) => enroll + asOwner(nm) + as('authenticated', U.M) + count('other_select', nm), name: `submissions/${C}/${U.A}/${prefix}X5.pdf` },
    { id: 'X6', kind: 'NEW', label: 'malformed submission path: denied by RLS, never 22P02',
      expect: ['insert=SQLSTATE_42501'],
      body: (nm) => enroll + as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`),
      name: `submissions/not-a-uuid/${U.M}/${prefix}X6.pdf` },
    { id: 'O1', kind: 'OLD_EMULATED', label: 'EMULATED: every mirrored policy dropped in-transaction, then the N1 INSERT',
      expect: ['insert=SQLSTATE_42501'],
      body: (nm) => `reset role;\n${dropAll}` + enroll + as('authenticated', U.M) + attempt('insert', `insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${nm}')`), name: n('O1') },
  ];
}

/** Every probe script, bound to the run-owned prefix. dropAll is the exact DROP list for the mirrored names. */
export function probeScripts(runId, attempt, pins) {
  const prefix = probePrefix(runId, attempt);
  const dropAll = [...pins.policies.values()].map((x) => `drop policy "${x.name.replace(/"/g, '""')}" on ${x.table};\n`).sort().join('');
  return cases(prefix, dropAll).map((c) => {
    if (!c.name.includes(prefix) || /'/.test(c.name)) refuse('ST_E_PROBE_ID');
    return { id: c.id, kind: c.kind, label: c.label, expect: c.expect, script: wrapProbe(c.body(c.name)) };
  });
}

/** Compare a probe's stdout tokens with its EXPECT list exactly (same tokens, same order, nothing extra). */
export function probeVerdict(c, lines) {
  const got = Array.isArray(lines) ? lines.filter((l) => /^[a-z_]+=(ALLOWED|COUNT_\d{1,6}|SQLSTATE_[0-9A-Z]{5})$/.test(l)) : [];
  const ok = Array.isArray(lines) && got.length === lines.length && got.join(' ') === c.expect.join(' ');
  return { ok, line: `S4 ${c.id} ${c.kind} ${ok ? 'PASS' : 'FAIL'} expect=${c.expect.join(',')} got=${got.length === (lines?.length ?? -1) ? got.join(',') : 'UNPARSEABLE'}` };
}
