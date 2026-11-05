// Synthetic builder persistence fixture; no copy writer, storage or network.
import { vi } from 'vitest';
export function createBuilderDb() {
  const tables: Record<string, Map<string, any>> = Object.fromEntries(
    ['courses', 'modules', 'content_items', 'assignments', 'quizzes'].map((name) => [name, new Map()]),
  );
  let seq = 0;
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let insert: any; let update: any; let order: string; let ascending = true; let limit: number;
    const b: any = {};
    b.select = vi.fn(() => b);
    b.eq = vi.fn((key, value) => { filters.push([key, value]); return b; });
    b.is = b.eq;
    b.order = vi.fn((key, options?: { ascending?: boolean }) => { order = key; ascending = options?.ascending !== false; return b; });
    b.limit = vi.fn((value) => { limit = value; return b; });
    b.insert = vi.fn((value) => { insert = value; return b; });
    b.update = vi.fn((value) => { update = value; return b; });
    const run = (single: boolean) => {
      const store = tables[table] ?? new Map();
      if (insert) {
        const row = { ...insert, id: insert.id ?? `synthetic-${++seq}` };
        store.set(row.id, row);
        return { data: row, error: null };
      }
      let rows = [...store.values()].filter((r) => filters.every(([k, v]) => r[k] === v));
      if (update) rows.forEach((row) => Object.assign(row, update));
      if (order) rows.sort((a, b) => (a[order] - b[order]) * (ascending ? 1 : -1));
      if (limit !== undefined) rows = rows.slice(0, limit);
      rows = rows.map((row) => ({ ...row, ...(table === 'content_items' ? {
        quiz: [...tables.quizzes.values()].find((q) => q.content_item_id === row.id) ?? null,
        assignment: [...tables.assignments.values()].find((a) => a.content_item_id === row.id) ?? null,
      } : {}) }));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    b.single = vi.fn(async () => run(true)); b.maybeSingle = b.single;
    b.then = (ok: any, bad: any) => Promise.resolve().then(() => run(false)).then(ok, bad);
    return b;
  };
  return { tables, client: { from } };
}
