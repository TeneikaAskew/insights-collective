import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Playwright specs live in e2e/ and must not run under vitest — without
    // this exclude `npm run test` reports 90+ bogus failures.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      // json-summary produces coverage/coverage-summary.json, which the CI
      // threshold step and PR coverage comment both read.
      reporter: ['text', 'json', 'json-summary', 'html'],
      // Only measure the app source vitest can actually execute — Deno edge
      // functions and Playwright specs would count as permanent 0% noise.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'src/main.tsx',
        'supabase/**',
        'e2e/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});