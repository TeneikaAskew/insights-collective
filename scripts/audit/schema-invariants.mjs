#!/usr/bin/env node
// ABOUTME: Asserts database invariants that no test would otherwise notice.
// ABOUTME: Exits non-zero on violation so CI can gate on it.
//
// These are conditions that are true today, that nothing enforces, and whose
// violation would be invisible until a user hit it.
//
// Usage: SUPABASE_ACCESS_TOKEN=… node scripts/audit/schema-invariants.mjs

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.VITE_SUPABASE_PROJECT_ID ?? 'siuqvhscuiycvdrtiqsh';

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is required (management API token).');
  process.exit(2);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`management API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const INVARIANTS = [
  {
    name: 'every auth user has a profile',
    sql: `select count(*) as n from auth.users u
          where not exists (select 1 from public.profiles p where p.id = u.id)`,
    // 21 accounts created 2025-05-07 → 2025-07-03 had no profile row. They also
    // had no user_roles row, so get_user_roles returned nothing for them. The
    // on_auth_user_created trigger covers signups now, but nothing proves it is
    // still firing — and once profiles carries foreign keys, a user without one
    // cannot write a certificate, submission or discussion at all.
    why: 'handle_new_user may have stopped firing; these users cannot write to any table with a profiles FK',
  },
  {
    name: 'every auth user has a role',
    sql: `select count(*) as n from auth.users u
          where not exists (select 1 from public.user_roles r where r.user_id = u.id)`,
    why: 'the same trigger assigns the default student role; without it the user has no permissions anywhere',
  },
  {
    name: 'no profiles foreign key left unvalidated',
    sql: `select count(*) as n from pg_constraint
          where conname like '%_profiles_fkey' and not convalidated`,
    // A NOT VALID constraint applies to new rows but never checks existing ones.
    // Shipping one un-validated would silently accept the orphans it exists to
    // prevent.
    why: 'a NOT VALID constraint does not check existing rows',
  },
  {
    name: 'every RLS-enabled table has at least one policy',
    sql: `select count(*) as n from pg_class c
          join pg_namespace ns on ns.oid = c.relnamespace
          left join pg_policy p on p.polrelid = c.oid
          where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          group by c.oid having count(p.polname) = 0`,
    // RLS on with no policy denies everything — the table reads as permanently
    // empty rather than erroring, which is the silent-failure shape this whole
    // audit is about.
    why: 'RLS with no policy denies every row silently; the table just looks empty',
    emptyIsPass: true,
  },
];

let failures = 0;
for (const inv of INVARIANTS) {
  const rows = await query(inv.sql);
  const n = rows.length === 0 ? 0 : Number(rows[0].n ?? 0);
  if (n === 0) {
    console.log(`  ok    ${inv.name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${inv.name} — ${n} violation(s)`);
    console.error(`        ${inv.why}`);
  }
}

if (failures) {
  console.error(`\n${failures} schema invariant(s) violated.`);
  process.exit(1);
}
console.log('\nall schema invariants hold.');
