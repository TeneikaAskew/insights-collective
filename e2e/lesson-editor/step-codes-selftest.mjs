#!/usr/bin/env node
// ABOUTME: No-browser self-test of the E1 step codes: the classifier in step-codes.mjs on FAKE report results, the E1 block's
// ABOUTME: test.step titles, the persona tour bypass and the lane's bounded action/navigation timeouts. No file is written.
// Usage: node e2e/lesson-editor/step-codes-selftest.mjs     (exit 0 only when every case meets its expectation)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = readFileSync(path.join(HERE, 'step-codes.mjs'), 'utf8');
const NEW = await import(path.join(HERE, 'step-codes.mjs'));
// Control: a classifier that drops the allowlist check must fail C2/C3 (it would print an unlisted title).
const LOOSE_FROM = 'if (LISTED.has(title) && hasError(s)';
if (SRC.split(LOOSE_FROM).length !== 2) { console.log('control: allowlist check not found exactly once'); process.exit(2); }
const LOOSE = await import(`data:text/javascript,${encodeURIComponent(SRC.replace(LOOSE_FROM, 'if (hasError(s)'))}`);

let pass = 0, fail = 0;
const say = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
const SECRET = 'FAKE-SECRET-e1-body-Bearer-xyz';
const err = { message: `boom ${SECRET}`, stack: `at ${SECRET}` };
const st = (title, extra = {}) => ({ title, duration: 1, ...extra });
const cases = (m) => ({
  C1: m.failedStep({ status: 'failed', steps: [st('E1_OPEN'), st('E1_BASELINE'), st('E1_EDIT_TITLE'), st('E1_EDIT_BODY', { error: err })] }),
  C2: m.failedStep({ status: 'failed', steps: [st('E1_OPEN'), st(`expect.toHaveText ${SECRET}`, { error: err })] }),
  C3: m.failedStep({ status: 'failed', steps: [st('E1_OPEN', { steps: [st(`locator.click ${SECRET}`, { error: err })] })] }),
});
const n = cases(NEW);
say('K1 E1_STEPS is frozen, 11 unique E1_* codes', Object.isFrozen(NEW.E1_STEPS) && NEW.E1_STEPS.length === 11 && new Set(NEW.E1_STEPS).size === 11 && NEW.E1_STEPS.every((c) => /^E1_[A-Z_]+$/.test(c)));
say('C1 an error in a listed step returns that code', n.C1 === 'E1_EDIT_BODY');
say('C2 an error only on an UNLISTED step (a failed attempt) returns unknown, never its title or message', n.C2 === 'unknown');
say('C3 an unlisted errored child of a listed step without its own error returns unknown', n.C3 === 'unknown');
say('C4 a listed parent and a listed child both errored: the deepest (child) wins',
  NEW.failedStep({ status: 'failed', steps: [st('E1_RELOAD', { error: err, steps: [st('E1_RELOAD_BODY', { error: err })] })] }) === 'E1_RELOAD_BODY');
say('C5 timedOut with no step error returns the last listed top-level step reached',
  NEW.failedStep({ status: 'timedOut', steps: [st('E1_OPEN'), st('E1_BASELINE'), st('E1_EDIT_TITLE'), st('E1_EDIT_BODY'), st(`hook ${SECRET}`)] }) === 'E1_EDIT_BODY');
say('C6 failed with no step error (e.g. fixture teardown after every step) returns unknown, not the last step',
  NEW.failedStep({ status: 'failed', errors: [err], steps: NEW.E1_STEPS.map((t) => st(t)) }) === 'unknown');
say("C7 a passed attempt returns 'none'", NEW.failedStep({ status: 'passed', steps: NEW.E1_STEPS.map((t) => st(t)) }) === 'none');
say('C8 malformed input returns unknown (null, no steps, non-array steps, non-string titles, errors: [])',
  [null, 'x', {}, { status: 'failed' }, { status: 'failed', steps: 'E1_OPEN' }, { status: 'failed', steps: [{ title: 7, error: err }] },
    { status: 'failed', steps: [st('E1_SAVED', { errors: [] })] }].every((r) => NEW.failedStep(r) === 'unknown'));
