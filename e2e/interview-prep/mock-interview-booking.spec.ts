// ABOUTME: End-to-end proof of the mock-interview booking flow: both users set
// ABOUTME: availability, one books the other, and BOTH see the upcoming session.
//
// The flow this validates, in order, with a screenshot at every step (written
// to e2e/screenshots/mock-interview-booking/ — run artifacts, not baselines):
//
//   1. The member starts with no availability and sees the "set your
//      availability first" nudge on Find Sessions.
//   2. The member sets availability through the real UI (day chip → Add time →
//      Save) — the first-time save path, where availability_slots holds no rows.
//   3. The partner (the journeys account) sets availability through the same
//      UI in their own browser context.
//   4. The member picks tomorrow + the shared slot on Find Sessions and the
//      partner appears under Available Users — proof the find_available_peers
//      matching works.
//   5. The member books; the session lands in Upcoming Sessions.
//   6. The partner's own Upcoming Sessions shows the same session — proof the
//      booking is visible to both participants, not just the booker.
//
// Two accounts are involved: the shared member (this project's storageState)
// and the journeys account, whose storage state global-setup already saves.
// The partner's pages run in a hand-built context, which the console-error
// fixture cannot instrument (its listeners attach to the injected `page`
// only) — the member's pages, where every mutation happens first, stay fully
// instrumented.
//
// Run it: npm run e2e:relay -- e2e/interview-prep/mock-interview-booking.spec.ts --project=chromium-member

import * as fs from 'fs';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { test, expect, goto, clickTab } from '../fixtures/page-helpers';
import { Routes } from '../helpers/route-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://siuqvhscuiycvdrtiqsh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w';
// Optional. mock_sessions has no DELETE policy (participants may only cancel),
// so removing the booked row outright needs service role; without it, cleanup
// cancels the session instead, which keeps it out of Upcoming Sessions.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SHOTS = path.join(process.cwd(), 'e2e', 'screenshots', 'mock-interview-booking');
const SESSIONS_DIR = path.join(process.cwd(), '.playwright-sessions');

const MEMBER = {
  email: process.env.E2E_MEMBER_EMAIL || 'e2e-member@insightscollective.org',
  password: process.env.E2E_MEMBER_PASSWORD || process.env.E2E_TEST_PASSWORD || '',
};
const PARTNER = {
  email: process.env.E2E_JOURNEYS_EMAIL || 'e2e-journeys@insightscollective.org',
  password: process.env.E2E_JOURNEYS_PASSWORD || process.env.E2E_TEST_PASSWORD || '',
};
// First/last name the seed gives the journeys profile — what Available Users renders.
const PARTNER_NAME = 'E2E Journeys';

// slot_8_9 is what "Add time" inserts by default (the first block not already
// selected), so the availability UI needs no dropdown driving.
const SLOT_ID = 'slot_8_9';
const SLOT_RANGE = '8:00 AM - 9:00 AM';

// Tomorrow: always selectable (the calendar only disables past dates), and
// computed once so every step agrees on the weekday even across midnight.
const TARGET_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
})();
const DAY_CHIP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][TARGET_DATE.getDay()];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
  TARGET_DATE.getDay()
];
// Matches the session card's date-fns format 'MMMM d, yyyy' (e.g. "August 28, 2026").
const DATE_LONG = TARGET_DATE.toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

interface ApiSession {
  access_token: string;
  user: { id: string };
}

async function signIn(email: string, password: string): Promise<ApiSession> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

