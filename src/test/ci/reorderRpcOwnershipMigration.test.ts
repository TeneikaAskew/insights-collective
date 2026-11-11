// Static assertions for 20261107000100_reorder_rpcs_require_course_manager.sql.
// Source-only: reads files, never a database. Pins that both reorder functions check the caller and the list before
// they write, that anon loses EXECUTE, and that the client still calls them with the same arguments.
// Behaviour is asserted by scripts/local-db/tests/11_reorder_rpc_ownership.sql.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const NAME = '20261107000100_reorder_rpcs_require_course_manager.sql';
const raw = readFileSync(path.join(ROOT, 'supabase/migrations', NAME), 'utf8');
const sql = raw.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function body(fn: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  return flat(sql.slice(start, sql.indexOf('$function$;', start)));
}

describe('reorder RPC ownership migration (static)', () => {
  it('has a unique version among migrations', () => {
    const files = readdirSync(path.join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql'));
    expect(files.filter((f) => f.startsWith(NAME.slice(0, 14)))).toEqual([NAME]);
  });

  for (const [fn, scope] of [
    ['reorder_content_items', 'public.content_items ci WHERE ci.module_id = p_module_id'],
    ['reorder_modules', 'public.modules m WHERE m.course_id = p_course_id'],
  ] as const) {
    it(`${fn}: checks the caller, then the list, before the single UPDATE`, () => {
      const b = body(fn);
      expect(b).toContain('SECURITY DEFINER');
      expect(b).toContain("SET search_path = public");
      const auth = b.indexOf("v_role = 'service_role' OR public.can_manage_course_content(auth.uid(),");
      const list = b.indexOf(`FROM ${scope}`);
      const write = b.indexOf('UPDATE public.');
      expect(auth).toBeGreaterThan(0);
      expect(list).toBeGreaterThan(auth);
      expect(write).toBeGreaterThan(list);
      expect(b).toContain("ERRCODE = '42501'");
      expect(b).toContain("ERRCODE = '22023'");
      expect(b).toContain('count(DISTINCT x)');
      expect(b).toContain('array_position(');
      // one set-based write, no loop
      expect(b).not.toMatch(/\bFOR i IN\b/);
    });
  }

  it('EXECUTE: revoked from PUBLIC and anon, granted to authenticated and service_role, and verified', () => {
    for (const fn of ['reorder_content_items', 'reorder_modules']) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn}(uuid, uuid[]) FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}(uuid, uuid[]) TO authenticated, service_role;`);
      expect(sql).toContain(`has_function_privilege('anon', 'public.${fn}(uuid, uuid[])', 'EXECUTE')`);
    }
  });

  it('client: still calls both functions with the unchanged argument names', () => {
    const service = readFileSync(path.join(ROOT, 'src/services/canvasContentService.ts'), 'utf8');
    expect(flat(service)).toContain("supabase.rpc('reorder_content_items', { p_module_id: moduleId, p_item_ids: itemIds, })");
    expect(flat(service)).toContain("supabase.rpc('reorder_modules', { p_course_id: courseId, p_module_ids: moduleIds, })");
  });
});
