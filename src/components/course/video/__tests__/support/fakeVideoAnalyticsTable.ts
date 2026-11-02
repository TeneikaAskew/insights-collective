// ABOUTME: In-memory PostgREST-shaped fake of video_analytics for R3 design model tests (no network, no DB).
// ABOUTME: UNIQUE(user_id, content_item_id), all-filters-must-match updates, and pre/post-commit fault hooks.

export type Row = Record<string, any>;
export type Op = { kind: 'select' | 'insert' | 'update'; values?: Row };

export interface FakeTableState {
  rows: Row[];
  /** Awaited before an operation runs (interleave another writer here). */
  before: null | ((op: Op) => Promise<void> | void);
  /** Return an error WITHOUT applying the operation (request never committed). */
  failBeforeCommit: null | ((op: Op) => boolean);
  /** Apply the operation, then return an error (response lost after commit). */
  failAfterCommit: null | ((op: Op) => boolean);
}

export const newFakeTableState = (): FakeTableState => ({
  rows: [],
  before: null,
  failBeforeCommit: null,
  failAfterCommit: null,
});

type Filter = { col: string; value: unknown; isNull: boolean };

export function createFakeSupabase(db: FakeTableState) {
  const matches = (row: Row, filters: Filter[]) =>
    filters.every((f) => (f.isNull ? row[f.col] == null : row[f.col] === f.value));
  const pick = (row: Row, cols: string) =>
    cols === '*' ? { ...row } : Object.fromEntries(cols.split(',').map((c) => c.trim()).map((c) => [c, row[c]]));

  function builder(kind: Op['kind'], values?: Row) {
    const filters: Filter[] = [];
    let cols = '*';
    let returning = kind === 'select';
    const run = async (mode: 'many' | 'single' | 'maybe') => {
      const op: Op = { kind, values };
      if (db.before) await db.before(op);
      if (db.failBeforeCommit?.(op)) return { data: null, error: { message: 'Failed to fetch (never committed)' } };
      let data: any[] = [];
      let error: any = null;
      if (kind === 'select') {
        data = db.rows.filter((r) => matches(r, filters)).map((r) => pick(r, cols));
      } else if (kind === 'insert') {
        const dup = db.rows.some((r) => r.user_id === values!.user_id && r.content_item_id === values!.content_item_id);
        if (dup) error = { code: '23505', message: 'duplicate key' };
        else {
          const row = { watch_time: 0, play_count: 0, pause_count: 0, seek_count: 0, ...values };
          db.rows.push(row);
          data = [pick(row, cols)];
        }
      } else {
        const hit = db.rows.filter((r) => matches(r, filters));
        hit.forEach((r) => Object.assign(r, values));
        data = hit.map((r) => pick(r, cols));
      }
      if (!error && db.failAfterCommit?.(op)) return { data: null, error: { message: 'Failed to fetch (response lost)' } };
      if (error) return { data: null, error };
      if (!returning && mode === 'many') return { data: null, error: null };
      if (mode === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116' } };
      if (mode === 'maybe') return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };
    const b: any = {
      select(c = '*') { cols = c; returning = true; return b; },
      eq(col: string, value: unknown) { filters.push({ col, value, isNull: false }); return b; },
      is(col: string, value: null) { filters.push({ col, value, isNull: value === null }); return b; },
      single: () => run('single'),
      maybeSingle: () => run('maybe'),
      then: (ok: any, fail: any) => run('many').then(ok, fail),
    };
    return b;
  }

  return {
    from: () => ({
      select: (c = '*') => builder('select').select(c),
      insert: (values: Row) => builder('insert', values),
      update: (values: Row) => builder('update', values),
    }),
  };
}
