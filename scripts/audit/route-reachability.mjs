#!/usr/bin/env node
// ABOUTME: Maps every src/ module to the routes that can reach it, via App.tsx.
// ABOUTME: Turns "this query is broken" into "this query is broken on THIS page".
//
// Without this, a broken query in dead code (the forum pages redirect to
// /dashboard; two CodePractice/MockInterviews components are lazy-imported but
// never routed) looks exactly as urgent as one on a page users load daily.

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');
const APP = path.join(SRC, 'App.tsx');
const app = fs.readFileSync(APP, 'utf8');

/** lazy/static import identifier → module path, from App.tsx. */
const componentModule = new Map();
for (const m of app.matchAll(/(?:const|let)\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g)) {
  componentModule.set(m[1], m[2]);
}
for (const m of app.matchAll(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm)) {
  componentModule.set(m[1], m[2]);
}

/** route path → component identifier. Redirect targets are recorded separately. */
const routes = [];
for (const m of app.matchAll(/<Route\s+path=["']([^"']+)["']\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
  const [, routePath, element] = m;
  const isRedirect = /<Navigate\b/.test(element);
  const ids = [...element.matchAll(/<(\w+)/g)].map((x) => x[1]);
  routes.push({ path: routePath, isRedirect, components: ids });
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;                                     // node_modules
  for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/** Transitive module closure from an entry file, following local imports. */
function closure(entryFile) {
  const seen = new Set();
  const stack = [entryFile];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const resolved = resolveImport(m[1], file);
      if (resolved) stack.push(resolved);
    }
    for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const resolved = resolveImport(m[1], file);
      if (resolved) stack.push(resolved);
    }
  }
  return seen;
}

// module (repo-relative) → set of routes that reach it
const reach = new Map();
for (const route of routes) {
  if (route.isRedirect) continue;                       // renders nothing itself
  for (const id of route.components) {
    const spec = componentModule.get(id);
    if (!spec) continue;
    const entry = resolveImport(spec, APP);
    if (!entry) continue;
    for (const file of closure(entry)) {
      const rel = path.relative(process.cwd(), file);
      if (!reach.has(rel)) reach.set(rel, new Set());
      reach.get(rel).add(route.path);
    }
  }
}

const out = {
  routes: routes.map((r) => ({ path: r.path, redirect: r.isRedirect, components: r.components })),
  reachable: Object.fromEntries([...reach].map(([f, rs]) => [f, [...rs].sort()])),
};
fs.mkdirSync('.e2e-audit', { recursive: true });
fs.writeFileSync('.e2e-audit/route-reachability.json', JSON.stringify(out, null, 2));

console.log(`routes           : ${routes.length} (${routes.filter((r) => r.isRedirect).length} redirects)`);
console.log(`reachable modules: ${reach.size}`);
console.log('→ .e2e-audit/route-reachability.json');
