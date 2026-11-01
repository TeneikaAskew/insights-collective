#!/usr/bin/env node
// ABOUTME: Real-browser control for case-diagnostics.mjs: routed synthetic pages and API responses (no network, no stack).
// ABOUTME: H1 page ("Course not found" + courses 406 PGRST116) vs mounted-player control, plus a leak control. Exit 0 only if all pass.
//
// Usage: node scripts/local-stack/quiz-lifecycle/tests/case-diagnostics.selftest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createCaseRecorder, captureCaseFailure } from '../case-diagnostics.mjs';

const APP = 'http://127.0.0.1:18080';
const API = 'http://127.0.0.1:15432';
const C = '9c000000-0000-4000-8000-000000000001';
const M = '9c000000-0000-4000-8000-000000000002';
const I = '9c001001-0000-4000-8000-000000000000';
const SECRETS = [C, M, I, 'learner@example.com', 'sk_live_TOKEN_abc', 'Bearer', 'QLC secret title', 'two plus two'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1; };

function pageHtml(kind) {
  const fetches = `fetch('${API}/rest/v1/courses?id=eq.${C}&select=*',{headers:{Authorization:'Bearer sk_live_TOKEN_abc'}});` +
    `fetch('${API}/rest/v1/modules?course_id=eq.${C}');` + (kind === 'late' ? `fetch('${API}/rest/v1/quizzes?id=eq.${I}');` : '') + (kind === 'player' ? `fetch('${API}/rest/v1/rpc/get_quiz_questions_for_taking',{method:'POST'});` : '');
  const body = kind === 'h1'
    ? `<h1>Course not found</h1><a href="/courses">Back to courses</a><p>learner@example.com sk_live_TOKEN_abc</p>`
    : `<div data-testid="quiz-player-active"><h2>QLC secret title</h2><p>two plus two</p><input type="radio" aria-label="Four"></div>`;
  return `<!doctype html><html><body>${body}<script>${fetches}</script></body></html>`;
}

async function run(kind) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qlc-case-'));
  // Local controls may point at an installed shell (the repo pins rev 1217; this sandbox has 1243). CI resolves its own.
  const browser = await chromium.launch(process.env.QLC_SELFTEST_EXECUTABLE ? { executablePath: process.env.QLC_SELFTEST_EXECUTABLE } : {});
  try {
    const page = await browser.newPage();
    await page.route(`${APP}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: pageHtml(kind) }));
    await page.route(`${API}/**`, (r) => {
      const u = new URL(r.request().url());
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' };
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      if (u.pathname === '/rest/v1/courses' && kind === 'h1') {
        return r.fulfill({ status: 406, headers: cors, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', details: `0 rows for ${C}`, message: 'learner@example.com' }) });
      }
      if (u.pathname === '/rest/v1/courses') return r.fulfill({ status: 200, headers: { ...cors, 'content-range': '0-0/1' }, contentType: 'application/json', body: JSON.stringify([{ id: C, title: 'QLC secret title' }]) });
      if (u.pathname === '/rest/v1/quizzes' && kind === 'late') {
        // Released only after the capture boundary: must never reach the evidence.
        return new Promise((res) => setTimeout(res, 1200)).then(() => r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[{"id":"x"}]' })).catch(() => {});
      }
      if (u.pathname === '/rest/v1/modules') return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ id: M }]) });
      return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ id: I, question_text: 'two plus two' }, { id: 'x' }]) });
    });
    const rec = createCaseRecorder(page);
    await page.goto(`${APP}/courses/${C}/learn/${M}/${I}?token=sk_live_TOKEN_abc`);
    if (kind === 'late') {
      await page.waitForTimeout(300);
      await rec.freeze(100); // capture boundary while the quizzes read is still outstanding
    } else {
      await page.waitForLoadState('networkidle');
    }
    const line = await captureCaseFailure(page, { out, title: `${kind} case`, recorder: rec });
    let lateDropped = 0;
    if (kind === 'late') { await page.waitForTimeout(1500); lateDropped = rec.lateDropped(); }
    rec.detach();
    const files = fs.readdirSync(path.join(out, 'case-diagnostics'));
    const text = fs.readFileSync(path.join(out, 'case-diagnostics', files[0]), 'utf8');
    const all = fs.readdirSync(out, { recursive: true });
    const again = kind === 'late' ? (await rec.freeze()) : null;
    return { line, text, files, all, lateDropped, again };
  } finally {
    await browser.close();
    fs.rmSync(out, { recursive: true, force: true });
  }
}

const h1 = await run('h1');
console.log(`h1:     ${h1.line}`);
check('H1 page reads as heading course-not-found with no player state', /states=none headings=course-not-found /.test(h1.line));
check('H1 courses read reduces to GET:406:PGRST116:n/a', h1.line.includes('courses=GET:406:PGRST116:n/a'));
check('H1 questions RPC is unseen (player never asked)', h1.line.includes('rpc.get_quiz_questions_for_taking=unseen'));
check('route template with fixture-id booleans only', h1.line.includes('route=/courses/:c/learn/:m/:i ids=fixture,fixture,fixture'));

const player = await run('player');
console.log(`player: ${player.line}`);
check('control: mounted player reads as quiz-player-active, no heading', /states=quiz-player-active headings=none /.test(player.line));
check('control: courses 200 with 1 row from Content-Range', player.line.includes('courses=GET:200:none:1'));
check('control: questions RPC seen with 2 rows', player.line.includes('rpc.get_quiz_questions_for_taking=POST:200:none:2'));

const late = await run('late');
console.log(`late:   ${late.line}`);
check('late: an outstanding read at the boundary is unseen and api_settled=false', late.line.includes('quizzes=unseen') && late.line.includes('api_settled=false'));
check('late: the response that arrived after the boundary was not recorded (intake closed and detached)', !late.again.byPath.has('/rest/v1/quizzes') && late.again.incomplete === 1);
check('late: the written line equals the returned line (no later mutation)', late.text === `${late.line}\n`);

for (const [name, r] of [['h1', h1], ['player', player], ['late', late]]) {
  check(`${name}: exactly one file, one line, nothing else written (no PNG)`, r.files.length === 1 && r.text.trim().split('\n').length === 1 && r.all.every((f) => !/\.png$/i.test(String(f))));
  check(`${name}: no id, email, token, title or body text in the line`, SECRETS.every((s) => !r.text.includes(s)));
}
console.log(failed === 0 ? 'case-diagnostics selftest: ALL PASS' : `case-diagnostics selftest: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
