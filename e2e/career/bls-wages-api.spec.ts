// ABOUTME: The bls-wages edge function contract — reference data in, wage bands out, writes gated.
// ABOUTME: Talks to the function over HTTP, so it fails if the migration is unapplied or the gates regress.
import { test, expect } from '@playwright/test';

/**
 * These run against the deployed function rather than the app, because the data
 * contract is the thing under test: an un-applied migration, an RLS change, or a
 * missing gate are all invisible from the UI until a page renders wrong.
 *
 * Anonymous throughout — no `storageState`. The read path is meant to work signed
 * out, and the write paths are meant to refuse exactly this caller.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const FN = `${SUPABASE_URL}/functions/v1/bls-wages`;

/** Seeded by 20260802000000_bls_wage_reference.sql. Pinned so a partial load fails. */
const TOTAL_ROLES = 33;

test.describe('bls-wages edge function', () => {
  test.skip(!ANON_KEY, 'VITE_SUPABASE_ANON_KEY is required to reach the function');

  test('serves every seeded role to an anonymous caller', async ({ request }) => {
    const res = await request.get(FN, { headers: { apikey: ANON_KEY } });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.roles)).toBe(true);
    // If the migration never applied, this is 0 and every salary band on the
    // site renders empty. That is the failure this pins down.
    expect(body.roles.length).toBe(TOTAL_ROLES);
  });

  test('every role carries an ordered, positive distribution', async ({ request }) => {
    const res = await request.get(FN, { headers: { apikey: ANON_KEY } });
    const { roles } = await res.json();

    for (const role of roles) {
      const { pct10, pct25, median, pct75, pct90, slug } = role;
      for (const [name, v] of Object.entries({ pct10, pct25, median, pct75, pct90 })) {
        expect(Number.isFinite(v), `${slug}.${name} is not a number`).toBe(true);
        expect(v, `${slug}.${name} is not positive`).toBeGreaterThan(0);
      }
      // Mirrors the CHECK constraint on bls_occupations. If the two ever
      // disagree, the constraint is the one to trust.
      expect(pct10).toBeLessThanOrEqual(pct25);
      expect(pct25).toBeLessThanOrEqual(median);
      expect(median).toBeLessThanOrEqual(pct75);
      expect(pct75).toBeLessThanOrEqual(pct90);
    }
  });

  test('every role is attributed to a real BLS occupation', async ({ request }) => {
    const res = await request.get(FN, { headers: { apikey: ANON_KEY } });
    const { roles, citation } = await res.json();

    // A pay figure with no traceable source is what this feature exists to avoid.
    for (const role of roles) {
      expect(role.soc_code, `${role.slug} has no SOC code`).toMatch(/^\d{2}-\d{4}$/);
      expect(role.occupation_title?.length).toBeGreaterThan(0);
    }

    expect(citation.source).toContain('Bureau of Labor Statistics');
    expect(citation.url).toMatch(/^https:\/\/(www\.)?bls\.gov\//);
    expect(citation.reference_period).toMatch(/^May \d{4}$/);
  });

  test('filters narrow the response without changing its shape', async ({ request }) => {
    const res = await request.get(`${FN}?slug=data-analyst`, {
      headers: { apikey: ANON_KEY },
    });
    const { roles } = await res.json();

    expect(roles.length).toBe(1);
    expect(roles[0].slug).toBe('data-analyst');
    expect(roles[0].median).toBeGreaterThan(0);
  });

  test('discovering an occupation refuses an anonymous caller', async ({ request }) => {
    // Before this gate existed, this exact request reached a service-role insert
    // and spent a BLS query — anyone could write reference data and drain the
    // daily quota. 15-1212 is real, so a 2xx here means the gate is gone, not
    // that the code was rejected.
    const res = await request.post(FN, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: { lookup: true, socCode: '15-1212', title: 'Cyber Security Analyst' },
    });

    expect(res.status()).toBe(401);
    expect((await res.json()).error).toContain('authorization');
  });

  test('refreshing wage data refuses a caller without the service role key', async ({ request }) => {
    const res = await request.post(FN, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { refresh: true },
    });

    expect(res.status()).toBe(403);
    expect((await res.json()).error).toContain('service role key');
  });

  test('a POST with neither verb is a bad request, not a silent no-op', async ({ request }) => {
    const res = await request.post(FN, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
