// ABOUTME: General coverage for the signed-out home page — every section mounts,
// ABOUTME: the quiz completes, and the footer's links go where they claim.
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/page-helpers';
import { goto } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

/**
 * The sibling index.spec.ts checks that *something* rendered — a heading, a
 * title, a login link. This spec is about the page Index.tsx actually composes:
 * twelve sections, two of them held out of the DOM until they scroll into view.
 *
 * Index redirects an authenticated visitor to /dashboard, so every test here is
 * signed out by construction; chromium-public claims e2e/landing/**.
 */

type Section = {
  /** What this section has to put on the page to count as rendered. */
  assert: (section: Locator) => Promise<void>;
  /**
   * Renders `null` when its query comes back empty, by deliberate choice in the
   * component — so "absent" is a legitimate state here and only the populated
   * form can be asserted. Without this distinction the spec passes or fails on
   * how much data the environment happens to hold.
   */
  dataDependent?: true;
};

/**
 * Section ids in Index.tsx's `sections` array, in order, each mapped to the
 * content that section exists to show. Each id is the `data-tour` attribute on
 * that section's wrapper.
 *
 * Asserting real content rather than "some text": a section that renders its
 * frame and no content is exactly the regression worth catching, and a
 * text-length check passes on a stray heading.
 *
 * Hard-coded rather than derived from the DOM so that a section added to Index
 * without coverage fails the accounting test below, instead of silently
 * widening a `[data-tour]` query that would still pass.
 */
const SECTIONS: Record<string, Section> = {
  hero: {
    // The headline ends in <RotatingWords />, which cycles, so only the fixed
    // half of it can be matched.
    assert: async (s) => {
      await expect(s.getByRole('heading', { level: 1 })).toContainText(/Accelerate Your/i);
      await expect(s.locator('a[href="/register"]').first()).toBeVisible();
    },
  },
  quiz: {
    assert: async (s) => {
      await expect(s.getByRole('button', { name: /Take the Career Quiz/i })).toBeVisible();
    },
  },
  personalizedPathway: {
    assert: async (s) => {
      for (const card of ['Skill Assessment', 'Career Mapping', 'Progress Tracking']) {
        await expect(s.getByText(card, { exact: true }).first()).toBeVisible();
      }
    },
  },
  interactiveShowcase: {
    assert: async (s) => {
      for (const tab of ['Skills', 'Growth', 'Pay']) {
        await expect(s.getByRole('tab', { name: tab })).toBeVisible();
      }
      // A tab strip over a chart that never drew is still a broken section.
      await expect(s.locator('.recharts-surface').first()).toBeVisible();
    },
  },
  features: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Why Choose Insights Collective/i })).toBeVisible();
    },
  },
  journey: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Your Data Science Learning Journey/i })).toBeVisible();
    },
  },
  courses: {
    dataDependent: true,
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Featured Courses/i })).toBeVisible();
      // A heading over an empty grid is the state FeaturedCourses returns null
      // to avoid; if the heading is here, the cards have to be too.
      await expect(s.locator('a[href^="/courses/"]').first()).toBeVisible();
      await expect(s.locator('a[href="/courses"]').first()).toBeVisible();
    },
  },
  tools: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Explore Our Data Science Learning Tools/i })).toBeVisible();
    },
  },
  analytics: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Powerful Analytics/i })).toBeVisible();
      // No chart here, deliberately: LearningProgressChart plots the *signed-in*
      // user's enrollments, and every visitor to this page is signed out. What a
      // visitor gets is the prompt to enrol, and asserting a `.recharts-surface`
      // here failed for that reason.
      await expect(s.getByText(/Enroll in courses to see your progress/i)).toBeVisible();
    },
  },
  communityShowcase: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Learn Together, Grow Together/i })).toBeVisible();
      for (const pillar of ['Discussion Forums', 'Study Groups']) {
        await expect(s.getByText(pillar, { exact: true }).first()).toBeVisible();
      }
    },
  },
  events: {
    dataDependent: true,
    assert: async (s) => {
      await expect(s.locator('a[href^="/events/"]').first()).toBeVisible();
    },
  },
  cta: {
    assert: async (s) => {
      await expect(s.getByRole('heading', { name: /Ready to Start Learning/i })).toBeVisible();
    },
  },
};

/**
 * The two sections Index holds back with `deferUntilVisible`. Until they scroll
 * into view their wrapper holds a `min-h-[50vh]` aria-hidden spacer, which is
 * why every assertion below is about *text*: an emptiness check would pass on
 * the spacer and report a section that never mounted as healthy.
 */
const DEFERRED = ['interactiveShowcase', 'analytics'];

/**
 * Scroll a section into view and hand back its wrapper.
 *
 * QuizSection and HeroSection carry their own `data-tour` for the onboarding
 * tour, nested inside Index's wrapper for the same id. The outer element comes
 * first in DOM order and is the one that holds the whole section.
 */
