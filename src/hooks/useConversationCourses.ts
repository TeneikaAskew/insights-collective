// ABOUTME: Maps conversation id -> course id, so a course page can show only its own threads.
// ABOUTME: Reads `conversations` directly; RLS already limits the rows to ones you are in.
//
// The conversation lists come from the `messages-helper` Edge Function, which selects a
// fixed column list that does not include `course_id`. Rather than redeploy that function
// (it is deployed by hand in this project, with no CI step, so a change there is a change
// only in the repo until somebody remembers), the scoping is read straight from the table:
// `conversations_participant_access` already restricts SELECT to conversations you are a
// participant of, so this returns your threads and nothing else.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useConversationCourses');

export function useConversationCourses() {
  const [courseByConversation, setCourseByConversation] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setCourseByConversation({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from('conversations')
          .select('id, course_id');

        if (queryError) throw queryError;
        if (cancelled) return;

        const map: Record<string, string | null> = {};
        for (const row of data ?? []) {
          map[row.id] = row.course_id ?? null;
        }
        setCourseByConversation(map);
      } catch (loadError) {
        // Surfaced, not swallowed. A course page that silently treats "we could not read
        // the scoping" as "no threads here" is indistinguishable from an empty inbox, and
        // the user would have no idea a message was being hidden from them.
        logger.error('Failed to load conversation course scoping:', loadError);
        if (!cancelled) setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { courseByConversation, loading, error };
}
