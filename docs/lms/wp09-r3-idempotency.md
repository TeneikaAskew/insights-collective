# WP-09 R3: durable idempotency for watch-progress writes (design and source plan)

Status: **PROPOSAL.** Nothing here is applied, committed as a migration, or wired.
- Branch: `claude/wp09-r3-idempotency-design`, based on #164 head `c5b7caf`. #164 itself stays frozen at `c5b7caf`.
- Evidence tier: fake only (jsdom/vitest). That covers the in-memory contract model and the real client over a fake RPC (§5). No DB, RPC, RLS, provider or browser evidence exists for this design.
- The current #164 qualification (unwired, model tier) is unchanged by this document. **#164 stays integration-blocked** until an actual contract is qualified.

**Review status (2026-11-02 23:50Z).** The high-water contract is *conditionally* qualified. It is not #164 integration closure. The conditions, which this document now treats as requirements:
1. **Immutable same-key payload.** A given `(session_id, seq)` always carries the identical deltas.
2. **Sequential acknowledgement.** seq k+1 is never sent before seq k is acknowledged.
3. **Stable learner.** A session belongs to exactly one learner. A batch is never sent under a different signed-in user.
4. **Retained, transactional markers.** The marker and the increment commit together, and markers are kept for as long as any retry of their session is admissible (see Rollback in §3).

The draft `SECURITY DEFINER` access predicate (R-1, R-3 in §6) is still open and is not runnable as written.

## 1. The three failures this must close

All three are reproduced as executable fakes in `src/components/course/video/__tests__/r3IdempotencyModel.test.ts`.

| Id | Failure at c5b7caf | Cause | Fake result today |
|---|---|---|---|
| F1 | A batch whose write committed but whose response was lost is applied twice when another writer changes the row before the retry. | The retry recognises its own commit only by comparing totals (`expectTarget`). Any intervening writer breaks that comparison. | watch_time 13, expected 8 |
| F2 | A batch that never committed is dropped when another writer happens to bring the row to exactly the totals it attempted. | The same totals comparison gives a false "already applied". | watch_time 5, expected 10 |
| F3 | Under sustained same-key writes (several reporters, remounts, tabs), a batch can fail to apply at all. This is shown only as a fake liveness case: one preceding writer before each CAS update. | Client compare-and-set gives up after 3 rounds (`EngagementConflictError`). This is liveness, not corruption. | `'error'`, expected `'saved'` |

The common cause is that the server keeps no durable record of *which batch* it applied. Totals cannot identify a batch, and nothing short of a durable per-batch marker can.

**An atomic increment alone does not fix this.** `UPDATE ... SET watch_time = watch_time + d` closes F3. It makes F1 *unconditional*, though: a blind retry always adds again. It closes F2 only because it never skips anything. Durable idempotency (dedup) is required, not just atomicity.

## 2. Chosen minimal contract: keyed apply-once batches with a per-session high-water mark

**Client side.** These guarantees already hold in `WatchReporter` at c5b7caf, except for the key.
- Each `WatchReporter` instance gets a random `session_id` (`crypto.randomUUID()`). A remount, another tab or another device is a new session.
- Each batch it sends carries `seq`, starting at 1 and strictly increasing within the session.
- A failed batch is frozen and retried with **the same seq and the same deltas**.
- Seq k+1 is never sent until seq k is confirmed. Only one write is ever in flight, and the frozen batch always goes first.

**Server side.** One RPC call is one transaction:
1. Lock the session row `(user_id, content_item_id, session_id)`, creating it with `last_seq = 0` if absent.
2. If `p_seq <= last_seq`, the batch was already applied. Return `applied = false` and the current totals. **Do not apply.**
3. Otherwise set `last_seq = p_seq`, then upsert `video_analytics` with additive expressions: `watch_time = watch_time + d`, and the same for each counter. The row lock serialises concurrent sessions.
4. Commit. The marker and the increment commit together or not at all.

