// Hook for Canvas-style content management
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CanvasContentService from '@/services/canvasContentService';
import type { ContentItem, Module } from '@/types/canvas';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useCanvasContent');

export function useCanvasContent(moduleId: string | null) {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (moduleId) {
      loadContentItems();
    }
  }, [moduleId]);

  const loadContentItems = async () => {
    if (!moduleId) return;

    try {
      setLoading(true);
      setError(null);
      const items = await CanvasContentService.getContentItems(moduleId);
      setContentItems(items);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Error loading content',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createContentItem = async (
    type: ContentItem['type'],
    title: string,
    content: string,
    settings?: any
  ) => {
    if (!moduleId) throw new Error('Module ID is required');

    try {
      const newItem = await CanvasContentService.createContentItem({
        course_id: contentItems[0]?.course_id || '', // Get from existing items
        module_id: moduleId,
        type,
        title,
        content,
        settings
      });

      setContentItems([...contentItems, newItem]);
      return newItem;
    } catch (err: any) {
      toast({
        title: 'Error creating content',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const updateContentItem = async (id: string, updates: Partial<ContentItem>) => {
    try {
      const updated = await CanvasContentService.updateContentItem(id, updates);
      setContentItems(contentItems.map(item => 
        item.id === id ? updated : item
      ));
      return updated;
    } catch (err: any) {
      toast({
        title: 'Error updating content',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const deleteContentItem = async (id: string) => {
    try {
      await CanvasContentService.deleteContentItem(id);
      setContentItems(contentItems.filter(item => item.id !== id));
    } catch (err: any) {
      toast({
        title: 'Error deleting content',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const reorderContentItems = async (itemIds: string[]) => {
    if (!moduleId) return;

    try {
      await CanvasContentService.reorderContentItems(moduleId, itemIds);
      // Reorder local state
      const reordered = itemIds.map(id => 
        contentItems.find(item => item.id === id)!
      ).filter(Boolean);
      setContentItems(reordered);
    } catch (err: any) {
      toast({
        title: 'Error reordering content',
        description: err.message,
        variant: 'destructive'
      });
      throw err;
    }
  };

  return {
    contentItems,
    loading,
    error,
    createContentItem,
    updateContentItem,
    deleteContentItem,
    reorderContentItems,
    refresh: loadContentItems
  };
}

export function useModuleContentCounts(courseId: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courseId) {
      loadCounts();
    }
  }, [courseId]);

  const loadCounts = async () => {
    try {
      setLoading(true);
      // This would be optimized with a custom query
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId);

      if (modules) {
        const countsMap: Record<string, number> = {};
        
        for (const module of modules) {
          const items = await CanvasContentService.getContentItems(module.id);
          countsMap[module.id] = items.filter(item => item.published).length;
        }
        
        setCounts(countsMap);
      }
    } catch (error) {
      logger.error('Error loading content counts:', error);
    } finally {
      setLoading(false);
    }
  };

  return { counts, loading };
}