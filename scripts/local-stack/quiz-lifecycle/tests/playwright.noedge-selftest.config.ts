// ABOUTME: Runs ONLY the no-Edge guard self-test, with exactly the mode's own `use` options (browser args, service-worker block)
// ABOUTME: imported from playwright.quiz-lifecycle.config.ts, so what is proven here is what the mode launches with.
import { defineConfig } from '@playwright/test';
import mode from '../../../../playwright.quiz-lifecycle.config';

export default defineConfig({
  ...mode,
  testDir: '.',
  testMatch: ['noedge.selftest.ts'],
  reporter: [['list']],
  outputDir: `${process.env.QLC_EVIDENCE_DIR}/noedge-selftest-output`,
});
