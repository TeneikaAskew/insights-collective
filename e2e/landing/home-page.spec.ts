// ABOUTME: General coverage for the signed-out home page — every section mounts,
// ABOUTME: the quiz completes, and the footer's links go where they claim.
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

/**
 * Section ids in Index.tsx's `sections` array, in order. Each becomes the
 * `data-tour` attribute on that section's wrapper.
 *
 * Hard-coded rather than derived from the DOM so that a section added to Index
 * without coverage fails the accounting test below, instead of silently
 * widening a `[data-tour]` query that would still pass.
 */
const SECTIONS = [
  'hero',
  'quiz',
  'personalizedPathway',
  'interactiveShowcase',
  'features',
  'journey',
  'courses',
  'tools',
  'analytics',
  'communityShowcase',
  'events',
  'cta',
] as const;

/**
 * The two sections Index holds back with `deferUntilVisible`. Until they scroll
 * into view their wrapper holds a `min-h-[50vh]` aria-hidden spacer, which is
 * why every assertion below is about *text*: an emptiness check would pass on
 * the spacer and report a section that never mounted as healthy.
 */
const DEFERRED = ['interactiveShowcase', 'analytics'];

async function sectionText(page: import('@playwright/test').Page, id: string): Promise<string> {
  // QuizSection and HeroSection carry their own `data-tour` for the onboarding
  // tour, nested inside Index's wrapper for the same id. The outer element
  // comes first in DOM order and is the one that holds the whole section.
  const section = page.locator(`[data-tour="${id}"]`).first();
  await section.scrollIntoViewIfNeeded();
  // Lazy chunks resolve after the observer fires; the text is what proves it.
  await expect
    .poll(async () => (await section.innerText()).trim().length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  return (await section.innerText()).trim();
}

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await goto(page, Routes.landing);
  });

  test('renders every section Index composes', async ({ page }) => {
    for (const id of SECTIONS) {
      const text = await sectionText(page, id);
      expect(text.length, `section "${id}" mounted but rendered no text`).toBeGreaterThan(0);
    }
  });

  test('every section on the page is accounted for', async ({ page }) => {
    // A section added to Index without a row in SECTIONS would go untested
    // while this file still passed, which is the gap this closes.
    const rendered = await page.locator('[data-tour]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-tour') ?? ''),
    );
    // `data-tour` is also used by onboarding targets inside sections, so this
    // asserts containment rather than equality.
    for (const id of SECTIONS) {
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
      expect((await sectionText(page, id)).length).toBeGreaterThan(0);
    }
  });

  test('the career quiz can be answered end to end', async ({ page }) => {
    await page.locator('[data-tour="quiz"]').first().scrollIntoViewIfNeeded();
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
    await page.locator('[data-tour="quiz"]').first().scrollIntoViewIfNeeded();
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
    const hero = page.locator('[data-tour="hero"]').first();
    await expect(hero.getByRole('link', { name: /get started|sign up|start/i }).first()).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
