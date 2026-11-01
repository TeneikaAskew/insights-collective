// ABOUTME: A stateful stand-in for useCourseProgress in page tests: it serves the T-10 read-model shape and, like the
// ABOUTME: real hook, only shows an item done after markItemComplete resolves (the real hook re-reads stored progress).
import { useState } from 'react';
import { vi, type Mock } from 'vitest';

export interface FakeProgressOptions {
  eligible: string[];
  done?: string[];
  mark: Mock;
  error?: string | null;
  loading?: boolean;
  /** A same-key refresh: the previous snapshot is still held while isLoading is true (like the real hook). */
  refreshing?: boolean;
  /** Eligible item IDs per module, for the per-module figures of the same snapshot (T-10 B). */
  modules?: Record<string, string[]>;
}

// Mirrors displayPercent in src/hooks/useCourseProgress.ts (that module is mocked in page tests).
const pct = (c: number, t: number) => (t <= 0 ? 0 : c >= t ? 100 : Math.min(99, Math.round((c / t) * 100)));

export function fakeCourseProgress(opts: FakeProgressOptions) {
  return function useFakeCourseProgress() {
    const [done, setDone] = useState<string[]>(opts.done ?? []);
    const doneIds = done.filter((id) => opts.eligible.includes(id));
    const unknown = Boolean(opts.error) || Boolean(opts.loading);
    return {
      data: unknown
        ? undefined
        : {
            modules: Object.entries(opts.modules ?? {}).map(([moduleId, ids]) => {
              const t = ids.filter((id) => opts.eligible.includes(id));
              const c = t.filter((id) => doneIds.includes(id)).length;
              return { moduleId, totalItems: t.length, completedItems: c, percent: pct(c, t.length), isComplete: t.length > 0 && c === t.length, itemIds: t };
            }),
            totalItems: opts.eligible.length,
            completedItems: doneIds.length,
            percent: pct(doneIds.length, opts.eligible.length),
            isComplete: opts.eligible.length > 0 && doneIds.length === opts.eligible.length,
            doneItemIds: doneIds,
            eligibleItemIds: opts.eligible,
          },
      isLoading: Boolean(opts.loading) || Boolean(opts.refreshing),
      error: opts.error ?? null,
      refetch: vi.fn(),
      markItemComplete: async (id: string) => {
        await opts.mark(id);
        setDone((d) => (d.includes(id) ? d : [...d, id]));
      },
      getModulePercent: () => 0,
    };
  };
}
