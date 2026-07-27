// ABOUTME: Per-form submission counts for the Manage Forms roster. Aggregated
// ABOUTME: server-side via the form_submission_counts RPC — a client-side tally
// ABOUTME: of an unbounded select is silently truncated at the PostgREST row
// ABOUTME: cap. A failed query renders "—" in the UI, never a fabricated 0.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useFormSubmissionCounts');

export function useFormSubmissionCounts() {
  const [countsByForm, setCountsByForm] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(false);
    // One row per form, computed in the database. Selecting every submission
    // and counting them here would report 0 for any form whose rows fall past
    // the response cap once submissions grow.
    const { data, error: err } = await supabase.rpc('form_submission_counts');
    if (err) {
      logger.error('Error loading submission counts:', err);
      setCountsByForm({});
      setError(true);
      setLoading(false);
      return;
    }
    const acc: Record<string, number> = {};
    for (const row of (data || []) as Array<{ form_id: string; submission_count: number }>) {
      if (!row.form_id) continue;
      acc[row.form_id] = Number(row.submission_count) || 0;
    }
    setCountsByForm(acc);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { countsByForm, loading, error, refetch: fetchCounts };
}
