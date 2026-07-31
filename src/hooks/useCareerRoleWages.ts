// ABOUTME: Reads BLS OEWS salary bands for career roles from the career_role_wages view.
// ABOUTME: Every row is guaranteed to carry wage figures, so callers never need an absent-data branch.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CareerTrack } from '@/data/careerQuizData';

/**
 * `career_roles.soc_code` is NOT NULL with a FK into `bls_occupations`, and the
 * view inner-joins the two, so every field below is populated for every row.
 * Nothing that reads this needs a "no wage data" path.
 */
export type CareerRoleWage = {
  slug: string;
  title: string;
  category: string;
  mapping_note: string | null;
  soc_code: string;
  occupation_title: string;
  employment: number;
  annual_mean: number;
  pct10: number;
  pct25: number;
  median: number;
  pct75: number;
  pct90: number;
  reference_period: string;
  source_name: string;
  source_url: string;
};

export type WageCitation = {
  source: string;
  url: string;
  referencePeriod: string;
};

/**
 * The four landing-page tracks resolve to one representative role each, so a
 * track's band stays traceable to a single BLS occupation instead of being an
 * average. Analytics and Business Intelligence share an occupation because BLS
 * reports both inside Data Scientists (15-2051).
 *
 * Lives here rather than in a component so the landing page and the career coach
 * cannot drift apart.
 */
export const TRACK_ROLE_SLUG: Record<CareerTrack, string> = {
  'AI/ML': 'machine-learning-engineer',
  Analytics: 'data-analyst',
  'Data Engineering': 'data-engineer',
  'Business Intelligence': 'bi-analyst',
};

/**
 * Reads the view directly rather than going through the `bls-wages` edge
 * function. Both return the same shape; the function exists so other apps can
 * consume this data over HTTP, but in-app a direct read avoids a function cold
 * start on a landing page.
 *
 * Errors propagate. A failure here means the reference data is missing or RLS
 * changed — both are bugs that should surface, not be swallowed into an empty
 * list that renders as "no salaries available".
 */
export async function fetchCareerRoleWages(): Promise<CareerRoleWage[]> {
  const { data, error } = await supabase.from('career_role_wages' as any).select('*');
  if (error) throw error;
  return (data || []) as unknown as CareerRoleWage[];
}

export function useCareerRoleWages() {
  const query = useQuery({
    queryKey: ['bls', 'career-role-wages'],
    queryFn: fetchCareerRoleWages,
    // OEWS publishes once a year. There is no reason to refetch this often.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const rows = query.data ?? [];
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const citation: WageCitation | null = rows.length
    ? {
        source: rows[0].source_name,
        url: rows[0].source_url,
        referencePeriod: rows[0].reference_period,
      }
    : null;

  return { ...query, rows, bySlug, citation };
}

/** `85660` → `$86k`. Bands are approximations; the exact dollar adds nothing. */
export function formatWageShort(value: number): string {
  return `$${Math.round(value / 1000)}k`;
}

export default useCareerRoleWages;
