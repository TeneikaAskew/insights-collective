import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { onboardingTours } from '@/data/onboardingTours';

/**
 * The home tour spotlights sections by `[data-tour="…"]`, and Index renders those
 * ids from its own sections array. Reordering or deleting a section silently
 * breaks the tour, so this pins the two together.
 */
describe('home onboarding tour targets', () => {
  const indexSource = fs.readFileSync(
    path.resolve(__dirname, '../Index.tsx'),
    'utf-8',
  );

  const renderedIds = Array.from(indexSource.matchAll(/\{\s*id:\s*'([a-zA-Z]+)'/g)).map(
    (m) => m[1],
  );

  it('renders at least the sections the tour expects', () => {
    expect(renderedIds.length).toBeGreaterThan(0);
  });

  it('has a rendered section for every home tour step', () => {
    const targets = onboardingTours.home.steps
      .map((step) => step.target.match(/\[data-tour="([^"]+)"\]/)?.[1])
      .filter(Boolean) as string[];

    expect(targets.length).toBe(onboardingTours.home.steps.length);

    const missing = targets.filter((t) => !renderedIds.includes(t));
    expect(missing, `home tour targets with no matching section: ${missing.join(', ')}`).toEqual([]);
  });
});
