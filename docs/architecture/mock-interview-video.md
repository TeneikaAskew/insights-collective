# Mock Interview Video — Architecture Options

Status: proposed (decision needed: Option A vs Option B, or A-then-B)
Related pages: `src/pages/interview-prep/MockInterviews.tsx`,
`src/pages/interview-prep/MockInterviewRoom.tsx`

## The problem

The interview room can never connect two participants. `setupWebRTC()` stops
after `getUserMedia` — the entire peer connection (offer/answer, ICE,
signaling) is a TODO comment, so the remote tile is permanently black and
each participant only ever sees themselves. Meanwhile the scheduler stores
`video_platform: 'Google Meet'` as a plain string: no meeting is ever
created and no link is ever shown, so there is **no working way for two
matched peers to actually meet**.

Two credible ways to fix it, plus one to rule out:

## Option A — Real meeting links via Zoom (recommended first step)

The repo already has a deployed pattern for this:
`supabase/functions/create-zoom-meeting` creates Zoom meetings (title,
start time, duration, agenda, recurrence) and returns `join_url` /
`start_url`. The mock-interview flow can reuse it wholesale:

1. **Schema**: add `meeting_url text` (and optionally `start_url text`) to
   `mock_sessions` via migration.
2. **Scheduling**: in `handleSchedule`, after the `mock_sessions` insert,
   invoke `create-zoom-meeting` with
   `title: "Mock Interview — {type}"`, `start_time: session_time`,
   `duration: 60`, then update the row with `join_url` and set
   `video_platform: 'Zoom'`. If meeting creation fails, keep the session and
   fall back gracefully (toast + no link) — scheduling must not break when
   Zoom is down.
3. **Room**: the in-app room stays — it's genuinely useful as the
   interviewer's cockpit (questions + evaluation form + countdown). Add a
   prominent "Join video call" button that opens `meeting_url`, and demote
   the current self-view video to an optional camera check. The evaluation
   form and `peer_reviews` insert keep working exactly as they do now.
4. **Requirements**: the Zoom account secrets that `create-zoom-meeting`
   already uses; no new vendors. Note the meetings are created under the
   platform's Zoom account, so concurrent-session limits apply
   (Zoom's per-user limit is typically ~2 concurrent meetings — check the
   account plan if many sessions can overlap).

Effort: small (one migration, ~30 lines in `handleSchedule`, room button).
Risk: low. Delivers a *working* product immediately.

## Option B — In-app WebRTC with Supabase Realtime signaling

A true in-app call, finishing what the TODO started. For a 1:1 call this is
a known-shape build, and the repo already contains the signaling seed: the
dead component `src/components/mock-interview/MockInterviewRoom.tsx`
subscribes to a `mock-interview-${sessionId}` Supabase Realtime channel —
exactly the channel you'd use to exchange WebRTC offers/answers/ICE.

What it takes:

1. **Signaling**: Supabase Realtime broadcast on
   `mock-interview-{sessionId}` — join/offer/answer/ice message types,
   plus presence to detect the partner arriving/leaving. No new backend.
2. **Peer connection**: `RTCPeerConnection` with STUN
   (`stun:stun.l.google.com:19302` is free). The deal-breaker in practice
   is **TURN**: 10–20% of user pairs (corporate NATs, some mobile carriers)
   cannot connect peer-to-peer and need a relay. Options: Twilio NAT
   Traversal, Cloudflare Calls (TURN included), or self-hosted coturn.
   TURN is a paid/ops commitment — without it, some sessions will
   mysteriously fail, which is worse than a Zoom link.
3. **Room UX**: the Side Desk layout is already built for this — the
   remote tile and PiP self-view just start receiving real streams.
   Add connection-state UI (waiting for partner / connecting / reconnecting).
4. **Edge cases**: reconnection on refresh, camera/mic permission flows,
   the second participant arriving early, both participants as
   interviewee/interviewer role checks.

Effort: medium (1–2 weeks including TURN setup and cross-network testing).
Risk: medium — connectivity long-tail is real and support-heavy.

## Option C — Google Meet (possible, but the heaviest link generator)

Asked and answered honestly: yes, Meet links can be generated, but it is
the most setup-intensive of the link options. Programmatic Meet creation
requires a **Google Cloud project + OAuth consent screen + the Calendar API
(or Meet REST API)**, and meetings must be created *as some Google
account*: either every scheduler connects their own Google account (an
OAuth flow and refresh-token storage the app doesn't have today), or the
platform runs a Google Workspace account with a service account +
domain-wide delegation (a paid Workspace requirement). Compare Zoom: the
Edge Function already exists and the account is already configured.

If the real concern is "some people may not have Zoom": **joining a Zoom
meeting from a browser requires no Zoom account and no app install** — the
join link opens a web client, participants just enter a name. Nobody needs
to *have* Zoom to attend; only the platform account creates meetings.

### The zero-vendor alternative for the no-account case: Jitsi

If avoiding vendor accounts entirely matters, **Jitsi Meet** deserves a
look before Google Meet: `https://meet.jit.si/<unique-room-slug>` is a
valid, working video room with **no API, no key, no account** — the
scheduler just stores a generated slug (e.g.
`insights-mock-{sessionId}`) as the meeting URL. Free, open source,
browser-based, works for 1:1 calls out of the box. Trade-offs: rooms are
guessable-by-slug unless random (use the session UUID), moderated features
are limited on the public instance, and it's a shared public service —
self-hostable later if usage grows. As a *fallback* platform next to Zoom
(or even as the primary), it's the fastest path to "everyone can join."

A clean shape for the scheduler: a `video_platform` choice at booking —
"Zoom" (platform-created meeting via the existing function) or "Jitsi"
(instant link, no vendor) — with the room's "Join video call" button
working identically for both.

## Recommendation

**A now (with Jitsi as the no-account fallback), B later if in-app calls
become a product goal.** Option A ships a
working mock-interview experience this week with zero new vendors, and
nothing in it is throwaway: the room, evaluation form, and peer reviews all
carry forward. If the platform later wants fully in-app calls (recording,
in-room AI feedback on answers, no context switch), Option B replaces the
"Join video call" button while keeping everything else.

A note on sequencing: no-show reporting (the dead legacy page's stranded
feature, with its `no_show_reports` table already migrated) pairs naturally
with Option A — "the partner never joined the Zoom" becomes reportable once
joining is real.