**Why this closes each failure exactly.** Given the client guarantee above, `seq <= last_seq` holds exactly when "this session's batch seq already committed".
- **F1:** the retry carries a seq that is `<= last_seq`, so it is skipped regardless of what other sessions wrote.
- **F2:** an uncommitted seq is `> last_seq`, so it is applied regardless of the totals.
- **F3 (design claim, not proven).** There is no client compare-and-set to lose. In SQL the waits would be:
  - **Same session:** two calls wait on the session row lock (`select ... for update` on `video_engagement_sessions`). They only overlap if condition 2 is broken.
  - **Different sessions on the same learner and video:** they do not share a session row. They serialise on the `video_analytics` row lock taken by `insert ... on conflict do update`, which waits instead of failing.
  - **Lock order:** every call locks the session row first, then the analytics row, so two calls of this function cannot deadlock each other.
  - **Other writers:** the legacy `updateEngagement` path still does read-then-write on the analytics row. It can still lose its own increments, as it can today.
  - **What the fake shows, and what it does not:** the F3 model test is one preceding writer plus indivisible JavaScript. It does **not** demonstrate SQL liveness under sustained contention, lock timeouts or statement timeouts. Only the isolated SQL tier (§5) can.
- **Not covered: restart and outbox durability.** Unacknowledged batches live in memory. A reload, crash or closed tab loses that progress. It never duplicates it. There is no durable outbox, and adding one would need its own design.

**Why a high-water mark instead of a row per batch.** Ordering per session is guaranteed, so one integer per session is a complete dedup record. Storage is one row per viewing session, instead of one row per 15 s batch.

### Alternatives considered

| Option | F1 | F2 | F3 | Why not chosen |
|---|---|---|---|---|
| A. Ledger with one row per batch: PK `(user, item, session, seq)`, `INSERT ... ON CONFLICT DO NOTHING`, then apply if inserted | closes | closes | closes | Correct and also detects payload mismatch on key reuse. It costs one row per batch and needs a retention or pruning rule, and pruning re-opens F1 for very late retries. **This is the fallback if per-session ordering is ever relaxed** (for example, parallel writes). |
| B. Append-only events table, aggregated on read | closes | closes | closes | Every reader of `video_analytics` would need to change: `get_student_video_progress`, the course and instructor analytics in `videoAnalyticsService`, and the reports lane. Writes would no longer fire the completion trigger. Much larger blast radius, outside the owned paths. |
| C. Client reconciliation (current c5b7caf: CAS plus `expectTarget`) | open | open | open (liveness) | Totals cannot identify a batch, as shown in §1. |
| D. Atomic increment RPC with no key | **worse** | closes | closes | A blind retry always double-applies. Rejected per the review. |
| E. Marker columns on `video_analytics` (`last_session_id`, `last_seq`) | open | open | closes | Holds only the latest writer, so a retry from session A after session B wrote is undecidable. |

## 3. Proposed database objects (PROPOSAL ONLY; no file under `supabase/migrations/`)

**This SQL has never been executed or syntax-checked against Postgres.** It is a draft for review; the isolated SQL tier in §5 is what would validate it.

