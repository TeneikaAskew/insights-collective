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
  queued: string[] | null;
  /** Last order known to be stored: the idle baseline, then each order the server accepted. */
  confirmed: string[];
}

/**
 * One reorder request per scope at a time. A reorder made while one is in flight is shown at once and
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
        st.queued = ordered;
        return;
      }
      st.busy = true;
      try {
        let next: string[] | null = ordered;
        let lastErr: any = null;
        while (next) {
          st.queued = null;
          try {
            await r.send(next);
            st.confirmed = next;
            lastErr = null;
          } catch (err) {
            lastErr = err;
          }
          next = st.queued;
        }
        if (lastErr) {
          let server: string[] | null = null;
          try {
            server = await r.reload();
          } catch {
            server = null;
          }
          // Anything dragged while reloading was built on the failed order; the reconciled order wins.
          st.queued = null;
          st.confirmed = server ?? st.confirmed;
          r.apply(st.confirmed);
          r.onFailed(lastErr, server ? 'server' : 'last-confirmed');
        }
      } finally {
        st.busy = false;
      }
    },
  };
}
