// ABOUTME: In-memory Supabase query fake for roster/report tests: eq/in filters, order, range paging and a row cap.
// ABOUTME: An optional `visible` predicate per table mirrors RLS, so tests can model who may read which rows.

export type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  /** Mirrors PostgREST max-rows: a request never returns more than this many rows. */
  rowCap: number;
  fail: string | null;
  /** Fail only requests to these tables, with the given message. */
  failTables?: Record<string, string>;
  visible?: Record<string, (row: Row) => boolean>;
  calls: Array<{ table: string; range?: [number, number] }>;
}

export function makeFakeDb(tables: Record<string, Row[]> = {}): FakeDb {
  return { tables, rowCap: 1000, fail: null, calls: [] };
}

export function makeFakeClient(db: FakeDb) {
  const from = (table: string) => {
    const preds: Array<(r: Row) => boolean> = [];
    const orders: string[] = [];
    let range: [number, number] | undefined;
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        preds.push((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        preds.push((r) => vals.includes(r[col]));
        return builder;
      },
      order: (col: string) => {
        orders.push(col);
        return builder;
      },
      range: (a: number, b: number) => {
        range = [a, b];
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        db.calls.push({ table, range });
        const msg = db.fail ?? db.failTables?.[table];
        if (msg) return Promise.resolve({ data: null, error: { message: msg } }).then(resolve, reject);
        const vis = db.visible?.[table] ?? (() => true);
        let rows = (db.tables[table] ?? []).filter((r) => vis(r) && preds.every((p) => p(r)));
        if (orders.length) {
          rows = [...rows].sort((x, y) => {
            for (const c of orders) {
              const a = String(x[c]);
              const b = String(y[c]);
              if (a !== b) return a < b ? -1 : 1;
            }
            return 0;
          });
        }
        if (range) rows = rows.slice(range[0], range[1] + 1);
        rows = rows.slice(0, db.rowCap);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return builder;
  };
  return { from };
}
