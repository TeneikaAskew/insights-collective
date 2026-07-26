// ABOUTME: Per-course roster stats for the Manage Courses table — average
// ABOUTME: completion computed from a single lightweight enrollments query so the
// ABOUTME: roster can show inline progress without an N+1 or a certificates scan.
// ABOUTME: A course with no enrollments is absent from the map → the UI shows "—".

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CourseRosterStat = { enrolled: number; avgProgress: number };

export function useCourseRosterStats() {
  const [statsByCourse, setStatsByCourse] = useState<Record<string, CourseRosterStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('enrollments')
        .select('course_id, completion_status');
      if (cancelled) return;
      if (error || !data) {
        // A failed stats query must not fabricate progress — leave the map empty
        // so every course renders "—" rather than a misleading 0%.
        setStatsByCourse({});
        setLoading(false);
        return;
      }
      const acc: Record<string, { sum: number; n: number }> = {};
      for (const row of data as Array<{ course_id: string; completion_status: number | null }>) {
        if (!row.course_id) continue;
        const bucket = acc[row.course_id] || (acc[row.course_id] = { sum: 0, n: 0 });
        bucket.sum += row.completion_status || 0;
        bucket.n += 1;
      }
      const next: Record<string, CourseRosterStat> = {};
      for (const [id, { sum, n }] of Object.entries(acc)) {
        next[id] = { enrolled: n, avgProgress: n ? Math.round(sum / n) : 0 };
      }
      setStatsByCourse(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { statsByCourse, loading };
}
