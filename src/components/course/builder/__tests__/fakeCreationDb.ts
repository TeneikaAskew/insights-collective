// ABOUTME: In-memory PostgREST-shaped client for course-creation tests: primary keys, the
// ABOUTME: assessment UNIQUE(content_item_id) constraints, parent FKs, and injectable faults.
import { vi } from 'vitest';

export type Fault = 'fail' | 'commit-then-lose-response';
export interface FakeDb {
  tables: Record<string, Map<string, any>>;
  /** Faults keyed by `${table}#${n}` (n = 1-based insert attempt on that table) or `${table}` (next insert). */
  faults: Map<string, Fault>;
  inserts: Record<string, number>;
  uploads: string[];
  client: any;
}

const FK: Record<string, [string, string][]> = {
  modules: [['course_id', 'courses']],
  content_items: [['module_id', 'modules'], ['course_id', 'courses']],
  assignments: [['content_item_id', 'content_items']],
  quizzes: [['content_item_id', 'content_items']],
};
const UNIQUE: Record<string, string[]> = { assignments: ['content_item_id'], quizzes: ['content_item_id'] };

export function createFakeDb(): FakeDb {
  const tables: Record<string, Map<string, any>> = {
    courses: new Map(), modules: new Map(), content_items: new Map(), assignments: new Map(), quizzes: new Map(), quiz_questions: new Map(),
  };
  const db: FakeDb = { tables, faults: new Map(), inserts: {}, uploads: [], client: null };
  let seq = 0;

  const builder = (table: string) => {
    const filters: [string, any][] = [];
    let insertRow: any = null;
    let orderBy: [string, boolean] | null = null;
    let lim: number | null = null;
    const b: any = {};
    b.insert = vi.fn((row: any) => ((insertRow = row), b));
    b.select = vi.fn(() => b);
    b.eq = vi.fn((c: string, v: any) => (filters.push([c, v]), b));
    b.order = vi.fn((c: string, o?: { ascending?: boolean }) => ((orderBy = [c, o?.ascending !== false]), b));
    b.limit = vi.fn((n: number) => ((lim = n), b));
    const store = () => tables[table] ?? (tables[table] = new Map());
    const doInsert = () => {
      const n = (db.inserts[table] = (db.inserts[table] ?? 0) + 1);
      const fault = db.faults.get(`${table}#${n}`) ?? db.faults.get(table);
      if (db.faults.get(table)) db.faults.delete(table);
      if (fault === 'fail') return { data: null, error: { message: `${table} insert failed`, code: 'PGRST000' } };
      const row = { ...insertRow, id: insertRow.id ?? `gen-${table}-${++seq}` };
      if (store().has(row.id)) return { data: null, error: { message: 'duplicate key', code: '23505' } };
      for (const col of UNIQUE[table] ?? []) {
        if ([...store().values()].some((r) => r[col] === row[col])) return { data: null, error: { message: `duplicate ${col}`, code: '23505' } };
      }
      for (const [col, parent] of FK[table] ?? []) {
        if (!tables[parent].has(row[col])) return { data: null, error: { message: `fk ${col}`, code: '23503' } };
      }
      store().set(row.id, row);
      if (fault === 'commit-then-lose-response') return { data: null, error: { message: 'Failed to fetch' } };
      return { data: { id: row.id }, error: null };
    };
    const doSelect = () => {
      let rows = [...store().values()].filter((r) => filters.every(([c, v]) => r[c] === v));
      if (orderBy) {
        const [c, asc] = orderBy;
        rows = rows.sort((a, z) => (a[c] - z[c]) * (asc ? 1 : -1));
      }
      if (lim != null) rows = rows.slice(0, lim);
      if (table === 'content_items') {
        rows = rows.map((r) => ({
          ...r,
          assignment: [...tables.assignments.values()].find((a) => a.content_item_id === r.id) ?? null,
          quiz: [...tables.quizzes.values()].find((q) => q.content_item_id === r.id) ?? null,
        }));
      }
      return rows;
    };
    const run = (mode: 'many' | 'single' | 'maybe') => {
      if (insertRow) return doInsert();
      const rows = doSelect();
      if (mode === 'many') return { data: rows, error: null };
      if (mode === 'maybe') return { data: rows[0] ?? null, error: null };
      return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    };
    b.single = vi.fn(() => Promise.resolve(run('single')));
    b.maybeSingle = vi.fn(() => Promise.resolve(run('maybe')));
    b.then = (ok: any, bad: any) => Promise.resolve().then(() => run('many')).then(ok, bad);
    return b;
  };

  db.client = {
    from: (t: string) => builder(t),
    storage: {
      from: () => ({
        upload: vi.fn(async (path: string) => (db.uploads.push(path), { data: { path }, error: null })),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
      }),
    },
  };
  return db;
}
