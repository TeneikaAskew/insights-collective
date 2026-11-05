#!/usr/bin/env node
// ABOUTME: Converts the user-approved storage metadata (a private runner input, never a repository file; byte length and
// ABOUTME: sha256 pinned below) into LIVE pins in the storage-core grammar, in memory. Refuses unless every check passes.
//
// Inputs are metadata only (policy definitions, RLS flags, the course bucket configs, table grants, helper hashes, storage
// migration version). No object rows, user data or helper bodies. Output is deterministic: same input, same bytes.
// No CLI: storage-job.mjs s0 is the only caller on the runner, and it writes its output into the private dir only.
// The structural census uses public constants only (tables, course buckets, helpers); the policy and grant inventory
// is fixed by the pinned sha256, so no count from the private input is written in this file.
import { createHash } from 'node:crypto';
import { StorageError, parsePins, policyIdentity, COURSE_BUCKETS, HELPERS, TABLES } from './storage-core.mjs';

export const SOURCE_SHA256 = '33da32135d9594dd58cff0a6accb8ead99b6e874056030abe7eafe3c4140060d';
export const SOURCE_BYTES = 25187;
/** Exact counts for the structural kinds (public constants); POLICY and GRANT must be present (min 1), sha fixes the rest. */
export const CENSUS = Object.freeze({ FN: HELPERS.length, BUCKET: COURSE_BUCKETS.length, RLS: TABLES.length, OBSERVATION: 1, STORAGE_MIGRATIONS: 1 });
const OPEN_KINDS = Object.freeze(['POLICY', 'GRANT']);
const refuse = (c) => { throw new StorageError(c); };
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const exactKeys = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join(',') === [...keys].sort().join(',');

export function convert(buf, { expectSha = SOURCE_SHA256, expectBytes = SOURCE_BYTES } = {}) {
  const census = CENSUS;
  if (!Buffer.isBuffer(buf) || buf.length !== expectBytes) refuse('ST_E_SOURCE_BYTES');
  if (createHash('sha256').update(buf).digest('hex') !== expectSha) refuse('ST_E_SOURCE_SHA');
  let d; try { d = JSON.parse(buf.toString('utf8')); } catch { refuse('ST_E_SOURCE_JSON'); }
  if (!exactKeys(d, ['project_id', 'observed_utc', 'scope', 'rows']) || !Array.isArray(d.rows)) refuse('ST_E_SOURCE_JSON');
  const n = {};
  for (const r of d.rows) { if (!exactKeys(r, ['kind', 'metadata']) || !(r.kind in census || OPEN_KINDS.includes(r.kind))) refuse('ST_E_SOURCE_KIND'); n[r.kind] = (n[r.kind] || 0) + 1; }
  for (const [k, v] of Object.entries(census)) if (n[k] !== v) refuse('ST_E_SOURCE_CENSUS');
  for (const k of OPEN_KINDS) if (!(n[k] >= 1)) refuse('ST_E_SOURCE_CENSUS');
  const L = [];
  for (const { kind, metadata: m } of d.rows) {
    if (kind === 'POLICY') {
      if (!exactKeys(m, ['name', 'roles', 'table', 'using', 'schema', 'command', 'permissive', 'roles_text', 'with_check', 'identity_md5'])) refuse('ST_E_SOURCE_POLICY');
      if (m.schema !== 'storage' || !Array.isArray(m.roles) || m.roles_text !== `{${m.roles.join(',')}}`) refuse('ST_E_SOURCE_POLICY');
      const x = { cmd: m.command, perm: m.permissive, roles: m.roles, using: m.using, check: m.with_check };
      if (policyIdentity(x, md5) !== m.identity_md5) refuse('ST_E_SOURCE_IDENTITY');
      L.push(['POLICY', `storage.${m.table}`, b64(m.name), m.command, m.permissive, [...m.roles].sort().join(','),
        m.using === null ? '-' : b64(m.using), m.with_check === null ? '-' : b64(m.with_check)].join('\t'));
    } else if (kind === 'RLS') {
      if (!exactKeys(m, ['table', 'schema', 'force_rls', 'rls_enabled']) || m.schema !== 'storage') refuse('ST_E_SOURCE_RLS');
      L.push(['RLS', `storage.${m.table}`, m.rls_enabled ? 't' : 'f', m.force_rls ? 't' : 'f'].join('\t'));
    } else if (kind === 'BUCKET') {
      if (!exactKeys(m, ['id', 'public', 'file_size_limit', 'allowed_mime_types']) || typeof m.public !== 'boolean') refuse('ST_E_SOURCE_BUCKET');
      if (m.file_size_limit !== null && !Number.isSafeInteger(m.file_size_limit)) refuse('ST_E_SOURCE_BUCKET');
      if (m.allowed_mime_types !== null && (!Array.isArray(m.allowed_mime_types) || m.allowed_mime_types.some((t) => typeof t !== 'string' || t.includes(',')))) refuse('ST_E_SOURCE_BUCKET');
      L.push(['BUCKET', m.id, m.public ? 't' : 'f', m.file_size_limit === null ? 'NULL' : String(m.file_size_limit),
        m.allowed_mime_types === null ? 'NULL' : b64(m.allowed_mime_types.join(','))].join('\t'));
    } else if (kind === 'GRANT') {
      if (!exactKeys(m, ['table', 'schema', 'grantee', 'privilege_type']) || m.schema !== 'storage') refuse('ST_E_SOURCE_GRANT');
      L.push(['GRANT', `storage.${m.table}`, m.grantee, m.privilege_type].join('\t'));
    } else if (kind === 'FN') {
      if (!exactKeys(m, ['name', 'schema', 'arguments', 'prosrc_md5', 'volatility', 'result_type', 'definition_md5', 'security_definer', 'authenticated_execute'])) refuse('ST_E_SOURCE_FN');
      if (m.schema !== 'public' || !HELPERS.includes(m.name)) refuse('ST_E_SOURCE_FN');
      L.push(['HELPER', m.name, b64(m.arguments), m.definition_md5, m.prosrc_md5, m.security_definer ? 't' : 'f', m.authenticated_execute ? 't' : 'f'].join('\t'));
    } else if (kind === 'STORAGE_MIGRATIONS') {
      if (!exactKeys(m, ['count', 'max_id'])) refuse('ST_E_SOURCE_MIGRATIONS');
      L.push(['MIGRATIONS', String(m.count), String(m.max_id)].join('\t'));
    }
  }
  const text = `#storage-pins\tv1\tLIVE\n${L.sort().join('\n')}\n`;
  const p = parsePins(text); // the grammar's own refusals (expression gate, shapes, buckets, completeness) apply here
  if (p.policies.size !== n.POLICY) refuse('ST_E_SOURCE_CENSUS'); // no duplicate (table, name) collapsed by the parser
  for (const b of COURSE_BUCKETS) if (p.buckets.get(b).public) refuse('ST_E_BUCKET_PUBLIC');
  return { text, pins: p };
}

