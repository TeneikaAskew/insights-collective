// ABOUTME: Small helpers for builder-authoring specs: read the stored order through the loopback API as the signed-in
// ABOUTME: instructor (the server's truth, independent of the UI), and record wizard-created course ids privately.
import type { Page } from '@playwright/test';
import { BINDING } from './guarded-test';
import { writePrivateFile } from '../gradebook-roles/journey/private-dir.mjs';

async function token(page: Page): Promise<string> {
  const state = await page.context().storageState();
  for (const o of state.origins) for (const e of o.localStorage) {
    if (e.name === 'supabase.auth.token') return JSON.parse(e.value).access_token;
  }
  throw new Error('BA_E_NO_SESSION');
}

export async function rest(page: Page, pathAndQuery: string, init: RequestInit = {}) {
  const t = await token(page);
  const res = await fetch(`${BINDING.api.origin}/rest/v1/${pathAndQuery}`, {
    ...init, redirect: 'error',
    headers: { apikey: BINDING.anonKey, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

/** Section ids of a course in stored order. */
export async function storedSections(page: Page, course: string): Promise<string[]> {
  const r = await rest(page, `modules?select=id&course_id=eq.${course}&order=position.asc`);
  if (r.status !== 200) throw new Error(`BA_E_READ_MODULES_${r.status}`);
  return r.body.map((x: any) => x.id);
}

/** Lesson ids of a section in stored order. */
export async function storedLessons(page: Page, module: string): Promise<string[]> {
  const r = await rest(page, `content_items?select=id&module_id=eq.${module}&order=position.asc`);
  if (r.status !== 200) throw new Error(`BA_E_READ_ITEMS_${r.status}`);
  return r.body.map((x: any) => x.id);
}

/** Section titles in the order the curriculum view shows them (visible presentation only). */
export async function shownSectionTitles(page: Page): Promise<string[]> {
  return page.locator('h3:visible').filter({ hasText: /^B[AB] Section / }).allTextContents();
}

export function recordCreatedCourse(project: string, id: string) {
  writePrivateFile(process.env.BA_RUN_DIR as string, `created-${project}.txt`, `${id}\n`);
}