```sql
-- PROPOSAL. Number assigned by the PR134 lane at authoring time (see §6).
create table public.video_engagement_sessions (
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete cascade,
  session_id       uuid not null,
  last_seq         integer not null default 0 check (last_seq >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, content_item_id, session_id)
);
alter table public.video_engagement_sessions enable row level security;
create policy "own sessions readable" on public.video_engagement_sessions
  for select using (user_id = auth.uid());
-- No insert/update/delete policies: rows are written only inside the RPC below.

create or replace function public.apply_video_engagement_batch(
  p_expected_user_id uuid,        -- client's recorded learner; refused unless = auth.uid() (condition 3)
  p_content_item_id uuid,
  p_session_id      uuid,
  p_seq             integer,
  p_watch_delta     integer,
  p_play_delta      integer,
  p_pause_delta     integer,
  p_seek_delta      integer,
  p_last_position   integer default null,
  p_video_duration  integer default null,
  p_playback_speed  numeric default null
) returns table (applied boolean, watch_time integer, play_count integer, pause_count integer, seek_count integer)
language plpgsql
security definer                -- writes the session table that has no write policy; see RLS review points
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_last integer;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_expected_user_id is distinct from v_user then
    raise exception 'expected user mismatch' using errcode = '42501';
  end if;
  -- OPEN (R-1/R-3): the content-visibility predicate for a SECURITY DEFINER body is not written.
  -- This draft is NOT runnable as an access-controlled function until it is.
  if p_seq < 1 or least(p_watch_delta, p_play_delta, p_pause_delta, p_seek_delta) < 0 then
    raise exception 'invalid batch' using errcode = '22023';
  end if;
  -- Same visibility rule the learner already has for the content item (review point R-3).

  insert into video_engagement_sessions (user_id, content_item_id, session_id)
    values (v_user, p_content_item_id, p_session_id)
    on conflict do nothing;
  select s.last_seq into v_last from video_engagement_sessions s
    where s.user_id = v_user and s.content_item_id = p_content_item_id and s.session_id = p_session_id
    for update;

  if p_seq <= v_last then
    return query select false, va.watch_time, va.play_count, va.pause_count, va.seek_count
      from video_analytics va where va.user_id = v_user and va.content_item_id = p_content_item_id;
    return;
  end if;

  update video_engagement_sessions set last_seq = p_seq, updated_at = now()
    where user_id = v_user and content_item_id = p_content_item_id and session_id = p_session_id;

  return query
  with upserted as (
  insert into video_analytics as va (user_id, content_item_id, watch_time, play_count, pause_count, seek_count,
                                     last_position, video_duration, playback_speed)
    values (v_user, p_content_item_id, p_watch_delta, p_play_delta, p_pause_delta, p_seek_delta,
            coalesce(p_last_position, 0), p_video_duration, coalesce(p_playback_speed, 1.0))
  on conflict (user_id, content_item_id) do update set
    watch_time     = coalesce(va.watch_time, 0)  + excluded.watch_time,
    play_count     = coalesce(va.play_count, 0)  + excluded.play_count,
    pause_count    = coalesce(va.pause_count, 0) + excluded.pause_count,
    seek_count     = coalesce(va.seek_count, 0)  + excluded.seek_count,
    last_position  = coalesce(p_last_position, va.last_position),
    video_duration = coalesce(p_video_duration, va.video_duration),
    playback_speed = coalesce(p_playback_speed, va.playback_speed)
  returning va.watch_time, va.play_count, va.pause_count, va.seek_count
  )
  select true, u.watch_time, u.play_count, u.pause_count, u.seek_count from upserted u;
end $$;

revoke all on function public.apply_video_engagement_batch(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, numeric) from public, anon;
grant execute on function public.apply_video_engagement_batch(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, integer, numeric) to authenticated;
```

**Existing objects this touches**
- `public.video_analytics`, as written by the RPC. Its schema is **unchanged**. It already has `UNIQUE(user_id, content_item_id)`, which the upsert relies on.
- The trigger `trigger_update_video_analytics_timestamp` calls `update_video_analytics_timestamp()`. It is BEFORE UPDATE only.
  - It fires on **every** UPDATE of the row, including the RPC's `do update` path. It sets `updated_at` and `last_watched_at`.
  - **Leaving out `completion_percentage` does NOT prove the RPC never completes a video.** The trigger's rule is: if the row's `completion_percentage >= 90` and `completed = false`, set `completed = true`. It applies to the row *as it stands*, whatever the UPDATE changed. So:
    - **Low-percentage row** (below 90, the normal case): the RPC leaves `completion_percentage` unchanged, so the RPC update cannot complete it.
    - **Edge-state row** (already at least 90 and still `completed = false`, from a legacy or other writer): **any** update completes it, whether from this RPC, `updateEngagement`, or anything else. That is existing behaviour, and the RPC inherits it unchanged.
  - The trigger is **not changed** by this proposal. Completion policy stays undecided, as in #164.
  - The SQL tier must test both the low-percentage and edge-state cases (§5).
  - The insert path does not fire the trigger. This is the same as today's `getOrCreateAnalytics`.
- Existing `video_analytics` policies (`20251006_video_analytics_and_discussions.sql:262-285`) are **not changed**.
- `getOrCreateAnalytics`, `updateEngagement`, `get_student_video_progress` and every reader are untouched.

**Rollback (retains the identity and marker guarantee, or blocks)**
- **Never drop markers and then send unresolved keyed batches down the CAS path.** A batch first sent keyed has an outcome that only its `(session_id, seq)` marker can resolve. Routing it through CAS (`expectTarget` totals) would bring back F1 and F2 for exactly the batches whose outcome is unknown.
  - The client enforces this: `persistence` is fixed per reporter, and a keyed reporter whose RPC is unavailable keeps the batch frozen and shows an error. It never re-routes the batch (tested in §5).
