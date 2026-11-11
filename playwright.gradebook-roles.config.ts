// ABOUTME: Scratch Playwright config for the gradebook real-role run ONLY. Strict local binding is asserted when this file
// ABOUTME: loads, before any setup. It does NOT inherit the base config's globalSetup/globalTeardown (which sweep and delete
// ABOUTME: rows and bootstrap passwords) nor its webServer: the app must already be served on E2E_BASE_URL (run.sh / job).
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { chromiumExecutableOption } from './e2e/support/chromium-executable';
import { assertStrictLocalBinding } from './e2e/gradebook-roles/local-binding.mjs';

const { app } = assertStrictLocalBinding();          // throws before Playwright runs any setup
const SESSIONS = path.join(process.cwd(), '.playwright-sessions', 'gradebook-roles');
const chromium = { ...devices['Desktop Chrome'], baseURL: app.origin, launchOptions: chromiumExecutableOption(), screenshot: 'off' as const, trace: 'off' as const, serviceWorkers: 'block' as const };

// GB_LANE selects ONE lane per run. Unset or 'grading' = the qualified db3ba0a grading fixture, unchanged. 'journey' =
// the no-quiz authentic UI journey proposal (UNRUN): its own setup (gates 1 and 3 before any sign-in) and its sessions in
// the private GB_SESSION_DIR, never in the repository. Anything else refuses.
const LANE = process.env.GB_LANE ?? 'grading';
if (LANE !== 'grading' && LANE !== 'journey') throw new Error('gradebook-roles refused: GB_LANE must be grading or journey');
const JDIR = process.env.GB_SESSION_DIR ?? '';
if (LANE === 'journey' && !path.isAbsolute(JDIR)) throw new Error('gradebook-roles refused: the journey lane needs an absolute private GB_SESSION_DIR');
const jstate = (role: 'instructor' | 'member') => path.join(JDIR, `${role}.json`);
const GRADING_PROJECTS = [
  { name: 'gb-instructor', use: { ...chromium, storageState: path.join(SESSIONS, 'instructor.json') }, testMatch: ['instructor-writers.spec.ts'] },
  { name: 'gb-learner', dependencies: ['gb-instructor'], use: { ...chromium, storageState: path.join(SESSIONS, 'member.json') }, testMatch: ['learner-view.spec.ts'] },
];
// One persona per project, chained so the journey runs in order: J0 learner (draft) -> J1 instructor publish ->
// J2 learner enroll/read/upload/submit -> J3 instructor download/grade -> J4 learner readback/progress/certificate.
const JOURNEY_PROJECTS = [
  { name: 'jr-0-learner-draft', use: { ...chromium, storageState: jstate('member') }, testMatch: ['journey/j0-learner-before-publish.spec.ts'] },
  { name: 'jr-1-instructor-publish', dependencies: ['jr-0-learner-draft'], use: { ...chromium, storageState: jstate('instructor') }, testMatch: ['journey/j1-instructor-publish.spec.ts'] },
  { name: 'jr-2-learner-submit', dependencies: ['jr-1-instructor-publish'], use: { ...chromium, storageState: jstate('member'), acceptDownloads: true }, testMatch: ['journey/j2-learner-enroll-submit.spec.ts'] },
  { name: 'jr-3-instructor-grade', dependencies: ['jr-2-learner-submit'], use: { ...chromium, storageState: jstate('instructor'), acceptDownloads: true }, testMatch: ['journey/j3-instructor-grade.spec.ts'] },
  { name: 'jr-4-learner-readback', dependencies: ['jr-3-instructor-grade'], use: { ...chromium, storageState: jstate('member'), acceptDownloads: true }, testMatch: ['journey/j4-learner-readback-certificate.spec.ts'] },
];

export default defineConfig({
  testDir: './e2e/gradebook-roles',
  globalSetup: LANE === 'journey' ? './e2e/gradebook-roles/journey/session-setup.ts' : './e2e/gradebook-roles/session-setup.ts',
  // no globalTeardown, no webServer: nothing outside the fixture is touched
  fullyParallel: false,
  retries: 0,               // a retry would grade on top of the first attempt
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: LANE === 'journey' ? 'playwright-report-gradebook-journey' : 'playwright-report-gradebook-roles' }]],
  projects: LANE === 'journey' ? JOURNEY_PROJECTS : GRADING_PROJECTS,
});
