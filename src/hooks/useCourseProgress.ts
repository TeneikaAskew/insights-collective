// ABOUTME: Single source of truth for course progress tracking.
// ABOUTME: Reads from content_item_progressions and computes per-module + overall percent.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CanvasContentService from '@/services/canvasContentService';
import { createLogger } from '@/utils/logger';
import { isValidUUID } from '@/utils/idUtils';
import { isProgressionDone } from '@/utils/progressionStates';


const logger = createLogger('useCourseProgress');

export interface ModuleProgress {
  moduleId: string;
  totalItems: number;
  completedItems: number;
  percent: number;
}

export interface CourseProgress {
  modules: ModuleProgress[];
  totalItems: number;
  completedItems: number;
  percent: number;
}

export interface UseCourseProgressResult {
  data: CourseProgress | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markItemComplete: (contentItemId: string) => Promise<void>;
  getModulePercent: (moduleId: string) => number;
}

const EMPTY: CourseProgress = {
  modules: [],
  totalItems: 0,
  completedItems: 0,
  percent: 0,
};

/**
 * Canonical progress hook. Replaces the ad-hoc calculations in:
 *  - CourseDetail.tsx (module.completionStatus reduce)
 *  - CourseModulesList.tsx (per-module content_item_progressions query)
 *  - CourseProgressOverview.tsx (legacy content_progress table)
 *
 * Progress is defined by isProgressionDone() (src/utils/progressionStates.ts)
 * divided by total published content_items for the course's modules.
 */
export function useCourseProgress(
  courseId: string | undefined,
  studentIdOverride?: string,
): UseCourseProgressResult {
  const { user } = useAuth();
  const studentId = studentIdOverride ?? user?.id;
  const [data, setData] = useState<CourseProgress | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(courseId));
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    // modules.course_id is a uuid column — a non-UUID route param (e.g. a
    // mistyped /courses/<junk> URL) can never match and Postgres rejects it
    // with 22P02. Same guard useCoursePermissions already uses.
    if (!courseId || !isValidUUID(courseId)) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch published modules for this course
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', courseId)
        .eq('published', true);

      if (modulesError) throw modulesError;

      const moduleIds = (modules || []).map((m) => m.id);
      if (moduleIds.length === 0) {
        setData(EMPTY);
        return;
      }

      // 2. Fetch published content items for those modules
      const { data: items, error: itemsError } = await supabase
        .from('content_items')
        .select('id, module_id')
        .in('module_id', moduleIds)
        .eq('published', true);

      if (itemsError) throw itemsError;

      const contentItems = items || [];
      const itemIds = contentItems.map((i) => i.id);

      // 3. Fetch the user's progressions for those items (only if logged in)
      let completedIds = new Set<string>();
      if (studentId && itemIds.length > 0) {
        const { data: progressions, error: progError } = await supabase
          .from('content_item_progressions')
          .select('content_item_id, workflow_state')
          .eq('user_id', studentId)
          .in('content_item_id', itemIds);

        if (progError) throw progError;

        completedIds = new Set(
          (progressions || [])
            .filter((p) => isProgressionDone(p.workflow_state))
            .map((p) => p.content_item_id),
        );
      }

      // 4. Aggregate per module
      const byModule = new Map<string, { total: number; completed: number }>();
      for (const id of moduleIds) {
        byModule.set(id, { total: 0, completed: 0 });
      }
      for (const item of contentItems) {
        const bucket = byModule.get(item.module_id);
        if (!bucket) continue;
        bucket.total += 1;
        if (completedIds.has(item.id)) bucket.completed += 1;
      }

      const modulesProgress: ModuleProgress[] = Array.from(byModule.entries()).map(
        ([moduleId, { total, completed }]) => ({
          moduleId,
          totalItems: total,
          completedItems: completed,
          percent: total === 0 ? 0 : Math.round((completed / total) * 100),
        }),
      );

      const totalItems = contentItems.length;
      const completedItems = completedIds.size;
      const percent = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

      setData({
        modules: modulesProgress,
        totalItems,
        completedItems,
        percent,
      });
    } catch (err: any) {
      logger.error('Failed to load course progress', err);
      setError(err?.message || 'Failed to load course progress');
      setData(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, studentId]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  const markItemComplete = useCallback(
    async (contentItemId: string) => {
      await CanvasContentService.markContentItemAsRead(contentItemId);
      await fetchProgress();
    },
    [fetchProgress],
  );

  const getModulePercent = useCallback(
    (moduleId: string): number => {
      const module = data?.modules.find((m) => m.moduleId === moduleId);
      return module?.percent ?? 0;
    },
    [data],
  );

  return {
    data,
    isLoading,
    error,
    refetch: fetchProgress,
    markItemComplete,
    getModulePercent,
  };
}