- **Disabling** means stopping *new* sessions from using keyed mode, by client config. Reporters that already exist keep retrying keyed. If the RPC is unavailable, they **block**: the batch stays queued and the status is error.
- **Removing** the function or the table is allowed only after the retry window is closed. That means no live keyed session can still retry, for example after a published client version that refuses keyed mode, plus the longest page lifetime the team accepts. Until then, the markers stay.
- **No pruning of `video_engagement_sessions` while any retry of its session is admissible.** Any future retention rule needs the same window argument.
- `video_analytics` keeps the counts already applied. They are correct, because each was applied once.
- No data rewrite is needed in either direction.

## 4. Client changes (owned files only; implemented on this branch behind `persistence: 'keyed'`, default `'cas'`)

| File | Change |
|---|---|
| `src/services/videoAnalyticsService.ts` | Adds `applyEngagementBatch(userId, contentItemId, {sessionId, seq, deltas})`. It first checks the local auth session: if the signed-in user is not `userId`, it throws `EngagementIdentityMismatchError` **without calling**. It then calls `supabase.rpc('apply_video_engagement_batch', {p_expected_user_id: userId, ...})` and maps the result to `{outcome: 'applied' \| 'already-applied', totals}`. It never sends `completion_percentage`. `applyEngagementDeltas` is unchanged. |
| `src/components/course/video/watchReporter.ts` | `persistence: 'cas' \| 'keyed'` is fixed per reporter. Keyed mode adds `sessionId` (injectable, default `crypto.randomUUID`) and a `seq`. A frozen batch keeps its seq and deltas, and later progress waits for its acknowledgement. An identity mismatch **retires** the reporter: the batch is dropped, nothing is ever sent again, and `hasPending` is false. Keyed mode never falls back to CAS. |
| `videoAnalyticsService.applyEngagementBatch` (identity, ack, id rules; terminal review of 0fe62eb) | **Auth read.** An auth-read *fault* (an error, a throw, or no data) is `EngagementAuthUnavailableError`: no RPC is sent and the batch is kept for an identical retry. Only a *successful* read showing sign-out or another user is an established mismatch (`'preflight'`, no RPC). A server refusal of `p_expected_user_id` is an established mismatch (`'server'`, nothing written). Only established mismatches retire the reporter. **Acknowledgement.** Only an ack of exactly one row with a boolean `applied` and four non-negative integer totals counts. Anything else is `EngagementAckMalformedError`: the outcome is unknown, so it is retried with the identical key, never sent through CAS, and later progress stays held. **Session id.** A non-UUID `p_session_id` is refused unsent. |
| `watchReporter.ts` session id | Session ids come from `secureSessionId()`, which uses `crypto.randomUUID`, falling back to `crypto.getRandomValues` (v4). With no CSPRNG it returns null, and the reporter **fails closed**: nothing is sent, the batch stays queued, and there is no CAS. `Math.random` is never used. |
| `src/components/course/video/TrackedVideoPlayer.tsx` | Adds an optional `persistence` prop (default `'cas'`), passed to the reporter. There is no other behaviour change. |
| `src/components/course/video/__tests__/keyedPersistence.test.tsx` | The real reporter, service and player over the RPC fake (§5). |

Not touched: LessonViewer, CourseLearn, the unified canvas editor, the sanitizer, workflows, `e2e/support` and `scripts/e2e`. Wiring stays in the PR134 lane.

## 5. Proofs

**Fake-model tier (this branch, runnable now).** File: `r3IdempotencyModel.test.ts`.
- 3 tests are `it.fails` against the **current** c5b7caf service over a fake table. The suite reports them as "expected fail". Run as plain `it`, they fail with exactly 13≠8 (F1), 5≠10 (F2) and `'error'`≠`'saved'` (F3). The receipt is in the export.
- 5 tests pass against `ProposedBatchLedgerModel` with `KeyedWriterModel`, an in-memory model of §2 (`__tests__/support/`): the same F1, F2 and F3, plus remount-as-new-session and same-session retry-ack.
- **The model is not the SQL.** It proves the contract is sufficient, not that the proposed function implements it.

