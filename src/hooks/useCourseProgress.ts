// ABOUTME: Single source of truth for course progress tracking.
// ABOUTME: Reads from content_item_progressions and computes per-module + overall percent.

import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Display-only, see displayPercent(). Never use it as a completion test. */
  percent: number;
  /** Exact: completedItems === totalItems && totalItems > 0. */
  isComplete: boolean;
}

/**
 * STORED-PROGRESS read model (T-10). "Done" is isProgressionDone(workflow_state) over ONE eligible universe:
 * published === true items in published === true modules of this course, as RLS lets this user read them.
 * This is not certificate eligibility: only the database issuer decides that, and only its r5 path requires genuine
 * assessment evidence. The legacy completion RPC (check_course_completion) does NOT require that evidence the way the
 * r5 issuer does, so neither 100% here nor that RPC's answer promises a certificate; only an issued row does.
 */
export interface CourseProgress {
  modules: ModuleProgress[];
  totalItems: number;
  completedItems: number;
  /** Display-only, see displayPercent(). Never use it as a completion test. */
  percent: number;
  /** Exact: completedItems === totalItems && totalItems > 0. */
  isComplete: boolean;
  /** Done item IDs, already intersected with the eligible universe (deduplicated). */
  doneItemIds: string[];
  /** The eligible universe, in no particular order. */
  eligibleItemIds: string[];
}

/**
 * Display-only percent. 0 for an empty universe; 100 only when every eligible item is done; otherwise the rounded
 * ratio capped at 99, so 249 of 250 never displays as a false 100%. Completion tests use the exact counts instead.
 */
export function displayPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  if (completed >= total) return 100;
  return Math.min(99, Math.round((completed / total) * 100));
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
  isComplete: false,
  doneItemIds: [],
  eligibleItemIds: [],
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
  // Only the latest request may write state, and a new course/user key starts from unknown, never from the
  // previous course's or user's numbers.
  // The CURRENT identity is updated during render, so a callback captured for an older course/user (for example a
  // delayed markItemComplete(A) that resolves after the page moved to course B) can tell it is stale. A result is
  // written only when it is the newest request AND it was made for the identity that is current now (T-10 A).
  const requestSeq = useRef(0);
  const lastKey = useRef<string | null>(null);
  const identity = `${courseId ?? ''}|${studentId ?? ''}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;

  const fetchProgress = useCallback(async () => {
    const key = `${courseId ?? ''}|${studentId ?? ''}`;
    // A captured callback for a previous identity neither reads nor invalidates the current identity's request.
    if (key !== currentIdentity.current) return;
    const seq = ++requestSeq.current;
    if (lastKey.current !== key) {
      lastKey.current = key;
      setData(undefined);
    }
    const current = () => seq === requestSeq.current && key === currentIdentity.current;
    // modules.course_id is a uuid column — a non-UUID route param (e.g. a
    // mistyped /courses/<junk> URL) can never match and Postgres rejects it
    // with 22P02. Same guard useCoursePermissions already uses.
    if (!courseId || !isValidUUID(courseId)) {
      setData(undefined);
      setError(null);
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
        if (current()) setData(EMPTY);
        return;
      }

      // 2. Fetch published content items for those modules
      const { data: items, error: itemsError } = await supabase
        .from('content_items')
        .select('id, module_id')
        .in('module_id', moduleIds)
        .eq('published', true);

      if (itemsError) throw itemsError;

      // Distinct items whose module is in the eligible module set: one row per item, never double-counted.
      const seenItems = new Set<string>();
      const contentItems = (items || []).filter((i) => {
        if (!moduleIds.includes(i.module_id) || seenItems.has(i.id)) return false;
        seenItems.add(i.id);
        return true;
      });
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
          percent: displayPercent(completed, total),
          isComplete: total > 0 && completed === total,
        }),
      );

      // Done IDs are intersected with the eligible IDs: a progression for an ineligible item never counts.
      const eligible = itemIds;
      const eligibleSet = new Set(eligible);
      const done = Array.from(completedIds).filter((id) => eligibleSet.has(id));
      const totalItems = eligible.length;
      const completedItems = done.length;

      if (!current()) return;
      setData({
        modules: modulesProgress,
        totalItems,
        completedItems,
        percent: displayPercent(completedItems, totalItems),
        isComplete: totalItems > 0 && completedItems === totalItems,
        doneItemIds: done,
        eligibleItemIds: eligible,
      });
    } catch (err: any) {
      if (!current()) return;
      logger.error('Failed to load course progress', err);
      setError(err?.message || 'Failed to load course progress');
      setData(undefined);
    } finally {
      if (current()) setIsLoading(false);
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
