// ABOUTME: One bounded, private diagnostic for S4 N1 (UNRUN): the SAME N1 probe body, expectation and rollback, with only the
// ABOUTME: owner_delete attempt's exception handler extended to label WHERE the error came from with a fixed category.
//
// Privacy: the raw exception (message and context) is read with GET STACKED DIAGNOSTICS inside the DO block and labelled
// THERE. Only a fixed category token leaves the database session. No raw text is selected, raised, noticed or stored.
// Detail and hint are never read. The SQL CASE is generated from DIAG_RULES, and the selftest runs the same rule text
// in JS on synthetic contexts.
// What a category means (labels, not proofs):
//   TRIGGER_FUNC_MATCH  The innermost raising frame is a storage-schema function returning `trigger`, and the catalog holds
//                       a matching non-internal DELETE trigger on storage.objects whose tgenabled is not 'D' (this includes
//                       replica-only bindings). It is NOT proof of which binding fired, nor of that function's semantics.
//   STORAGE_FUNC / PUBLIC_FUNC / OTHER_FUNC  The innermost frame is a schema-qualified function of that schema.
//   UNQUALIFIED_FUNC    Any other function frame. The message is never consulted for it.
//   PRIVILEGE_WORDING / RLS_WORDING  The innermost frame is the statement itself, SQLSTATE is 42501, and the message
//                       has that wording. A message pattern is wording only, never a proven origin.
//   DELETE_ALLOWED / DELETE_NO_ROWS  There was no exception, and the delete removed at least one row, or none.
//   OTHER               The fallback.
// Attribution is reported only when the N1 preconditions held in the same transaction (insert ALLOWED, both selects
// COUNT_1). Nothing here deletes with elevated rights, bypasses a guard, disables a trigger or changes a policy.
import { StorageError, wrapProbe, probePrefix } from './storage-core.mjs';
import { cases } from './probes.mjs';

const refuse = (c) => { throw new StorageError(c); };
const BUCKET = 'course-documents';

/** Fixed rules, first match wins. Regexes are a POSIX/JS common subset (anchored, no lookaround, no flags). */
export const DIAG_RULES = Object.freeze([
  { cat: 'TRIGGER_FUNC_MATCH', frame: '^PL/pgSQL function storage\\.[a-z_]+\\(\\) line [0-9]+ at RAISE$', bound: true },
  { cat: 'STORAGE_FUNC', frame: '^(PL/pgSQL|SQL) function storage\\.' },
  { cat: 'PUBLIC_FUNC', frame: '^(PL/pgSQL|SQL) function public\\.' },
  { cat: 'OTHER_FUNC', frame: '^(PL/pgSQL|SQL) function [a-z_]+\\.' },
  // An unqualified function frame (name with an argument list, or a SQL-language function). Our own DO block's frame
  // ("PL/pgSQL function inline_code_block line …", no argument list) is not one, and falls to OTHER.
  { cat: 'UNQUALIFIED_FUNC', frame: '^(PL/pgSQL function [a-z_]+\\(|SQL function ")' },
  { cat: 'PRIVILEGE_WORDING', frame: '^SQL statement ', sqlstate: '42501', message: '^permission denied for (table|relation|schema) ' },
  { cat: 'RLS_WORDING', frame: '^SQL statement ', sqlstate: '42501', message: '^new row violates row-level security policy' },
]);
export const DIAG_CATEGORIES = Object.freeze(['DELETE_ALLOWED', 'DELETE_NO_ROWS', ...DIAG_RULES.map((r) => r.cat), 'OTHER']);

/** The rules in JS, for the selftest (same regex text as the SQL). */
export function classify({ message = '', context = '', sqlstate = '', bound = false }) {
  const frame = String(context).split('\n')[0];
  for (const r of DIAG_RULES) {
    if (r.frame && !new RegExp(r.frame).test(frame)) continue;
    if (r.sqlstate && sqlstate !== r.sqlstate) continue;
    if (r.message && !new RegExp(r.message).test(String(message))) continue;
    if (r.bound && !bound) continue;
    return r.cat;
  }
  return 'OTHER';
}

const ql = (s) => `'${s.replace(/'/g, "''")}'`;
/** The SQL CASE, generated from DIAG_RULES. It uses only the local variables f, m and b and the handler's sqlstate. */
export function caseSql() {
  const arms = DIAG_RULES.map((r) => {
    const c = [r.frame && `f ~ ${ql(r.frame)}`, r.sqlstate && `sqlstate = ${ql(r.sqlstate)}`, r.message && `m ~ ${ql(r.message)}`, r.bound && 'b']
      .filter(Boolean).join(' and ');
    return `when ${c} then ${ql(r.cat)}`;
  });
  return `case ${arms.join(' ')} else 'OTHER' end`;
}