**Real-client fake-RPC tier (this branch, runnable now).** File: `keyedPersistence.test.tsx`. It runs the real `WatchReporter`, the real `videoAnalyticsService.applyEngagementBatch` and the real `TrackedVideoPlayer` over `__tests__/support/fakeKeyedRpc.ts`, which puts the §2 model behind `supabase.rpc` and a switchable `auth.getSession`. The 8 controls:
1. An unknown-commit retry resends the identical session, seq and payload, and is applied once, checked on all four counters.
2. Later progress is held until the frozen batch is acknowledged, and is then sent as the next seq.
3. F1 is checked on all four counters, with exact call identity across the retry.
4. F2 is checked on all four counters; the retry reuses seq 1.
5. A real player remount gets a new session, so seq 1 is not treated as a duplicate.
6. Two tabs get isolated sessions.
7. After an account switch, a retired reporter replays nothing under the new learner: zero calls, and no rows for either learner.
8. Keyed mode never re-routes to CAS.

Mutations, receipts in the export:
- Changing the seq on retry re-opens F1.
- Removing the identity check makes the switched-account control fail.

The `it.fails` cases in `r3IdempotencyModel.test.ts` stay as they are, because they document the **CAS** contract, which is still the default.

**Isolated SQL/API tier (needs explicit scoped approval; run through the PR134 lane's qualified isolated runner, never production).**
1. Apply the proposed migration to the isolated stack only.
2. As one synthetic learner JWT:
   - call seq 1 twice and assert one increment and `applied = false` on the second;
   - call seq 2 with a lost response (abort after commit) and retry, and assert one increment;
   - run two sessions concurrently with 50 batches each and assert exact sums with no errors;
   - assert the BEFORE UPDATE trigger still sets `last_watched_at`;
   - assert a low-percentage row is not completed by the RPC;
   - assert an edge-state row (`completion_percentage >= 90`, `completed = false`) **is** completed by the RPC's update, exactly as by any other update. This preserves the existing semantics; it is not a new rule;
   - call with `p_expected_user_id` set to another user and assert it is refused;
   - run sustained concurrent sessions with a statement timeout set, and record waits and timeouts. This is the actual F3 liveness evidence the fake cannot give.
3. As a second learner, check that they cannot read or advance the first learner's session rows, and cannot write for another `user_id`.
4. As anon, check that execute is denied.
5. Roll back: drop the objects, then confirm the `video_analytics` rows and counts are unchanged.

## 6. Coordination, migration numbering and RLS review points

**Migration number.**
- Not chosen here. The PR134 lane assigns it at authoring time, after the current `20261102000000` series and any reserved numbers.
- `npm run check:migrations` must pass, and no version may be reused (see the CLAUDE.md lesson).
- Apply only via the parent-dispatched `db-migrate.yml`, never `apply_migration`. Ledger row and schema go in one transaction.
- Production is blocked behind the pending Nov-1 migrations and needs its own grant.

**RLS review points (none are decided in this document)**
- **R-1 Definer vs invoker.** As drafted, the function is `security definer` so that it can write a table with no write policies. The alternative is invoker plus insert and update policies on `video_engagement_sessions`. That would let a learner advance their own `last_seq` directly, which only harms their own future writes. Reviewer to choose.
- **R-2 Direct writes stay open.** The existing `video_analytics` UPDATE and INSERT policies still let a learner write arbitrary counters directly. This design does not make the counters tamper-proof. That would need revoking those direct-write policies, which is a **new policy** and is out of scope.
- **R-3 Content visibility.** The function should refuse `content_item_id`s the learner cannot see (enrolment or visibility). The existing table policies do not check this either. The exact predicate must reuse the lane's visibility helper, not invent a new one.
- **R-4 Instructor read policy, noted in passing.** The existing policy uses `p.roles @> ARRAY['admin','instructor']`, which requires **both** roles. That is probably not the intent. It is outside WP-09 and is flagged for the reports and RLS owner.
- **R-5 Session rows are readable by their owner only.** No instructor access is needed.
- **R-6 Bounds.** Optional per-batch sanity bounds, such as watch delta at most the wall time since the session's previous batch times the maximum rate. This would be new scoring policy, so it is not proposed without a decision.

**Dependencies**
- PR134 lane: migration number, isolated runner and approval routing.
- #146 and #164: unchanged and frozen.
- Completion policy: still undecided. The RPC deliberately does not send completion.
