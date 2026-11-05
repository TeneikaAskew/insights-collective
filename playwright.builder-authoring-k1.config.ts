// ABOUTME: Playwright config for the K1-ONLY builder-authoring run (T-18 copy acceptance; UNRUN). It is the unchanged lane
// ABOUTME: config (same binding checks, setup, projects, dependencies, retries 0, reporter) with ONE difference: only copy.spec.ts.
//
// Exactly BA-K1 in ba-1440, ba-768 and ba-390, first attempts only, each project depending on the one before (copiedBefore
// reads the earlier projects' records). The baseline config, specs and 18-entry inventory are not touched; rapid BA-R1 stays
// deferred in #168 and is neither run nor skipped here. Refuses unless the run adapter selected the K1 suite.
import { defineConfig } from '@playwright/test';
import base from './playwright.builder-authoring.config';

if (process.env.BA_SUITE !== 'k1') throw new Error('builder-authoring-k1 refused: BA_SUITE must be k1');

export default defineConfig({ ...base, testMatch: ['copy.spec.ts'] });
