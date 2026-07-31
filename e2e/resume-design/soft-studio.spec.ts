// ABOUTME: Per-component E2E coverage of the Soft Studio resume page design,
// ABOUTME: driven through the fixture-backed dev preview route (/dev/soft-studio).
//
// The preview route exists only in dev builds (import.meta.env.DEV). Against a
// production preview server the whole suite skips itself rather than failing,
// so it is safe in CI (which serves `vite preview`) and fully active locally
// against `npm run dev`.
//
// Uses the shared console-error fixture. It previously opted out because the
// preview route runs without auth — but that auth noise is already covered by
// named suppressions, and opting out meant a real error on this page could not
// fail the spec.
import { test, expect } from '../fixtures/page-helpers';
import type { Page } from '@playwright/test';

const PREVIEW_PATH = '/dev/soft-studio';

async function openPreview(page: Page): Promise<boolean> {
  await page.goto(PREVIEW_PATH, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByTestId('soft-studio-preview').waitFor({ timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('Soft Studio resume page', () => {
  test.beforeEach(async ({ page }) => {
    const available = await openPreview(page);
    test.skip(!available, 'dev preview route not served (production build)');
  });

  test.describe('shell & theme', () => {
    test('applies the Soft Studio wrapper, plaster ground, and Outfit type', async ({ page }) => {
      const wrapper = page.getByTestId('soft-studio-preview');
      await expect(wrapper).toHaveClass(/ss-wash/);

      const { background, fontFamily } = await wrapper.evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, fontFamily: s.fontFamily };
      });
      expect(background).toBe('rgb(250, 248, 245)'); // #FAF8F5 plaster
      expect(fontFamily).toContain('Outfit');
    });

    test('renders the header card with title, badge, and refresh action', async ({ page }) => {
      await expect(page.getByText('Resume Analysis', { exact: true })).toBeVisible();
      await expect(page.getByText('Industry-Leading Analysis')).toBeVisible();
      await expect(page.getByRole('button', { name: /refresh data/i })).toBeVisible();
    });

    test('has no spinning loaders at idle', async ({ page }) => {
      await expect(page.locator('.animate-spin')).toHaveCount(0);
    });
  });

  test.describe('tabs', () => {
    test('shows four pill-shaped tabs with Overview active', async ({ page }) => {
      const tabs = page.getByRole('tab');
      const names = ['Overview', 'Storytelling', 'ATS Score', 'Chat'];
      for (const name of names) {
        await expect(page.getByRole('tab', { name })).toBeVisible();
      }
      const overview = page.getByRole('tab', { name: 'Overview' });
      await expect(overview).toHaveAttribute('data-state', 'active');

      const radius = await overview.evaluate((el) => getComputedStyle(el).borderRadius);
      expect(radius).toBe('9999px'); // pill
      expect(await tabs.count()).toBeGreaterThanOrEqual(4);
    });

    test('switches panels when each tab is clicked', async ({ page }) => {
      await page.getByRole('tab', { name: 'Storytelling' }).click();
      await expect(page.getByText('Resume Storytelling Analysis')).toBeVisible();

      await page.getByRole('tab', { name: 'ATS Score' }).click();
      await expect(page.getByText('ATS Compatibility Score')).toBeVisible();

      await page.getByRole('tab', { name: 'Chat' }).click();
      await expect(
        page.getByPlaceholder('Ask about your resume or career path...')
      ).toBeVisible();

      await page.getByRole('tab', { name: 'Overview' }).click();
      await expect(page.getByText('Resume Grade')).toBeVisible();
    });
  });

  test.describe('Overview tab', () => {
    test('grade card shows the letter grade, percentage, and pitch', async ({ page }) => {
      await expect(page.getByText('Resume Grade')).toBeVisible();
      await expect(page.getByText('82.82%')).toBeVisible();
      await expect(page.getByText('B', { exact: true })).toBeVisible();
      await expect(page.getByText('Elevator Pitch:')).toBeVisible();
      await expect(page.getByText(/adversarial defense, and reinforcement learning/)).toBeVisible();
    });

    test('themes and expert analysis render', async ({ page }) => {
      await expect(page.getByText('Key Improvement Themes')).toBeVisible();
      await expect(
        page.getByText('Quantify outcomes — most bullets describe activity, not results')
      ).toBeVisible();
      await expect(page.getByText('Expert Analysis:')).toBeVisible();
    });

    test('resume management card shows the uploaded file', async ({ page }) => {
      await expect(page.getByText('Your Resume', { exact: true })).toBeVisible();
      await expect(page.getByText('resume_jess_ml.pdf')).toBeVisible();
      await expect(page.getByText('Resume Preview')).toBeVisible();
    });

    test('key insights rows render with soft semantic markers', async ({ page }) => {
      await expect(page.getByText('Key Insights')).toBeVisible();
      await expect(page.getByText('STRONGEST POINT', { exact: true })).toBeVisible();
      await expect(page.getByText('NEEDS IMPROVEMENT', { exact: true })).toBeVisible();
      await expect(page.getByText('INDUSTRY ALIGNMENT', { exact: true })).toBeVisible();
      await expect(page.getByText('STORYTELLING QUALITY', { exact: true })).toBeVisible();
    });

    test('career chat CTA is calm (no flashing) and switches to the Chat tab', async ({ page }) => {
      const cta = page.getByRole('button', { name: /start career chat/i });
      await expect(cta).toBeVisible();

      // Calm CTA: class must be stable over > 2 flash periods of the old design
      const before = await cta.getAttribute('class');
      await page.waitForTimeout(2200);
      expect(await cta.getAttribute('class')).toBe(before);

      await cta.click();
      await expect(page.getByRole('tab', { name: 'Chat' })).toHaveAttribute('data-state', 'active');
      await expect(
        page.getByPlaceholder('Ask about your resume or career path...')
      ).toBeVisible();
    });
  });

  test.describe('Storytelling tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Storytelling' }).click();
    });

    test('stat tiles compute from fixture bullets', async ({ page }) => {
      await expect(page.getByText('Total Bullets')).toBeVisible();
      await expect(page.getByText('12', { exact: true })).toBeVisible();
      await expect(page.getByText('XYZ Average')).toBeVisible();
      await expect(page.getByText('76%', { exact: true })).toBeVisible();
      await expect(page.getByText('Balance Rating')).toBeVisible();
      await expect(page.getByText('81%', { exact: true })).toBeVisible();
      await expect(page.getByText('Strong Points')).toBeVisible();
      await expect(page.getByText('Need Work')).toBeVisible();
    });

    test('impact view shows the bullet selector, highlighted original, and donut chart', async ({ page }) => {
      await expect(page.getByText('Select a bullet point:')).toBeVisible();
      await expect(page.getByText('Original Bullet')).toBeVisible();
      // recharts renders an SVG pie; the center overlay carries the score label
      await expect(page.getByText('Story Score')).toBeVisible();
      await expect(page.locator('.recharts-pie')).toHaveCount(1);
    });

    test('analysis view shows word balance and XYZ quality breakdowns', async ({ page }) => {
      await page.getByRole('tab', { name: 'Analysis' }).click();
      await expect(page.getByText(/Word Balance Score:/)).toBeVisible();
      await expect(page.getByText(/XYZ Quality Score:/)).toBeVisible();
      await expect(page.getByText('Word Balance', { exact: true })).toBeVisible();
      await expect(page.getByText('XYZ Quality', { exact: true })).toBeVisible();
    });

    test('improve view shows the AI improved version and tips', async ({ page }) => {
      await page.getByRole('tab', { name: 'Improve' }).click();
      await expect(page.getByText('AI Improved Version')).toBeVisible();
      await expect(page.getByText(/91% to 99\.2%/)).toBeVisible();
      await expect(page.getByText('Improvement Tips')).toBeVisible();
      await expect(page.getByRole('button', { name: /edit bullet point/i })).toBeVisible();
    });

    test('all-bullets view lists every bullet with a score badge', async ({ page }) => {
      await page.getByRole('tab', { name: 'All' }).click();
      await expect(page.getByText('All Bullet Points (12)')).toBeVisible();
      await expect(page.getByText(/Score: \d+\/100/).first()).toBeVisible();
    });
  });

  test.describe('ATS Score tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'ATS Score' }).click();
    });

    test('shows the derived ATS score and sub-scores', async ({ page }) => {
      await expect(page.getByText('92.82%')).toBeVisible(); // 82.82 + 10
      await expect(page.getByText('Keyword Match')).toBeVisible();
      await expect(page.getByText('84%', { exact: true })).toBeVisible();
      await expect(page.getByText('Format Detection')).toBeVisible();
      await expect(page.getByText('85%', { exact: true })).toBeVisible();
      await expect(page.getByText('Readability')).toBeVisible();
      await expect(page.getByText('88%', { exact: true })).toBeVisible();
    });

    test('lists six ATS checks with impact chips and pass rate', async ({ page }) => {
      await expect(page.getByText(/ATS Checks \(83% Pass Rate\)/)).toBeVisible();
      await expect(page.getByText('Contains relevant industry keywords')).toBeVisible();
      await expect(page.getByText('Skills section matches job requirements')).toBeVisible();
      await expect(page.getByText('Critical')).toBeVisible();
      expect(await page.getByText('High', { exact: true }).count()).toBe(3);
      expect(await page.getByText('Medium', { exact: true }).count()).toBe(2);
    });

    test('pro tip and job-specific analyzer are reachable', async ({ page }) => {
      await expect(page.getByText(/Pro Tip:/)).toBeVisible();
      await page.getByRole('tab', { name: 'Job-Specific Analysis' }).click();
      await expect(page.getByPlaceholder(/paste the job description here/i)).toBeVisible();
    });
  });

  test.describe('Chat tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Chat' }).click();
    });

    test('greets with the analyzed grade or the ready-for-review fallback', async ({ page }) => {
      // The personalized welcome (with the grade) requires a signed-in user;
      // the unauthenticated preview shows the ready-for-review fallback copy.
      await expect(page.getByText(/82\.82|ready for review/i).first()).toBeVisible();
    });

    test('opening the chat tab does not scroll the page', async ({ page }) => {
      // Regression guard: the chat's auto-scroll must move only its own
      // viewport, never the document (previously scrollIntoView yanked the
      // page to the bottom when the tab mounted).
      await page.waitForTimeout(600); // let smooth-scroll settle if it fires
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('composer accepts input and enables send', async ({ page }) => {
      const composer = page.getByPlaceholder('Ask about your resume or career path...');
      const send = page.getByRole('button', { name: /send/i });

      await expect(send).toBeDisabled();
      await composer.fill('How do I quantify the CAPTURE work?');
      await expect(send).toBeEnabled();
    });
  });
});
