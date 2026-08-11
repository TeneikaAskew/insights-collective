// ABOUTME: The LinkedIn archive must link out to the profile it archives. Runs
// ABOUTME: as admin because page_visibility hides /teneika-linkedin from users
// ABOUTME: and instructors — under any other session this page is Coming Soon.
import { test, expect } from '../fixtures/page-helpers';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

test.describe('LinkedIn archive links to its source profile', () => {
  test('the name in the subheading opens the LinkedIn profile', async ({ page }) => {
    await page.goto(`${BASE}/teneika-linkedin`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Teneika's LinkedIn Posts/i, level: 1 }),
      'Page did not render its heading. If this shows Coming Soon, page_visibility ' +
        'for /teneika-linkedin no longer grants the acting account access.',
    ).toBeVisible({ timeout: 15_000 });

    const link = page.getByTestId('linkedin-profile-link');
    // Present whether or not the archive holds anything. This page renders
    // "No LinkedIn posts available" with only a Scrape button when empty, which
    // is precisely when a reader needs a way through to the real posts.
    await expect(link).toBeVisible({ timeout: 15_000 });
    await expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/teneikaaskew');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
  });

  test('both social archives sit directly under Resources in the sidebar', async ({ page }) => {
    // Admin, because /teneika-linkedin is hidden from every other role and the
    // sidebar filters on the same visibility, so only an admin sees both.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });

    const nav = page.locator('[data-sidebar="menu"]').first();
    const links = nav.locator('a[href]');
    await expect(links.first()).toBeAttached({ timeout: 15_000 });

    // By href, not by label: the rail hides its labels when collapsed, so a
    // name-based query finds nothing in that state and would report a missing
    // item for a sidebar that is perfectly correct.
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? ''),
    );

    const resources = hrefs.indexOf('/resources');
    const linkedIn = hrefs.indexOf('/teneika-linkedin');
    const tweets = hrefs.indexOf('/teneika-tweets');

    expect(resources, `Resources missing from sidebar: ${hrefs.join(' | ')}`).toBeGreaterThan(-1);
    expect(linkedIn, `LinkedIn archive missing from sidebar: ${hrefs.join(' | ')}`).toBeGreaterThan(-1);
    expect(tweets, `Tweets archive missing from sidebar: ${hrefs.join(' | ')}`).toBeGreaterThan(-1);

    // Immediately after Resources, in that order — they used to sit far down
    // the list between Messages and Notifications.
    expect(linkedIn, `sidebar order: ${hrefs.join(' | ')}`).toBe(resources + 1);
    expect(tweets, `sidebar order: ${hrefs.join(' | ')}`).toBe(resources + 2);
  });
});
