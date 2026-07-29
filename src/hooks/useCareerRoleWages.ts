// ABOUTME: Reads BLS OEWS salary bands for career roles from the career_role_wages view.
// ABOUTME: Returns an empty map (never throws) so any surface can render without salary rather than guess.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logger';

const logger = createLogger('useCareerRoleWages');

export type CareerRoleWage = {
  slug: string;
  title: string;
  category: string;
  mapping_note: string | null;
  soc_code: string | null;
  occupation_title: string | null;
  employment: number | null;
  annual_mean: number | null;
  pct10: number | null;
  pct25: number | null;
  median: number | null;
  pct75: number | null;
  pct90: number | null;
  reference_period: string | null;
  source_name: string | null;
  source_url: string | null;
};

export type WageCitation = {
  source: string;
  url: string;
  referencePeriod: string;
};

/**
 * Reads the view directly rather than going through the `bls-wages` edge
 * function. Both return the same shape; the function exists so other apps can
 * consume this data over HTTP, but in-app a direct read avoids a function cold
 * start on a landing page and keeps working if the function is not deployed.
 */
export async function fetchCareerRoleWages(): Promise<CareerRoleWage[]> {
  const { data, error } = await supabase.from('career_role_wages' as any).select('*');

  if (error) {
    // Most likely cause: the BLS migration has not been applied to this project
    // yet. Salary is an enhancement, so degrade quietly instead of breaking the
    // page that asked for it.
    logger.error('Could not read career_role_wages:', error);
    return [];
  }
  return (data || []) as unknown as CareerRoleWage[];
}

export function useCareerRoleWages() {
  const query = useQuery({
    queryKey: ['bls', 'career-role-wages'],
    queryFn: fetchCareerRoleWages,
    // OEWS publishes once a year. There is no reason to refetch this often.
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const rows = query.data ?? [];

  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const withFigures = rows.find((r) => r.reference_period && r.source_name && r.source_url);
  const citation: WageCitation | null = withFigures
    ? {
        source: withFigures.source_name!,
        url: withFigures.source_url!,
        referencePeriod: withFigures.reference_period!,
      }
    : null;

  return { ...query, rows, bySlug, citation };
}

/** `85660` → `$86k`. Bands are approximations; the exact dollar adds nothing. */
export function formatWageShort(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `$${Math.round(value / 1000)}k`;
}

export default useCareerRoleWages;
