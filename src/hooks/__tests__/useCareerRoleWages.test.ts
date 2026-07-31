import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectMock = vi.fn();
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => (fromMock as any)(...args) },
}));

import {
  fetchCareerRoleWages,
  formatWageShort,
  TRACK_ROLE_SLUG,
} from '../useCareerRoleWages';
import { trackPersonas } from '@/data/careerQuizData';

describe('formatWageShort', () => {
  it('rounds to the nearest thousand', () => {
    expect(formatWageShort(85660)).toBe('$86k');
    expect(formatWageShort(120230)).toBe('$120k');
    expect(formatWageShort(158880)).toBe('$159k');
  });
});

describe('TRACK_ROLE_SLUG', () => {
  it('covers every quiz track', () => {
    // A track with no entry would render a card with no pay band, silently.
    const missing = trackPersonas
      .map((p) => p.track)
      .filter((track) => !TRACK_ROLE_SLUG[track]);

    expect(missing, `tracks with no BLS role mapping: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('fetchCareerRoleWages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the joined view', async () => {
    selectMock.mockResolvedValue({ data: [{ slug: 'data-analyst' }], error: null });
    const rows = await fetchCareerRoleWages();

    expect(fromMock).toHaveBeenCalledWith('career_role_wages');
    expect(rows).toHaveLength(1);
  });

  it('propagates errors instead of swallowing them into an empty list', async () => {
    // Returning [] here would render as "no salaries available" and hide a
    // missing migration or a broken RLS policy. The failure has to surface.
    const error = { message: 'relation "career_role_wages" does not exist' };
    selectMock.mockResolvedValue({ data: null, error });

    await expect(fetchCareerRoleWages()).rejects.toEqual(error);
  });
});