function userHeaders(token: string): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function rest(pathAndQuery: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, init);
  if (!res.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${pathAndQuery} → ${res.status} ${(await res.text()).slice(0, 300)}`,
    );
  }
  return res;
}

let member: ApiSession;
let partner: ApiSession;

// Every mock session between exactly these two accounts, either direction.
function pairFilter(): string {
  const m = member.user.id;
  const p = partner.user.id;
  return `or=(and(user1_id.eq.${m},user2_id.eq.${p}),and(user1_id.eq.${p},user2_id.eq.${m}))`;
}

// Remove (or, without service role, cancel) pair sessions and both users'
// availability rows, so each run starts from the clean slate the assertions
// assume and leaves nothing behind for other specs to trip on.
async function wipePairState(): Promise<void> {
  if (SERVICE_ROLE_KEY) {
    await rest(`mock_sessions?${pairFilter()}`, { method: 'DELETE', headers: serviceHeaders() });
  } else {
    await rest(`mock_sessions?${pairFilter()}&status=eq.scheduled`, {
      method: 'PATCH',
      headers: userHeaders(member.access_token),
      body: JSON.stringify({ status: 'canceled' }),
    });
  }
  for (const who of [member, partner]) {
    await rest(`availability_slots?user_id=eq.${who.user.id}`, {
      method: 'DELETE',
      headers: userHeaders(who.access_token),
    });
  }
}

/** Click a day in the shadcn Calendar, paging forward one month if needed. */
async function pickTargetDate(page: Page): Promise<void> {
  if (TARGET_DATE.getMonth() !== new Date().getMonth()) {
    await page.getByRole('button', { name: 'Go to the Next Month' }).click();
  }
  await page
    .locator('[role="gridcell"]:not([data-outside]) button')
    .filter({ hasText: new RegExp(`^${TARGET_DATE.getDate()}$`) })
    .filter({ visible: true })
    .first()
    .click();
}

/**
 * Drive the Set Availability tab: activate the target weekday, add the default
 * time block (slot_8_9), save, and confirm the success toast. Works for either
 * account — both start the run with zero availability rows.
 */
async function setAvailabilityViaUi(page: Page): Promise<void> {
  await clickTab(page, 'Set Availability');
  await expect(page.getByText('Available days')).toBeVisible();

  await page.getByText(DAY_CHIP, { exact: true }).click();
  // Activating the day opens its hours box, titled with the full day name.
  await expect(page.getByRole('heading', { name: DAY_FULL })).toBeVisible();
  await page.getByRole('button', { name: 'Add time' }).click();
  // "Add time" inserts the first free block — slot_8_9, rendered as 8:00 AM → 9:00 AM.
  await expect(page.getByText('8:00 AM').first()).toBeVisible();

  await page.getByRole('button', { name: 'Save Availability' }).click();
  // .first(): toast text renders twice — the visible toast and its aria-live
  // status mirror.
  await expect(page.getByText('Your availability has been saved.').first()).toBeVisible();
}

test.describe.serial('Mock interview booking — both users', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    member = await signIn(MEMBER.email, MEMBER.password);
    partner = await signIn(PARTNER.email, PARTNER.password);
    await wipePairState();
  });

  test.afterAll(async () => {
    if (member && partner) await wipePairState();
  });

  test('member starts with no availability and is nudged to set it', async ({ page }) => {
    await goto(page, Routes.mockInterviews);
    await expect(
      page.getByText('Please set your availability first to help others find matching times.'),
    ).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '01-member-no-availability-nudge.png'), fullPage: true });
  });

  test('member sets availability through the UI (first-time save)', async ({ page }) => {
    await goto(page, Routes.mockInterviews);
    await setAvailabilityViaUi(page);
    await page.screenshot({ path: path.join(SHOTS, '02-member-availability-saved.png'), fullPage: true });

    // The nudge on Find Sessions is gone now that availability exists.
    await clickTab(page, 'Find Sessions');
    await expect(
      page.getByText('Please set your availability first to help others find matching times.'),
    ).toHaveCount(0);
  });

  test('partner sets availability through the UI in their own session', async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    // The journeys account's saved storage state — a second signed-in user.
    const context = await browser.newContext({
      storageState: path.join(SESSIONS_DIR, 'journeys.json'),
      baseURL: baseURL!,
    });
    try {
      const page = await context.newPage();
      await goto(page, Routes.mockInterviews);
      await setAvailabilityViaUi(page);
      await page.screenshot({ path: path.join(SHOTS, '03-partner-availability-saved.png'), fullPage: true });
    } finally {
      await context.close();
    }
  });

  test('member finds the partner and books the session', async ({ page }) => {
    test.setTimeout(60_000);
    await goto(page, Routes.mockInterviews);

    await pickTargetDate(page);
    await page.locator(`label[for="time-${SLOT_ID}"]`).click();

    // The partner is the one peer with availability for this weekday+slot, so
    // find_available_peers must surface them — with their profile name.
    await expect(page.getByText(PARTNER_NAME).first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '04-member-partner-available.png'), fullPage: true });

    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    // Booking survives the video-link step either way (Zoom or the Jitsi
    // fallback), but the success toast only fires when the link also persisted
    // to the row the partner will read — which is what "it works" means here.
    await expect(
      page.getByText('Mock interview session scheduled successfully.').first(),
    ).toBeVisible({ timeout: 20_000 });

    // The booking shows up immediately in the Upcoming Sessions rail.
    const upcoming = page.locator('.ss-card', { hasText: 'Upcoming Sessions' });
    await expect(upcoming.getByText(DATE_LONG).first()).toBeVisible();
    await expect(upcoming.getByText(SLOT_RANGE).first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '05-member-booking-confirmed.png'), fullPage: true });
  });

  test('member sees the session under Upcoming Sessions', async ({ page }) => {
    await goto(page, Routes.mockInterviews);
    await clickTab(page, 'Upcoming Sessions');

    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel.getByText(DATE_LONG).first()).toBeVisible();
    await expect(panel.getByText(SLOT_RANGE).first()).toBeVisible();
    await expect(panel.getByText(/You are the (Interviewer|Interviewee)/).first()).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Join video call' }).first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, '06-member-upcoming-session.png'), fullPage: true });
  });

  test('partner sees the same session in their Upcoming Sessions', async ({ browser, baseURL }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      storageState: path.join(SESSIONS_DIR, 'journeys.json'),
      baseURL: baseURL!,
    });
    try {
      const page = await context.newPage();
      await goto(page, Routes.mockInterviews);
      await clickTab(page, 'Upcoming Sessions');

      const panel = page.locator('[role="tabpanel"]:visible');
      await expect(panel.getByText(DATE_LONG).first()).toBeVisible();
      await expect(panel.getByText(SLOT_RANGE).first()).toBeVisible();
      await expect(panel.getByText(/You are the (Interviewer|Interviewee)/).first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, '07-partner-upcoming-session.png'), fullPage: true });
    } finally {
      await context.close();
    }
  });
});
