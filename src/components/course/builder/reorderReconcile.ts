// ABOUTME: Builder reorder helpers: apply an id order to a list without losing or inventing entries, and a
// ABOUTME: per-scope coordinator that keeps at most one reorder request in flight and reconciles on failure.

/**
 * Returns `list` arranged in `order`. Ids in `order` that are not in `list` are skipped (never an
 * undefined hole), and entries of `list` missing from `order` keep their relative order at the end.
 */
export function applyIdOrder<T extends { id: string }>(list: readonly T[], order: readonly string[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x] as const));
  const placed = new Set<string>();
  const out: T[] = [];
  for (const id of order) {
    const x = byId.get(id);
    if (x && !placed.has(id)) {
      out.push(x);
      placed.add(id);
    }
  }
  for (const x of list) if (!placed.has(x.id)) out.push(x);
  return out;
}

export interface ReorderRequest {
  /** Order shown on screen right now (read only when the scope is idle, as the confirmed baseline). */
  current: () => string[];
  /** Show an order (optimistic, or the reconciled one). */
  apply: (order: string[]) => void;
  /** Persist an order. */
  send: (order: string[]) => Promise<void>;
  /** Read the order the server holds. */
  reload: () => Promise<string[]>;
  /** The latest request failed; `restored` says what is now shown. */
  onFailed: (err: any, restored: 'server' | 'last-confirmed') => void;
}

interface ScopeState {
  busy: boolean;
  /** The newest waiting order together with its own request: it is sent through its own `send`, never another's. */
  queued: { order: string[]; r: ReorderRequest } | null;
  /** Last order known to be stored: the idle baseline, then each order the server accepted. */
  confirmed: string[];
}

/**
 * One reorder request per scope at a time. A scope must name the exact target (e.g. `sections:<courseId>`),
 * so requests for different courses or sections never share a queue. A reorder made while one is in flight is shown at once and
 * sent when the scope is free (only the newest waiting order is sent). Only the last request's outcome
 * decides what is shown: if it fails, the server order is reloaded, or, if that read fails too, the last
 * order the server accepted is shown. A failed request followed by a newer one never shows a speculative
 * order, and a newer successful order is never undone by an older failure.
 */
export function createReorderCoordinator() {
  const scopes = new Map<string, ScopeState>();
  return {
    async request(scope: string, ordered: string[], r: ReorderRequest): Promise<void> {
      let st = scopes.get(scope);
      if (!st) {
        st = { busy: false, queued: null, confirmed: [] };
        scopes.set(scope, st);
      }
      if (!st.busy) st.confirmed = r.current();
      r.apply(ordered);
      if (st.busy) {
        st.queued = { order: ordered, r };
        return;
      }
      st.busy = true;
      try {
        let next: { order: string[]; r: ReorderRequest } | null = { order: ordered, r };
        let last = next;
        let lastErr: any = null;
        while (next) {
          st.queued = null;
          last = next;
          try {
            await next.r.send(next.order);
            st.confirmed = next.order;
            lastErr = null;
          } catch (err) {
            lastErr = err;
          }
          next = st.queued;
        }
        if (lastErr) {
          // Reconcile through the last request's own callbacks (the one whose outcome decides).
          const lr = last.r;
          let server: string[] | null = null;
          try {
            server = await lr.reload();
          } catch {
            server = null;
          }
          // Anything dragged while reloading was built on the failed order; the reconciled order wins.
          st.queued = null;
          st.confirmed = server ?? st.confirmed;
          lr.apply(st.confirmed);
          lr.onFailed(lastErr, server ? 'server' : 'last-confirmed');
        }
      } finally {
        st.busy = false;
      }
    },
  };
}
