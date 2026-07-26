// ABOUTME: Per-form submission counts for the Manage Forms roster — a single
// ABOUTME: lightweight query over form_submissions (form_id only), tallied
// ABOUTME: client-side into a Map. A form absent from the map (or a failed
// ABOUTME: query) renders "—" in the UI, never a fabricated 0.

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
    const { data, error: err } = await supabase.from('form_submissions').select('form_id');
    if (err) {
      logger.error('Error loading submission counts:', err);
      setCountsByForm({});
      setError(true);
      setLoading(false);
      return;
    }
    const acc: Record<string, number> = {};
    for (const row of (data || []) as Array<{ form_id: string }>) {
      if (!row.form_id) continue;
      acc[row.form_id] = (acc[row.form_id] || 0) + 1;
    }
    setCountsByForm(acc);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { countsByForm, loading, error, refetch: fetchCounts };
}
