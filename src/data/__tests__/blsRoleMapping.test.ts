import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dataCareerRoles } from '@/data/dataCareerRoles';

/**
 * Salary bands join to roles by slug. If a role is added to the static file
 * without a matching row in the BLS migration, that role silently renders with
 * no pay data; if a slug is renamed, the join breaks for a role that used to
 * work. Neither shows up as a test failure anywhere else, so pin them here.
 */
describe('BLS role mapping', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../supabase/migrations/20260729000000_bls_wage_reference.sql',
    ),
    'utf-8',
  );

  // Leading letter required: the occupations seed also opens rows with a quoted
  // value ('15-2051'), and a looser pattern picks those up as if they were slugs.
  const seededSlugs = Array.from(migration.matchAll(/^\s*\('([a-z][a-z0-9-]*)', '/gm)).map(
    (m) => m[1],
  );

  const seededSocCodes = new Set(
    Array.from(migration.matchAll(/'(\d{2}-\d{4})'/g)).map((m) => m[1]),
  );

  it('seeds a row for every career role', () => {
    const missing = dataCareerRoles
      .map((r) => r.id)
      .filter((id) => !seededSlugs.includes(id));

    expect(missing, `roles with no BLS mapping row: ${missing.join(', ')}`).toEqual([]);
  });

  it('seeds no role that does not exist in the role data', () => {
    const roleIds = new Set(dataCareerRoles.map((r) => r.id));
    const orphans = seededSlugs.filter((s) => !roleIds.has(s));

    expect(orphans, `mapping rows with no matching role: ${orphans.join(', ')}`).toEqual([]);
  });

  it('maps every role to a SOC code that the migration also seeds', () => {
    // Each career_roles row ends with a SOC code and an optional note. Pull the
    // SOC code out of every mapping line and check it against the occupations.
    const mappingLines = Array.from(
      migration.matchAll(/^\s*\('[a-z][a-z0-9-]*', '[^']*', '[^']*', '(\d{2}-\d{4})'/gm),
    ).map((m) => m[1]);

    expect(mappingLines.length).toBe(dataCareerRoles.length);

    const unknown = mappingLines.filter((soc) => !seededSocCodes.has(soc));
    expect(unknown, `roles pointing at unseeded SOC codes: ${unknown.join(', ')}`).toEqual([]);
  });
});
