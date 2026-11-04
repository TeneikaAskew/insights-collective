// ABOUTME: Runs ONLY the journey lane's mocked unit characterization (feedback-render.test.tsx) with the repo's own vitest
// ABOUTME: setup. The base config includes src/** only and excludes e2e/**, so this narrow override is needed. No network.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import base from '../../../vitest.config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// mergeConfig would CONCATENATE include arrays (and so run the whole src suite); replace test.include outright instead.
export default defineConfig({
  ...base,
  root,
  test: {
    ...(base as any).test,
    include: ['e2e/gradebook-roles/journey/feedback-render.test.tsx'],
    exclude: ['node_modules/**'],
    coverage: { enabled: false },
  },
});
