// ABOUTME: Unit tests for the canonical useCourseProgress hook.
// ABOUTME: Verifies per-module + overall percent aggregation across content_item_progressions.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCourseProgress } from '../useCourseProgress';

// --- Supabase mock ---------------------------------------------------------
// Each from('<table>') call returns a chainable thenable that resolves to
// whatever the per-test table override wires up. Keeps the test focused on
// the hook's aggregation logic.

type TableResponse = { data: any[] | null; error: any };
const tableResponses: Record<string, TableResponse> = {};

function buildQuery(table: string) {
  const self: any = {
    select: () => self,
    eq: () => self,
    in: () => self,
    then: (resolve: (value: TableResponse) => void) => {
      resolve(tableResponses[table] ?? { data: [], error: null });
    },
  };
  return self;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => buildQuery(table),
  },
}));

vi.mock('@/services/canvasContentService', () => ({
  default: {
    markContentItemAsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

function setTables(tables: Record<string, any[]>) {
  Object.keys(tableResponses).forEach((k) => delete tableResponses[k]);
  for (const [t, data] of Object.entries(tables)) {
    tableResponses[t] = { data, error: null };
  }
}

function setTableError(table: string, message: string) {
  tableResponses[table] = { data: null, error: { message } };
}

describe('useCourseProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty progress when course has no modules', async () => {
    setTables({ modules: [], content_items: [], content_item_progressions: [] });

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({
      modules: [],
      totalItems: 0,
      completedItems: 0,
      percent: 0,
    });
    expect(result.current.error).toBeNull();
  });

  it('computes per-module and overall percent from progressions', async () => {
    setTables({
      modules: [{ id: 'm1' }, { id: 'm2' }],
      content_items: [
        { id: 'i1', module_id: 'm1' },
        { id: 'i2', module_id: 'm1' },
        { id: 'i3', module_id: 'm2' },
        { id: 'i4', module_id: 'm2' },
      ],
      content_item_progressions: [
        { content_item_id: 'i1', workflow_state: 'read' },
        { content_item_id: 'i3', workflow_state: 'completed' },
        // 'unread' should not count as complete
        { content_item_id: 'i4', workflow_state: 'unread' },
      ],
    });

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.totalItems).toBe(4);
    expect(result.current.data?.completedItems).toBe(2);
    expect(result.current.data?.percent).toBe(50);

    const m1 = result.current.data?.modules.find((m) => m.moduleId === 'm1');
    const m2 = result.current.data?.modules.find((m) => m.moduleId === 'm2');
    expect(m1).toEqual({ moduleId: 'm1', totalItems: 2, completedItems: 1, percent: 50 });
    expect(m2).toEqual({ moduleId: 'm2', totalItems: 2, completedItems: 1, percent: 50 });
  });

  it('getModulePercent returns 0 for unknown modules', async () => {
    setTables({
      modules: [{ id: 'm1' }],
      content_items: [{ id: 'i1', module_id: 'm1' }],
      content_item_progressions: [{ content_item_id: 'i1', workflow_state: 'read' }],
    });

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getModulePercent('m1')).toBe(100);
    expect(result.current.getModulePercent('missing')).toBe(0);
  });

  it('does not query progressions when courseId is undefined', async () => {
    const { result } = renderHook(() => useCourseProgress(undefined));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeUndefined();
  });

  it('sets error and leaves data undefined when the modules query fails', async () => {
    setTables({ content_items: [], content_item_progressions: [] });
    setTableError('modules', 'modules query failed');

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('modules query failed');
    // Failure must NOT be reported as zeroed progress
    expect(result.current.data).toBeUndefined();
  });

  it('sets error and leaves data undefined when the content items query fails', async () => {
    setTables({
      modules: [{ id: 'm1' }],
      content_item_progressions: [],
    });
    setTableError('content_items', 'content items query failed');

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('content items query failed');
    expect(result.current.data).toBeUndefined();
  });

  it('sets error and leaves data undefined when the progressions query fails', async () => {
    setTables({
      modules: [{ id: 'm1' }],
      content_items: [{ id: 'i1', module_id: 'm1' }],
    });
    setTableError('content_item_progressions', 'progressions query failed');

    const { result } = renderHook(() => useCourseProgress('11111111-2222-4333-8444-555555555555'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('progressions query failed');
    expect(result.current.data).toBeUndefined();
  });
});
