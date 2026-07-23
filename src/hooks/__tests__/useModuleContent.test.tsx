// ABOUTME: Unit tests for the useModuleContent hook (direct supabase queries).
// ABOUTME: Covers fetch success/empty/error plus add/update/delete mutation paths.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useModuleContent } from '../useModuleContent';
import { getQueryBuilder, supabaseError } from '@/test/mocks/supabase';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

const MODULE_ID = '123e4567-e89b-12d3-a456-426614174000';
const CONTENT_ID = '223e4567-e89b-42d3-a456-426614174001';

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTENT_ID,
    module_id: MODULE_ID,
    title: 'Intro video',
    content_type: 'video',
    content: 'https://example.com/video',
    position: 0,
    ...overrides,
  };
}

describe('useModuleContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads module content on mount', async () => {
    const rows = [makeContent(), makeContent({ id: '323e4567-e89b-42d3-a456-426614174002', position: 1 })];
    getQueryBuilder().order.mockResolvedValue({ data: rows, error: null });

    const { result } = renderHook(() => useModuleContent(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.contents).toEqual(rows);
    expect(result.current.error).toBeNull();
  });

  it('returns empty contents when the module has no content', async () => {
    getQueryBuilder().order.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useModuleContent(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.contents).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('surfaces a fetch error instead of defaulting data', async () => {
    getQueryBuilder().order.mockResolvedValue(supabaseError('db down'));

    const { result } = renderHook(() => useModuleContent(MODULE_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('db down');
    expect(result.current.contents).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('rejects an invalid module id without querying', async () => {
    const { result } = renderHook(() => useModuleContent('not-a-uuid'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Invalid module ID format');
    expect(result.current.contents).toEqual([]);
  });

  it('adds content and appends it to state', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [], error: null });
    const newRow = makeContent({ title: 'New page' });
    builder.single.mockResolvedValue({ data: newRow, error: null });

    const { result } = renderHook(() => useModuleContent(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: any;
    await act(async () => {
      created = await result.current.addContent({
        module_id: MODULE_ID,
        title: 'New page',
        content_type: 'page',
        content: 'hello',
      } as any);
    });

    expect(created).toEqual(newRow);
    expect(result.current.contents).toEqual([newRow]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Success' })
    );
  });

  it('returns null and toasts when adding content fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [], error: null });
    builder.single.mockResolvedValue(supabaseError('insert failed'));

    const { result } = renderHook(() => useModuleContent(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: any;
    await act(async () => {
      created = await result.current.addContent({
        module_id: MODULE_ID,
        title: 'New page',
        content_type: 'page',
        content: 'hello',
      } as any);
    });

    expect(created).toBeNull();
    expect(result.current.contents).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'insert failed',
      })
    );
  });

  it('returns null and toasts when updating content fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeContent()], error: null });
    builder.single.mockResolvedValue(supabaseError('update failed'));

    const { result } = renderHook(() => useModuleContent(MODULE_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let updated: any;
    await act(async () => {
      updated = await result.current.updateContent(CONTENT_ID, { title: 'Renamed' });
    });

    expect(updated).toBeNull();
    // Local state is untouched on failure
    expect(result.current.contents[0].title).toBe('Intro video');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'update failed' })
    );
  });

  it('deletes content and removes it from state', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeContent()], error: null });
    // delete().eq() is awaited directly, so make the builder thenable-resolve
    builder.then.mockImplementation((resolve: any) => resolve({ error: null }));

    const { result } = renderHook(() => useModuleContent(MODULE_ID));
    await waitFor(() => expect(result.current.contents).toHaveLength(1));

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteContent(CONTENT_ID);
    });

    expect(ok).toBe(true);
    expect(result.current.contents).toEqual([]);
  });

  it('keeps state and toasts when deleting content fails', async () => {
    const builder = getQueryBuilder();
    builder.order.mockResolvedValue({ data: [makeContent()], error: null });
    builder.then.mockImplementation((resolve: any) =>
      resolve({ error: { message: 'delete failed' } })
    );

    const { result } = renderHook(() => useModuleContent(MODULE_ID));
    await waitFor(() => expect(result.current.contents).toHaveLength(1));

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteContent(CONTENT_ID);
    });

    expect(ok).toBe(false);
    expect(result.current.contents).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'delete failed' })
    );
  });
});
