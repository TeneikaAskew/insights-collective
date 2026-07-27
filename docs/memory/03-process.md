# Process: the steps that cost the most when skipped

## Read the environment's own documentation before improvising

Chromium could not reach the network. I tried five proxy configurations, tried
adding a CA to the NSS store (which hung), and only then read
`/root/.ccr/README.md` — which has a section titled "405 Method Not Allowed from
the proxy" describing exactly what I was seeing, and a "report it, do not work
around it" instruction for the class of failure I was in.

Reading it first would have saved most of an hour and would have pointed at the
diagnostic (`recentRelayFailures` in the status endpoint) that finally explained
the behaviour: Chromium's plain-HTTP requests reached the proxy and were logged;
its HTTPS CONNECT never arrived at all.

**When a tool misbehaves in an unfamiliar environment, find the environment's
docs before the third attempt.**

## Fix the order dependencies, not just the items

The plan for the harness work had a strict order, and the order was the point:

1. Real fixture IDs
2. *then* narrow the console suppressions
3. *then* the lint rule

Doing (2) first would have buried real defects under noise from the placeholder
IDs — which is exactly why the blanket suppressions were written in the first
place. The suppressions were a symptom; the placeholders were the cause. Removing
a symptom before its cause just re-creates the symptom.

Look for this shape generally: **if you are about to remove a workaround, find
what it was working around first.**

## Change one thing when diagnosing

I verified `--host-resolver-rules=MAP * 127.0.0.1:1,EXCLUDE localhost` worked
(25s timeout → 630ms), then added `,EXCLUDE 127.0.0.1` for "safety" before
shipping it. Chromium discards the entire rule string when it cannot parse a
clause, so nothing was blocked and the timeouts came back — and I spent the next
several minutes doubting whether `launchOptions` reached the browser at all.

The untested addition was the bug. **Do not add to a thing you just measured.**

## Clean up test data immediately, and sweep at the end

Probing a live database leaves rows behind. Mine included a `Probe Mod2` module
sitting at position 99 inside the reference course, which would have shown up in
the module list and in visual baselines.

A read-only sweep for probe-shaped rows before finishing found it. Do that sweep
as a matter of routine, and prefer probes that clean up in the same script that
creates them.

Some leftovers turn out to be useful: a `Foundations Check-in` quiz created
during an earlier investigation was exactly the fixture the specs needed, so it
was promoted into `seed.sql` with stable IDs rather than deleted and recreated.
Undocumented drift became a documented fixture.

## Do not use a destructive statement to test a monitor

To prove the "every auth user has a profile" invariant could actually fire, the
obvious move is to delete a profile inside a rolled-back transaction. The
permission classifier blocked it, and it was right to.

The same proof is available read-only: run the invariant's predicate against a
catalogue with one profile masked out, and check it returns 1. Zero risk, same
information.

**Prefer the read-only proof. If the only proof you can think of is destructive,
think again.**

## State the assumption, then check it

Several long detours came from an unstated assumption:

- "storageState is origin-scoped, so `127.0.0.1` vs `localhost` matters" — true,
  but not the actual cause; the session had simply expired.
- "`launchOptions` at the top-level `use` must not be reaching the browser" —
  it was; the rule string was malformed.
- "the CLI and the management API produce identical types output" — unverifiable
  in that sandbox, which is precisely why the drift check compares *meaning*
  against the live catalogue instead of diffing generator bytes.

Writing the assumption down turns it into something testable in one command.

## Let the tooling own the lifecycle

I spent several rounds starting and killing dev servers and relays by hand,
including one `pkill` that killed its own shell. Playwright's `webServer` option
exists for this. Once it owned startup — with `reuseExistingServer: true` so CI's
own preview server wins — the problem disappeared.

The same instinct produced `serve.mjs` reusing an already-listening relay instead
of dying with `EADDRINUSE`, which otherwise reads as a broken test setup rather
than "something is already running".

## Report scope honestly and keep going

When part of the work is blocked, finish everything else and say plainly what was
left and why. The e2e suite could not run for most of this session; the right
response was to complete the other six steps, state the limitation in the commit
message, and then come back and fix the environment — not to quietly drop it or
imply it had been verified.
