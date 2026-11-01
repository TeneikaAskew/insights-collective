// ABOUTME: Scratch Playwright config for the gradebook real-role run ONLY. It reuses the base config (webServer,
// ABOUTME: globalSetup, sessions) and replaces the projects with two: instructor writers, then the learner view.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const SESSIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.playwright-sessions');
const chromium = (base.projects ?? []).find((p) => p.name === 'chromium-instructor')?.use ?? {};

export default defineConfig({
  ...base,
  retries: 0,               // a retry would grade on top of the first attempt; the witness would catch it, but do not invite it
  workers: 1,
  projects: [
    { name: 'gb-instructor', use: { ...chromium, storageState: path.join(SESSIONS_DIR, 'instructor.json') }, testMatch: ['**/gradebook-roles/instructor-writers.spec.ts'] },
    { name: 'gb-learner', dependencies: ['gb-instructor'], use: { ...chromium, storageState: path.join(SESSIONS_DIR, 'member.json') }, testMatch: ['**/gradebook-roles/learner-view.spec.ts'] },
  ],
});