async function reveal(page: Page, id: string): Promise<Locator> {
  const section = page.locator(`[data-tour="${id}"]`).first();
  await section.scrollIntoViewIfNeeded();
  return section;
}

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.landing);
  });

  for (const [id, { assert, dataDependent }] of Object.entries(SECTIONS)) {
    if (dataDependent) {
      test(`${id} renders its content whenever it has data`, async ({ page }) => {
        const section = await reveal(page, id);
        // The query has to settle before "empty" means anything. Read straight
        // after scrolling and a section whose fetch is still in flight looks
        // identical to one with no rows — measured: both of these skipped on a
        // database that does hold courses and events.
        await page.waitForLoadState('networkidle');

        // Past that point empty is a real state, not a pending one: both
        // components return null rather than head an empty grid. So assert the
        // populated form only when there is something to populate it, and say
        // which of the two happened instead of quietly passing.
        const rendered = (await section.innerText()).trim().length > 0;
        test.skip(!rendered, `${id} has no data in this environment; nothing was asserted`);
        await assert(section);
      });
      continue;
    }

    test(`${id} renders its content`, async ({ page }) => {
      await assert(await reveal(page, id));
    });
  }

  test('every section on the page is accounted for', async ({ page }) => {
    // A section added to Index without a row in SECTIONS would go untested
    // while this file still passed, which is the gap this closes.
    const rendered = await page.locator('[data-tour]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-tour') ?? ''),
    );
    // `data-tour` is also used by onboarding targets inside sections, so this
    // asserts containment rather than equality.
    for (const id of Object.keys(SECTIONS)) {
      expect(rendered, `"${id}" is covered here but no longer renders on the page`).toContain(id);
    }
  });

  test('deferred sections stay out of the DOM until scrolled to', async ({ page }) => {
    // Waiting for the network to go quiet is what gives this test its teeth.
    // Checking immediately after load only proves the section had not rendered
    // *yet*, which is equally true of a plain React.lazy section whose chunk is
    // still in flight — measured: with `deferUntilVisible` removed from Index
    // this test still passed. Once the page is idle a merely-lazy section has
    // resolved and filled in, and only a deferred one is still empty.
    await page.waitForLoadState('networkidle');

    for (const id of DEFERRED) {
      const initial = (await page.locator(`[data-tour="${id}"]`).first().innerText()).trim();
      expect(
        initial,
        `"${id}" rendered without being scrolled to; it is no longer held back by deferUntilVisible`,
      ).toBe('');
    }
    for (const id of DEFERRED) {
      const section = await reveal(page, id);
      await expect
        .poll(async () => (await section.innerText()).trim().length, { timeout: 15_000 })
        .toBeGreaterThan(0);
    }
  });

  test('the career quiz can be answered end to end', async ({ page }) => {
    await reveal(page, 'quiz');
    await page.getByRole('button', { name: /Take the Career Quiz/i }).click();

    const progress = page.getByText(/Question \d+ of \d+/);
    await expect(progress).toBeVisible();
    const total = Number((await progress.innerText()).match(/of (\d+)/)![1]);
    expect(total).toBeGreaterThan(0);

    for (let answered = 0; answered < total; answered++) {
      // Scale and multiple-choice questions render the same shape: one labelled
      // row per option inside the group.
      const options = page.locator('[role="radiogroup"] label').filter({ visible: true });
      await expect(options.first()).toBeVisible();
      await options.first().click();

      const advance = page.getByRole('button', { name: /^(Next|See Results)/ });
      await expect(advance).toBeEnabled();
      await advance.click();
    }

    await expect(page.getByRole('heading', { name: /Your Career Path Results/i })).toBeVisible();
  });

  test('the quiz will not advance past an unanswered question', async ({ page }) => {
    await reveal(page, 'quiz');
    await page.getByRole('button', { name: /Take the Career Quiz/i }).click();

    await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
  });

  test('footer quick links reach the pages they name', async ({ page }) => {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    for (const [name, path] of [
      ['Courses', '/courses'],
      ['Resources', '/resources'],
      ['Sign Up', '/register'],
      ['Sign In', '/login'],
    ] as const) {
      await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', path);
    }

    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
    await expect(footer.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms-of-service',
    );
  });

  test('footer carries no placeholder contact details', async ({ page }) => {
    // "info@ic.tech" and "(123) 456-7890" shipped here as scaffolding. A visitor
    // who mails or calls them reaches nobody, so their absence is asserted
    // rather than left to a future reviewer noticing.
    const footer = await page.locator('footer').innerText();
    expect(footer).not.toMatch(/info@ic\.tech/i);
    expect(footer).not.toMatch(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  });

  test('the hero sends a new visitor to register', async ({ page }) => {
    const hero = await reveal(page, 'hero');
    await expect(hero.getByRole('link', { name: /get started|sign up|start/i }).first()).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