/** The extended owner_delete attempt: same statement; the handler labels and records only fixed tokens. */
export function diagAttempt(stmt) {
  if (/\$d\$|\$p\$/.test(stmt)) refuse('ST_E_PROBE');
  const bound = 'exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace '
    + "where t.tgrelid = 'storage.objects'::regclass and not t.tgisinternal and t.tgenabled <> 'D' and (t.tgtype & 8) <> 0 "
    + "and n.nspname = 'storage' and p.prorettype = 'trigger'::regtype "
    + "and p.proname = (regexp_match(f, '^PL/pgSQL function storage\\.([a-z_]+)\\(\\)'))[1])";
  return `do $p$ declare m text; f text; b boolean; k bigint; begin begin ${stmt}; get diagnostics k = row_count; `
    + "perform set_config('st.r', 'ALLOWED', true); "
    + "perform set_config('st.c', case when k > 0 then 'DELETE_ALLOWED' else 'DELETE_NO_ROWS' end, true); "
    + "exception when others then get stacked diagnostics m = message_text, f = pg_exception_context; "
    + "f := split_part(coalesce(f, ''), E'\\n', 1); m := coalesce(m, ''); "
    + `b := coalesce(${bound}, false); `
    + "perform set_config('st.r', 'SQLSTATE_' || sqlstate, true); "
    + `perform set_config('st.c', ${caseSql()}, true); m := null; f := null; end; end $p$;\n`
    + "select 'owner_delete=' || current_setting('st.r');\nselect 'owner_delete_origin=' || current_setting('st.c');\n";
}

const COUNT_TRIG = "reset role;\nselect 'delete_triggers=COUNT_' || count(*) from pg_trigger t where t.tgrelid = 'storage.objects'::regclass "
  + "and not t.tgisinternal and t.tgenabled <> 'D' and (t.tgtype & 8) <> 0;\n";

/** The diagnostic script: the N1 body with exactly its owner_delete attempt replaced, then the trigger count. */
export function diagScript(runId, attempt) {
  const prefix = probePrefix(runId, attempt);
  const n1 = cases(prefix, '').find((c) => c.id === 'N1');
  const name = n1.name;
  if (!name.includes(prefix) || /'/.test(name)) refuse('ST_E_PROBE_ID');
  const body = n1.body(name);
  const stmt = `delete from storage.objects where bucket_id = '${BUCKET}' and name = '${name}'`;
  const old = `do $p$ begin begin ${stmt}; perform set_config('st.r', 'ALLOWED', true); exception when others then perform set_config('st.r', 'SQLSTATE_' || sqlstate, true); end; end $p$;\nselect 'owner_delete=' || current_setting('st.r');\n`;
  if (body.split(old).length !== 2) refuse('ST_E_DIAG_SHAPE'); // exactly one owner_delete attempt, byte-identical
  // split/join, never String.replace: the rule regexes contain "$'", which replace() would expand.
  return { prefix, expect: n1.expect, script: wrapProbe(body.split(old).join(diagAttempt(stmt)) + COUNT_TRIG) };
}

/** Exact keys, in order, each with its own value domain. Nothing else is accepted. */
const OUTCOME = /^(ALLOWED|SQLSTATE_[0-9A-Z]{5})$/;
const COUNT = /^COUNT_(0|[1-9][0-9]{0,5})$/;
export const DIAG_FIELDS = Object.freeze([
  ['insert', OUTCOME], ['learner_select', COUNT], ['instructor_select', COUNT], ['owner_delete', OUTCOME],
  ['owner_delete_origin', null], ['after_delete', COUNT], ['delete_triggers', COUNT],
]);
const valid = (re, v) => (re ? re.test(v) : DIAG_CATEGORIES.includes(v));

/**
 * Judge the diagnostic's output. ok is true only when every field is in its domain, in the exact order, the N1
 * preconditions held (insert ALLOWED, learner_select and instructor_select COUNT_1), and owner_delete agrees with the
 * origin. Otherwise the line is a fixed refusal that names no value from the producer, except validated precondition
 * values. The s4 verdict and oracle are not touched.
 */
export function diagVerdict(lines) {
  if (lines === null) return { ok: false, line: 'S4 N1 DIAG PRODUCER_FAILED' };
  const bad = { ok: false, line: 'S4 N1 DIAG UNPARSEABLE' };
  if (!Array.isArray(lines) || lines.length !== DIAG_FIELDS.length) return bad;
  const v = {};
  for (let i = 0; i < DIAG_FIELDS.length; i++) {
    const [key, re] = DIAG_FIELDS[i];
    const l = lines[i];
    if (typeof l !== 'string' || !l.startsWith(`${key}=`)) return bad;
    const val = l.slice(key.length + 1);
    if (!valid(re, val)) return bad;
    v[key] = val;
  }
  if (v.insert !== 'ALLOWED' || v.learner_select !== 'COUNT_1' || v.instructor_select !== 'COUNT_1')
    return { ok: false, line: `S4 N1 DIAG PRECONDITION_FAILED insert=${v.insert} learner_select=${v.learner_select} instructor_select=${v.instructor_select} (no owner_delete attribution)` };
  const noError = v.owner_delete === 'ALLOWED';
  if (noError !== ['DELETE_ALLOWED', 'DELETE_NO_ROWS'].includes(v.owner_delete_origin)) return bad;
  return { ok: true, line: `S4 N1 DIAG origin=${v.owner_delete_origin} owner_delete=${v.owner_delete} after_delete=${v.after_delete} delete_triggers=${v.delete_triggers} (label of the innermost raising frame only; wording labels are not proven origins; raw context never left the session)` };
}