say('C9 errors: [x] on a listed step counts as an error', NEW.failedStep({ status: 'failed', steps: [st('E1_SAVED', { errors: [err] })] }) === 'E1_SAVED');
// No output of the classifier ever contains message, stack or unlisted-title text.
const outputs = [...Object.values(n), NEW.failedStep({ status: 'timedOut', steps: [st(SECRET)] })];
say('C10 no classifier output contains message, stack or unlisted-title text', outputs.every((o) => o === 'none' || o === 'unknown' || NEW.E1_STEPS.includes(o)) && !outputs.join(' ').includes(SECRET));
say('C11 the classifier source never reads message, stack, location, snippet or value fields', !/\.(message|stack|location|snippet|value)\b/.test(SRC.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
const l = cases(LOOSE);
say('M1 CONTROL: a classifier without the allowlist check FAILS C2 (it returns the unlisted title)', l.C2 !== 'unknown' && String(l.C2).includes(SECRET));

// Static: the spec's E1 block runs every phase inside a listed test.step, exactly the list in order, nothing outside.
const spec = readFileSync(path.join(HERE, 'lesson-editor.spec.ts'), 'utf8');
const a = spec.indexOf("test('E1 save:"); const b = spec.indexOf("test('E2 ", a);
const block = a >= 0 && b > a ? spec.slice(a, b) : '';
const titles = [...block.matchAll(/await test\.step\('([^']+)'/g)].map((x) => x[1]);
say('S1 the E1 block uses exactly E1_STEPS as test.step titles, in order', JSON.stringify(titles) === JSON.stringify(NEW.E1_STEPS));
// Remove each step body (brace-matched) and check nothing asserting or awaiting remains outside them.
let outside = block, i;
while ((i = outside.indexOf('await test.step(')) >= 0) {
  const open = outside.indexOf('{', outside.indexOf('async', i));
  let depth = 0, j = open;
  for (; j < outside.length; j++) { if (outside[j] === '{') depth++; else if (outside[j] === '}' && --depth === 0) break; }
  outside = outside.slice(0, i) + outside.slice(j + 1);
}
const body = outside.slice(outside.indexOf('=> {') + 4);
say('S2 no expect(...) or other await sits outside a step in E1', block !== '' && !/expect\(|expect\.poll|\bawait\b/.test(body));

// Persona tour bypass (personas.mjs) and the product switch it relies on (read-only check of the product source).
const per = readFileSync(path.join(ROOT, 'scripts/local-stack/lesson-editor/personas.mjs'), 'utf8');
say("T1 personas.mjs defines TOUR_BYPASS = { name: 'e2e:disable-tours', value: '1' } once",
  per.split("const TOUR_BYPASS = Object.freeze({ name: 'e2e:disable-tours', value: '1' });").length === 2);
const states = per.split('\n').filter((x) => /const state = /.test(x));
say('T2 the one storageState written per persona carries the auth key AND TOUR_BYPASS, for the app origin only',
  states.length === 1 && states[0].includes('origins: [{ origin: APP, localStorage: [{ name: APP_STORAGE_KEY, value: JSON.stringify(session) }, TOUR_BYPASS] }]')
  && per.split('`state-${p}.json`').length === 2);
let tour = '';
try { tour = readFileSync(path.join(ROOT, 'src/components/onboarding/SpotlightTour.tsx'), 'utf8'); } catch { /* lane tree without product source */ }
say("T3 the product tour honours the same key (SpotlightTour.tsx getItem('e2e:disable-tours'))", tour === '' ? (console.log('  (product source absent in this tree; checked on the composed tree)'), true) : tour.includes("window.localStorage.getItem('e2e:disable-tours')"));

// Lane config: bounded action and navigation waits.
const cfg = readFileSync(path.join(HERE, 'playwright.lesson-editor.config.ts'), 'utf8');
say('B1 lane config sets actionTimeout 30_000 and navigationTimeout 30_000 inside use', /use: \{[\s\S]*actionTimeout: 30_000,[\s\S]*navigationTimeout: 30_000,[\s\S]*\},\n  projects/.test(cfg));

console.log(`le step-codes-selftest (FAKE report results, no browser, database or file write): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
