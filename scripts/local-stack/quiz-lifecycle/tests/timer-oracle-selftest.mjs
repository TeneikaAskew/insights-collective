// ABOUTME: Arithmetic control for the F2 timer oracle: a correct server-clock timer passes; a timer that restarted at
// ABOUTME: reload (full duration minus time since reload) FAILS once server elapsed >= TIMER_MIN_ELAPSED_S. No browser.
import { TIMER_MIN_ELAPSED_S, TIMER_TOLERANCE_S, timerMatchesServer, pgTime, serverSecondsLeft } from '../timer-oracle.mjs';
let pass = 0; let fail = 0;
const ok = (c, m) => { if (c) { pass += 1; console.log(`PASS ${m}`); } else { fail += 1; console.log(`FAIL ${m}`); } };
const limit = 30;
const started = pgTime('2026-11-01 16:20:01.500+00');
ok(started === Date.parse('2026-11-01T16:20:01.500Z'), 'pgTime parses a +00 timestamptz');
for (const elapsed of [TIMER_MIN_ELAPSED_S, 12, 60, 900]) {
  for (const sinceReload of [0, 1, 2]) {
    const now = started + elapsed * 1000;
    const correct = Math.floor(serverSecondsLeft(started, now, limit));
    const reset = limit * 60 - sinceReload; // a timer that restarted at reload
    ok(timerMatchesServer(correct, started, now, limit), `elapsed ${elapsed}s: server-clock timer ${correct}s passes`);
    ok(!timerMatchesServer(reset, started, now, limit), `elapsed ${elapsed}s, ${sinceReload}s after reload: reset timer ${reset}s FAILS`);
  }
}
// Below the minimum the oracle cannot separate, which is why F2 waits for it.
ok(timerMatchesServer(limit * 60, started, started + TIMER_TOLERANCE_S * 1000, limit), `control: at ${TIMER_TOLERANCE_S}s elapsed a reset timer would still pass (so F2 must wait)`);
console.log(`== timer-oracle-selftest: ${pass} passed, ${fail} failed (pure arithmetic)`);
process.exit(fail ? 1 : 0);
