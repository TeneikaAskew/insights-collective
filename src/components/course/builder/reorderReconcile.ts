// ABOUTME: Pure helpers for the builder's optimistic reorder: apply an id order to a list without
// ABOUTME: losing or inventing entries, and track which reorder is the latest per scope.

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

/** Per-scope counter: a reorder may reconcile local order only while it is still the latest in its scope. */
export function createReorderSequencer() {
  const latest = new Map<string, number>();
  return {
    begin(scope: string): number {
      const n = (latest.get(scope) ?? 0) + 1;
      latest.set(scope, n);
      return n;
    },
    isLatest(scope: string, n: number): boolean {
      return latest.get(scope) === n;
    },
  };
}
