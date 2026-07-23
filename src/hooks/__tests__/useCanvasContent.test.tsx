// ABOUTME: Unit tests for useCanvasContent hook
// ABOUTME: Tests content management hook functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCanvasContent, useModuleContentCounts } from '../useCanvasContent';
import { mockSupabaseClient, getQueryBuilder, supabaseError } from '@/test/mocks/supabase';
import CanvasContentService from '@/services/canvasContentService';

// Mock the service
vi.mock('@/services/canvasContentService', () => ({
  default: {
    getContentItems: vi.fn(),
    createContentItem: vi.fn(),
    updateContentItem: vi.fn(),
    deleteContentItem: vi.fn(),
    reorderContentItems: vi.fn()
  }
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('useCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useCanvasContent(null));

    expect(result.current.contentItems).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load content items on mount', async () => {
    const mockItems = [
      { id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' },
      { id: '2', title: 'Item 2', type: 'assignment' as const, module_id: 'm1', course_id: 'c1', content: '', position: 1, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue(mockItems);

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.contentItems).toEqual(mockItems);
    expect(CanvasContentService.getContentItems).toHaveBeenCalledWith('m1');
  });

  it('should handle loading error', async () => {
    const error = new Error('Failed to load');
    vi.mocked(CanvasContentService.getContentItems).mockRejectedValue(error);

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load');
  });

  it('should create content item', async () => {
    const existingItems = [
      { id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    const newItem = {
      id: '2',
      title: 'New Item',
      type: 'page' as const,
      module_id: 'm1',
      course_id: 'c1',
      content: '',
      position: 1,
      published: false,
      settings: {},
      created_at: '',
      updated_at: '',
      created_by: 'u1'
    };

    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue(existingItems);
    vi.mocked(CanvasContentService.createContentItem).mockResolvedValue(newItem);

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: any;
    await act(async () => {
      created = await result.current.createContentItem('page', 'New Item', 'Content');
    });

    expect(created).toEqual(newItem);
    expect(result.current.contentItems).toHaveLength(2);
  });

  it('should update content item', async () => {
    const items = [
      { id: '1', title: 'Original', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    const updated = { id: '1', title: 'Updated', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' };

    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue(items);
    vi.mocked(CanvasContentService.updateContentItem).mockResolvedValue(updated);

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updatedItem: any;
    await act(async () => {
      updatedItem = await result.current.updateContentItem('1', { title: 'Updated' });
    });

    expect(updatedItem?.title).toBe('Updated');
    expect(result.current.contentItems[0].title).toBe('Updated');
  });

  it('should delete content item', async () => {
    const items = [
      { id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' },
      { id: '2', title: 'Item 2', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 1, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue(items);
    vi.mocked(CanvasContentService.deleteContentItem).mockResolvedValue();

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteContentItem('1');
    });

    expect(result.current.contentItems).toHaveLength(1);
    expect(result.current.contentItems[0].id).toBe('2');
  });

  it('should reorder content items', async () => {
    const items = [
      { id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' },
      { id: '2', title: 'Item 2', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 1, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' },
      { id: '3', title: 'Item 3', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 2, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue(items);
    vi.mocked(CanvasContentService.reorderContentItems).mockResolvedValue();

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reorderContentItems(['3', '1', '2']);
    });

    expect(result.current.contentItems[0].id).toBe('3');
    expect(result.current.contentItems[1].id).toBe('1');
    expect(result.current.contentItems[2].id).toBe('2');
  });

  it('should refresh content items', async () => {
    const initialItems = [{ id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }];
    const refreshedItems = [
      { id: '1', title: 'Item 1', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 0, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' },
      { id: '2', title: 'Item 2', type: 'page' as const, module_id: 'm1', course_id: 'c1', content: '', position: 1, published: false, settings: {}, created_at: '', updated_at: '', created_by: 'u1' }
    ];

    vi.mocked(CanvasContentService.getContentItems)
      .mockResolvedValueOnce(initialItems)
      .mockResolvedValueOnce(refreshedItems);

    const { result } = renderHook(() => useCanvasContent('m1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.contentItems).toHaveLength(1);

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.contentItems).toHaveLength(2);
    });
  });

  it('should not load if moduleId is null', () => {
    vi.mocked(CanvasContentService.getContentItems).mockResolvedValue([]);

    renderHook(() => useCanvasContent(null));

    expect(CanvasContentService.getContentItems).not.toHaveBeenCalled();
  });

  it('should throw error when creating without moduleId', async () => {
    const { result } = renderHook(() => useCanvasContent(null));

    await expect(
      result.current.createContentItem('page', 'Test', 'Content')
    ).rejects.toThrow('Module ID is required');
  });
});

describe('useModuleContentCounts', () => {
  const makeItem = (id: string, published: boolean) => ({
    id,
    title: `Item ${id}`,
    type: 'page' as const,
    module_id: 'm1',
    course_id: 'c1',
    content: '',
    position: 0,
    published,
    settings: {},
    created_at: '',
    updated_at: '',
    created_by: 'u1'
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads published content counts per module', async () => {
    // modules query terminates at .eq('course_id', ...)
    getQueryBuilder().eq.mockResolvedValue({
      data: [{ id: 'm1' }, { id: 'm2' }],
      error: null
    });
    vi.mocked(CanvasContentService.getContentItems).mockImplementation(async (moduleId: string) => {
      if (moduleId === 'm1') return [makeItem('1', true), makeItem('2', false)];
      return [makeItem('3', true), makeItem('4', true)];
    });

    const { result } = renderHook(() => useModuleContentCounts('c1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.counts).toEqual({ m1: 1, m2: 2 });
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error when the modules query fails', async () => {
    getQueryBuilder().eq.mockResolvedValue(supabaseError('modules query failed'));

    const { result } = renderHook(() => useModuleContentCounts('c1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('modules query failed');
    expect(result.current.counts).toEqual({});
    expect(CanvasContentService.getContentItems).not.toHaveBeenCalled();
  });

  it('surfaces an error and does not expose partial counts when one module count query fails', async () => {
    getQueryBuilder().eq.mockResolvedValue({
      data: [{ id: 'm1' }, { id: 'm2' }],
      error: null
    });
    vi.mocked(CanvasContentService.getContentItems)
      .mockResolvedValueOnce([makeItem('1', true)])
      .mockRejectedValueOnce(new Error('items query failed'));

    const { result } = renderHook(() => useModuleContentCounts('c1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('items query failed');
    // m1's count must not be presented as a complete result
    expect(result.current.counts).toEqual({});
  });
});
