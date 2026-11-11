// ABOUTME: Prevents mixed-major editors, transitive YAML reliance and drift from the reviewed browser source.
// ABOUTME: Exercises the declared graph so compatible-update installs retain the same runtime contract.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

describe('editor and workflow-parser dependency contract', () => {
  it('declares the exact Playwright version required by the existing sandbox source contracts', () => {
    expect(manifest.devDependencies['@playwright/test']).toBe('1.59.1');
    expect(lock.packages[''].devDependencies['@playwright/test']).toBe('1.59.1');
  });

  it('declares the YAML parser directly rather than relying on another tool to install it', () => {
    expect(manifest.devDependencies.yaml).toMatch(/^\^?2\./);
    expect(lock.packages[''].devDependencies.yaml).toBe(manifest.devDependencies.yaml);
    expect(YAML.parse('jobs:\n  test:\n    steps: []')).toEqual({ jobs: { test: { steps: [] } } });
  });

  it('declares the core imported by runtime extensions directly', () => {
    expect(manifest.dependencies['@tiptap/core']).toMatch(/^\^?2\./);
    expect(lock.packages[''].dependencies['@tiptap/core']).toBe(manifest.dependencies['@tiptap/core']);
  });

  it('keeps every declared and resolved TipTap package on the v2 API used by the editor', () => {
    const declared = Object.entries(manifest.dependencies).filter(([name]) => name.startsWith('@tiptap/'));
    expect(declared.length).toBeGreaterThan(20);
    for (const [name, range] of declared) {
      expect(range, name).toMatch(/^\^?2\./);
    }
    const resolved = Object.entries(lock.packages).filter(([name]) => /(?:^|\/)node_modules\/@tiptap\//.test(name));
    expect(resolved.length).toBeGreaterThanOrEqual(declared.length);
    for (const [name, pkg] of resolved) {
      expect((pkg as { version: string }).version, name).toMatch(/^2\./);
    }
  });
});
