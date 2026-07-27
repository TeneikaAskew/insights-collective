// ABOUTME: Per-course roster stats for the Manage Courses table. Aggregated
// ABOUTME: server-side via the course_roster_stats RPC — tallying an unbounded
// ABOUTME: enrollments select client-side is silently truncated at the
// ABOUTME: PostgREST row cap. A course with no data shows "—", never a fake 0.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useCourseRosterStats');

export type CourseRosterStat = { enrolled: number; avgProgress: number };

export function useCourseRosterStats() {
  const [statsByCourse, setStatsByCourse] = useState<Record<string, CourseRosterStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // avg_progress is computed from the same completion_status column the
      // course drawer displays, so the roster column and the drawer agree.
      const { data, error } = await supabase.rpc('course_roster_stats');
      if (cancelled) return;
      if (error || !data) {
        // A failed stats query must not fabricate progress — leave the map empty
        // so every course renders "—" rather than a misleading 0%.
        logger.error('Error loading course roster stats:', error);
        setStatsByCourse({});
        setLoading(false);
        return;
      }
      const next: Record<string, CourseRosterStat> = {};
      for (const row of (data || []) as Array<{
        course_id: string;
        enrolled: number;
        avg_progress: number;
      }>) {
        if (!row.course_id) continue;
        next[row.course_id] = {
          enrolled: Number(row.enrolled) || 0,
          avgProgress: Math.round(Number(row.avg_progress) || 0),
        };
      }
      setStatsByCourse(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { statsByCourse, loading };
}
