// ABOUTME: SYNTHETIC stand-in for the private Storage metadata input (made-up policy names, predicates and limits, same
// ABOUTME: JSON shape as the approved transfer). Used by the selftests only; it is not and does not describe the real input.
import { createHash } from 'node:crypto';
import * as S from '../storage-core.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');

export const SYN_POLICIES = [
  { name: 'syn_submission_insert_rule', table: 'objects', command: 'INSERT', roles: ['authenticated'], using: null,
    with_check: "((bucket_id = 'synthetic-bucket-a'::text) AND (split_part(name, '/'::text, 1) = 'synthetic-dir'::text) AND (synthetic_owner_col = (auth.uid())::text))" },
  { name: 'syn_submission_select_rule', table: 'objects', command: 'SELECT', roles: ['authenticated'], with_check: null,
    using: "((bucket_id = 'synthetic-bucket-a'::text) AND (synthetic_owner_col = (auth.uid())::text))" },
  { name: 'syn_submission_delete_rule', table: 'objects', command: 'DELETE', roles: ['authenticated'], with_check: null,
    using: "((bucket_id = 'synthetic-bucket-a'::text) AND (synthetic_owner_col = (auth.uid())::text))" },
  { name: 'syn_other_bucket_public_read', table: 'objects', command: 'SELECT', roles: ['public'], with_check: null,
    using: "(bucket_id = 'synthetic-other-bucket'::text)" },
];
export function synDoc(mut = (d) => d) {
  const rows = [];
  for (const x of SYN_POLICIES) {
    const m = { name: x.name, roles: x.roles, table: x.table, using: x.using, schema: 'storage', command: x.command, permissive: 'PERMISSIVE',
      roles_text: `{${x.roles.join(',')}}`, with_check: x.with_check, identity_md5: '' };
    m.identity_md5 = S.policyIdentity({ cmd: m.command, perm: m.permissive, roles: m.roles, using: m.using, check: m.with_check }, md5);
    rows.push({ kind: 'POLICY', metadata: m });
  }
  for (const tb of ['objects', 'buckets']) rows.push({ kind: 'RLS', metadata: { table: tb, schema: 'storage', force_rls: false, rls_enabled: true } });
  rows.push({ kind: 'BUCKET', metadata: { id: 'course-documents', public: false, file_size_limit: 1048577, allowed_mime_types: ['application/pdf', 'text/x-synthetic'] } });
  rows.push({ kind: 'BUCKET', metadata: { id: 'course-images', public: false, file_size_limit: null, allowed_mime_types: null } });
  rows.push({ kind: 'BUCKET', metadata: { id: 'course-videos', public: false, file_size_limit: 2097153, allowed_mime_types: ['video/x-synthetic'] } });
  for (const [tb, g, pv] of [['objects', 'authenticated', 'INSERT'], ['objects', 'authenticated', 'SELECT'], ['objects', 'authenticated', 'DELETE'], ['objects', 'anon', 'SELECT'], ['buckets', 'authenticated', 'SELECT']]) {
    rows.push({ kind: 'GRANT', metadata: { table: tb, schema: 'storage', grantee: g, privilege_type: pv } });
  }
  for (const [i, n] of S.HELPERS.entries()) {
    rows.push({ kind: 'FN', metadata: { name: n, schema: 'public', arguments: i % 2 ? '_user_id uuid' : '_course_id uuid', prosrc_md5: String(i).repeat(32),
      volatility: 's', result_type: 'boolean', definition_md5: 'abcdef0123456789'.slice(i, i + 1).repeat(32), security_definer: true, authenticated_execute: true } });
  }
  rows.push({ kind: 'OBSERVATION', metadata: { note: 'synthetic' } });
  rows.push({ kind: 'STORAGE_MIGRATIONS', metadata: { count: 3, max_id: 2 } });
  return mut({ project_id: 'synthetic', observed_utc: '2000-01-01T00:00:00Z', scope: 'synthetic', rows });
}
export function synInput(mut) {
  const raw = JSON.stringify(synDoc(mut));
  const buf = Buffer.from(raw, 'utf8');
  return { raw, sourceSha: sha(buf), sourceBytes: buf.length };
}
