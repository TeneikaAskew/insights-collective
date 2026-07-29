import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectMock = vi.fn();
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => (fromMock as any)(...args) },
}));

import { fetchCareerRoleWages, formatWageShort } from '../useCareerRoleWages';

describe('formatWageShort', () => {
  it('rounds to the nearest thousand', () => {
    expect(formatWageShort(85660)).toBe('$86k');
    expect(formatWageShort(120230)).toBe('$120k');
  });

  it('returns null for missing figures rather than a placeholder', () => {
    // A "$0k" or "N/A" band would read as real data. Callers render nothing.
    expect(formatWageShort(null)).toBeNull();
    expect(formatWageShort(undefined)).toBeNull();
    expect(formatWageShort(Number.NaN)).toBeNull();
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

  it('returns an empty list when the table is missing instead of throwing', async () => {
    // Before the BLS migration is applied the view does not exist. Salary is an
    // enhancement, so every surface must still render.
    selectMock.mockResolvedValue({
      data: null,
      error: { message: 'relation "career_role_wages" does not exist' },
    });

    await expect(fetchCareerRoleWages()).resolves.toEqual([]);
  });
});
