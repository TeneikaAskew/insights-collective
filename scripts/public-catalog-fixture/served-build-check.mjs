#!/usr/bin/env node
// ABOUTME: PRE check that the served app at PUBLIC_ACCEPT_BASE_URL was built against THIS stack: its entry bundle must contain
// ABOUTME: PUBLIC_ACCEPT_API_URL. A build without VITE_SUPABASE_URL would fall back to the hosted project, so it is refused.
import { runGuards } from './guards.mjs';
const errors = runGuards(); if (errors.length) { for (const e of errors) console.error(e); process.exit(2); }
const base = process.env.PUBLIC_ACCEPT_BASE_URL; const api = new URL(process.env.PUBLIC_ACCEPT_API_URL).origin;
const html = await (await fetch(`${base}/`, { redirect: 'error' })).text();
const srcs = [...html.matchAll(/<script[^>]+src="(\/[^"]+\.js)"/g)].map((m) => m[1]);
if (!srcs.length) { console.error('PUBLIC_CATALOG_E_SERVED_BUILD: no same-origin entry script in index.html'); process.exit(2); }
let found = false;
for (const s of srcs) if ((await (await fetch(`${base}${s}`, { redirect: 'error' })).text()).includes(api)) found = true;
if (!found) { console.error(`PUBLIC_CATALOG_E_SERVED_BUILD: the served entry bundle does not reference ${api}`); process.exit(2); }
console.log(`served build references ${api}`);
