#!/usr/bin/env node
// ABOUTME: Selftest for diag-n1.mjs on SYNTHETIC contexts only (no database, no service): the fixed category rules, the
// ABOUTME: generated SQL, byte-identity with the N1 probe apart from the one owner_delete handler, and the privacy shape.
import { DIAG_RULES, DIAG_CATEGORIES, classify, caseSql, diagAttempt, diagScript, diagVerdict } from '../diag-n1.mjs';
import { probeScripts, cases } from '../probes.mjs';
import { probePrefix } from '../storage-core.mjs';

let ok = 0, bad = 0;
const t = (name, fn) => { try { fn(); ok++; console.log(`ok ${name}`); } catch (e) { bad++; console.log(`FAILED ${name}: ${e && (e.code || e.message)}`); } };
const eq = (a, b) => { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

// Synthetic exception contexts in the PostgreSQL format (innermost frame first).
const STMT = 'SQL statement "delete from storage.objects where bucket_id = \'course-documents\' and name = \'x\'"';
const INLINE = 'PL/pgSQL function inline_code_block line 1 at SQL statement';
const ctx = (...f) => [...f, STMT, INLINE].join('\n');
const S = (o) => classify({ sqlstate: '42501', ...o });
t('RULES trigger-returning storage function frame with a matching catalog binding: TRIGGER_FUNC_MATCH (a label, not a firing proof)', () => eq(S({ context: ctx('PL/pgSQL function storage.synthetic_guard() line 5 at RAISE'), bound: true }), 'TRIGGER_FUNC_MATCH'));
t('RULES same frame with NO matching binding: STORAGE_FUNC (presence alone is not binding)', () => eq(S({ context: ctx('PL/pgSQL function storage.synthetic_guard() line 5 at RAISE'), bound: false }), 'STORAGE_FUNC'));
t('RULES a storage function with arguments (not a trigger signature): STORAGE_FUNC even if bound is claimed', () => eq(S({ context: ctx('PL/pgSQL function storage.synthetic_fn(text) line 2 at RAISE'), bound: true }), 'STORAGE_FUNC'));
t('RULES a policy helper (public schema) raising: PUBLIC_FUNC', () => eq(S({ context: ctx('PL/pgSQL function public.synthetic_helper(uuid,uuid) line 3 at RAISE') }), 'PUBLIC_FUNC'));
t('RULES a function in another schema: OTHER_FUNC', () => eq(S({ context: ctx('PL/pgSQL function auth.synthetic(uuid) line 1 at RAISE') }), 'OTHER_FUNC'));
t('RULES statement frame + 42501 + permission wording: PRIVILEGE_WORDING (wording only)', () => eq(S({ message: 'permission denied for table objects', context: [STMT, INLINE].join('\n') }), 'PRIVILEGE_WORDING'));
t('RULES permission wording raised INSIDE a function is labelled by the frame, never by the message', () => eq(S({ message: 'permission denied for table objects', context: ctx('PL/pgSQL function storage.synthetic_guard() line 5 at RAISE'), bound: true }), 'TRIGGER_FUNC_MATCH'));
t('RULES statement frame + 42501 + WITH CHECK wording: RLS_WORDING (wording only)', () => eq(S({ message: 'new row violates row-level security policy for table "objects"', context: [STMT, INLINE].join('\n') }), 'RLS_WORDING'));
t('RULES SPOOF unqualified function frame with RLS wording: UNQUALIFIED_FUNC, never RLS_WORDING', () => {
  eq(S({ message: 'new row violates row-level security policy for table "objects"', context: ctx('PL/pgSQL function synthetic_helper() line 3 at RAISE') }), 'UNQUALIFIED_FUNC');
  eq(S({ message: 'permission denied for table objects', context: ctx('PL/pgSQL function synthetic_helper() line 3 at RAISE') }), 'UNQUALIFIED_FUNC');
  eq(S({ message: 'new row violates row-level security policy', context: 'SQL function "synthetic" statement 1' }), 'UNQUALIFIED_FUNC');
});
t('RULES SPOOF wording with the right frame but another SQLSTATE, or with our own DO frame: OTHER', () => {
  eq(classify({ sqlstate: 'P0001', message: 'new row violates row-level security policy', context: [STMT, INLINE].join('\n') }), 'OTHER');
  eq(classify({ sqlstate: 'P0001', message: 'permission denied for table objects', context: [STMT, INLINE].join('\n') }), 'OTHER');
  eq(S({ message: 'new row violates row-level security policy', context: INLINE }), 'OTHER');
});
t('RULES our own DO block, an empty context, or anything else: OTHER (fallback)', () => { eq(S({ context: INLINE }), 'OTHER'); eq(classify({}), 'OTHER'); });
t('RULES the category set is finite and fixed', () => eq(DIAG_CATEGORIES.join(','), 'DELETE_ALLOWED,DELETE_NO_ROWS,TRIGGER_FUNC_MATCH,STORAGE_FUNC,PUBLIC_FUNC,OTHER_FUNC,UNQUALIFIED_FUNC,PRIVILEGE_WORDING,RLS_WORDING,OTHER'));

t('SQL the CASE is generated from the same rule text, in the same order, with an OTHER fallback', () => {
  const c = caseSql(); let at = -1;
  for (const r of DIAG_RULES) { const i = c.indexOf(`then '${r.cat}'`); if (i <= at) throw new Error(`order ${r.cat}`); at = i; if (r.frame && !c.includes(`f ~ '${r.frame}'`)) throw new Error(`frame ${r.cat}`); if (r.message && !c.includes(`m ~ '${r.message}'`)) throw new Error(`message ${r.cat}`); if (r.sqlstate && !c.includes(`sqlstate = '${r.sqlstate}'`)) throw new Error(`sqlstate ${r.cat}`); }
  eq(c.endsWith(" else 'OTHER' end"), true); eq((c.match(/ and b then /g) || []).length, 1);
});

const RUN = ['41000000001', '1'];
const prefix = probePrefix(...RUN);
const n1 = probeScripts(...RUN, { policies: new Map() }).find((p) => p.id === 'N1');
const d = diagScript(...RUN);
const name = cases(prefix, '').find((c) => c.id === 'N1').name;
const stmt = `delete from storage.objects where bucket_id = 'course-documents' and name = '${name}'`;
t('SHAPE the diagnostic is the N1 script with ONLY its owner_delete attempt replaced (plus the trailing trigger count)', () => {
  const oldAttempt = `do $p$ begin begin ${stmt}; perform set_config('st.r', 'ALLOWED', true); exception when others then perform set_config('st.r', 'SQLSTATE_' || sqlstate, true); end; end $p$;\nselect 'owner_delete=' || current_setting('st.r');\n`;
  eq(n1.script.split(oldAttempt).length, 2);
  const COUNT = "reset role;\nselect 'delete_triggers=COUNT_' || count(*) from pg_trigger t where t.tgrelid = 'storage.objects'::regclass and not t.tgisinternal and t.tgenabled <> 'D' and (t.tgtype & 8) <> 0;\n";
  const rebuilt = n1.script.split(oldAttempt).join(diagAttempt(stmt)).replace(/\n\nrollback;\n$/, () => `\n${COUNT}\nrollback;\n`);
  eq(d.script, rebuilt);
  eq(d.prefix, prefix); eq(d.expect.join(','), n1.expect.join(','));
});
t('SHAPE same statement, same expectation, same object name and run-owned prefix; one transaction, rolled back', () => {
  eq(d.script.split(stmt).length - 1, 1); eq(n1.script.split(stmt).length - 1, 1);
  eq((d.script.match(/^begin;$/gm) || []).length, 1); eq((d.script.match(/^rollback;$/gm) || []).length, 1); eq(/\bcommit\b/i.test(d.script), false);
});
t('SHAPE the replacement is literal (no $-pattern expansion): the generated CASE appears byte-for-byte', () => eq(d.script.includes(caseSql()), true));
t('SAFETY no elevated delete or bypass: no allow_delete_query, no session_replication_role, no disable trigger, no policy DDL, no SECURITY DEFINER', () => {
  for (const re of [/allow_delete_query/i, /session_replication_role/i, /disable\s+trigger/i, /alter\s+table/i, /(create|drop|alter)\s+policy/i, /security\s+definer/i, /set\s+(local\s+)?role\s+(postgres|supabase|service_role)/i])
    if (re.test(d.script)) throw new Error(String(re));
  eq((d.script.match(/delete from storage\.objects/g) || []).length, 1);
});
t('PRIVACY raw diagnostics never leave the session: m and f are only assigned, matched and cleared; no RAISE/NOTICE; selects are fixed literals', () => {
  const a = diagAttempt(stmt);
  const code = a.replace(/'(?:[^']|'')*'/g, "''"); // statements only, literals blanked (the rule text names RAISE frames)
  eq(/\braise\b|\bnotice\b|\binfo\b|\blog\b/i.test(code), false);
  const uses = [...a.matchAll(/\b([mf])\b(?!\s*=\s*(message_text|pg_exception_context))/g)].length; if (uses === 0) throw new Error('vars');
  for (const l of d.script.split('\n').filter((x) => /^select /.test(x))) {
    if (!/^select '[a-z_]+=(COUNT_)?' \|\| (current_setting\('st\.[rc]'\)|count\(\*\)|'COUNT_' \|\| count\(\*\))/.test(l) && !/^select set_config\(/.test(l)) throw new Error(`select ${l.slice(0, 40)}`);
  }
  eq(/m := null; f := null;/.test(a), true);
  eq(/get stacked diagnostics m = message_text, f = pg_exception_context;/.test(a), true);
  eq(/pg_exception_detail|pg_exception_hint/.test(a), false);
});
t('PRIVACY the trigger binding check reads catalog facts only (no definition text, no name output)', () => {
  const a = diagAttempt(stmt);
  eq(/pg_get_functiondef|prosrc|tgname/.test(d.script), false);
  eq(/'delete_triggers=COUNT_' \|\| count\(\*\)/.test(d.script), true);
  eq(/p\.prorettype = 'trigger'::regtype/.test(a) && /\(t\.tgtype & 8\) <> 0/.test(a) && /t\.tgenabled <> 'D'/.test(a) && /not t\.tgisinternal/.test(a), true);
});

const good = ['insert=ALLOWED', 'learner_select=COUNT_1', 'instructor_select=COUNT_1', 'owner_delete=SQLSTATE_42501', 'owner_delete_origin=TRIGGER_FUNC_MATCH', 'after_delete=COUNT_1', 'delete_triggers=COUNT_1'];
t('VERDICT good tokens -> one fixed line', () => { const v = diagVerdict(good); eq(v.ok, true); eq(v.line.startsWith('S4 N1 DIAG origin=TRIGGER_FUNC_MATCH owner_delete=SQLSTATE_42501 after_delete=COUNT_1 delete_triggers=COUNT_1 '), true); });
t('VERDICT producer failure (null) is its own fixed line, not ok', () => { const v = diagVerdict(null); eq(v.ok, false); eq(v.line, 'S4 N1 DIAG PRODUCER_FAILED'); });
t('VERDICT per-key domains: every field rejects a hostile substitution and the marker is never echoed', () => {
  const MARK = 'SYNTHETIC_PRIVATE_MARKER';
  for (let i = 0; i < good.length; i++) {
    const [k, v] = good[i].split('=');
    for (const h of [MARK, `${v} ${MARK}`, `${v}\n${MARK}`, ` ${v}`, v.toLowerCase(), `${v}=${MARK}`, 'COUNT_01', 'COUNT_1234567', 'SQLSTATE_4250', 'SQLSTATE_42501X', 'SQLSTATE_42501 ', 'ALLOWED_', 'TRIGGER_BOUND', '']) {
      if (h === v) continue;
      const l = good.slice(); l[i] = `${k}=${h}`;
      const r = diagVerdict(l); if (r.ok || r.line !== 'S4 N1 DIAG UNPARSEABLE' || r.line.includes(MARK)) throw new Error(`${k}=${JSON.stringify(h)}`);
    }
  }
  // cross-domain: a COUNT where an outcome belongs and vice versa
  eq(diagVerdict(['insert=COUNT_1', ...good.slice(1)]).ok, false); eq(diagVerdict([good[0], 'learner_select=ALLOWED', ...good.slice(2)]).ok, false);
});
t('VERDICT order, count, keys and agreement: reordering, missing, extra, renamed key, ALLOWED vs error label: UNPARSEABLE', () => {
  const U = 'S4 N1 DIAG UNPARSEABLE';
  for (const l of [[], [...good, 'x=COUNT_1'], good.slice(0, 6), [good[1], good[0], ...good.slice(2)], ['inserts=ALLOWED', ...good.slice(1)],
    [...good.slice(0, 3), 'owner_delete=ALLOWED', 'owner_delete_origin=OTHER', ...good.slice(5)],
    [...good.slice(0, 4), 'owner_delete_origin=DELETE_ALLOWED', ...good.slice(5)], 'not-an-array'])
    eq(diagVerdict(l).line, U);
});
t('VERDICT preconditions: failed insert, either select not COUNT_1: PRECONDITION_FAILED, no attribution (no false DELETE_ALLOWED)', () => {
  for (const l of [['insert=SQLSTATE_42501', 'learner_select=COUNT_0', 'instructor_select=COUNT_0', 'owner_delete=ALLOWED', 'owner_delete_origin=DELETE_NO_ROWS', 'after_delete=COUNT_0', 'delete_triggers=COUNT_0'],
    ['insert=ALLOWED', 'learner_select=COUNT_0', 'instructor_select=COUNT_1', 'owner_delete=ALLOWED', 'owner_delete_origin=DELETE_ALLOWED', 'after_delete=COUNT_0', 'delete_triggers=COUNT_0'],
    ['insert=ALLOWED', 'learner_select=COUNT_1', 'instructor_select=COUNT_2', ...good.slice(3)]]) {
    const v = diagVerdict(l); eq(v.ok, false); eq(v.line.startsWith('S4 N1 DIAG PRECONDITION_FAILED '), true); eq(v.line.includes('origin='), false);
  }
});
t('SQL a delete with no exception is labelled by row_count (DELETE_ALLOWED vs DELETE_NO_ROWS), never by a guess', () => {
  const a = diagAttempt(stmt);
  eq(a.includes("get diagnostics k = row_count;"), true); eq(a.includes("case when k > 0 then 'DELETE_ALLOWED' else 'DELETE_NO_ROWS' end"), true);
});

console.log(`diag-selftest: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
