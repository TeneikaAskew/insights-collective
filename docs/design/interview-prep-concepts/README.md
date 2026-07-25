# Interview Prep — Soft Studio Concept Boards

Three layout alternatives for the `/interview-prep` hub, all in the established
Soft Studio system (plaster `#FAF8F5`, lavender `#A794EB`/`#624EBE`, peach
`#F0BE96`/`#B97143`, soft semantic good/warn/teal, Outfit + Lora Italic,
26px cards, pill controls) — the same tokens now live on `/resume`
(`.soft-studio` in `src/index.css`).

## Concept A — Studio Tabs

![Concept A](./ip-concept-a-studio-tabs.png)

Consistency-first: mirrors the resume page exactly (pill tabs, feature card +
warm "why this matters" card, personal stat tiles). Cheapest to build — the
existing hub already uses this tab structure, so it's a restyle plus the new
personal strip (skills prepared, STAR streak, next session).

## Concept B — Practice Desk

![Concept B](./ip-concept-b-practice-desk.png)

No tabs — all four tools visible at once as bento tiles with per-tool accents,
plus a persistent "Your prep" rail: readiness ring, streak, skills checklist,
next session. Best glanceability; moderate build (new layout, same components).

## Concept C — Guided Path

![Concept C](./ip-concept-c-guided-path.png)

Leans into the feature's real dependency (STAR needs a job analysis first):
a numbered journey with state chips (Complete / Up next / Available /
scheduled), a "continue where you left off" card with the actual STAR
question + S-T-A-R progress, and the evidence panel. Most opinionated;
turns the marketing page into a personal dashboard.

## Review findings to fix during implementation (any concept)

- `/interview-prep/mock-interview-room` route is registered without the
  `:sessionId` param that `MockInterviews` navigates with — Join Session lands
  on session-not-found.
- `/interview-prep/job-description` spins forever when logged out
  (`setIsLoading(false)` only runs for signed-in users).
- `src/components/interview-prep/flashcard.css` is dead (imported globally,
  classes unused) — delete.
- Palette is inconsistent per page (four pastel gradient families on the hub,
  slate on STAR, VS Code hexes on Code Practice, indigo/purple on the mock
  room) — all converge on Soft Studio tokens.
- Legacy near-duplicate routes `/mock-interviews` and `/code-practice` should
  redirect to the `/interview-prep/*` versions or be updated in tandem
  (`MonacoCard` is shared between both code pages).

## Concept D — Guided Studio (A + C blend)

![Concept D](./ip-concept-d-guided-studio.png)

The numbered path IS the navigation: C's stepper (with Complete / Up next /
Available / scheduled state chips) replaces A's tab bar — selecting a step
swaps the overview below. The middle row is A's pair exactly: the feature
overview card (checklist + Lora testimonial + CTAs) and the warm
"Why this matters" evidence card, both themed to the selected step. C's
"Continue where you left off" card anchors the page with the user's actual
current STAR question, progress segments, and streak.

---

# Sub-page: Job Description Analysis — layout alternatives

Three Soft Studio arrangements of the page's real content (URL/paste input,
competency clouds, practice questions with deep-links, and the skills
checklist with its "N of M prepared" counter). Interactive switcher artifact
lives outside the repo; boards below.

## JD Concept A — Split Desk
![JD A](./jd-concept-a-split-desk.png)
Input rail on the left (sticky, with a compact progress card), the living
study guide stacked on the right. Everything visible at once; best for
users who iterate on multiple postings.

## JD Concept B — Guided Flow
![JD B](./jd-concept-b-guided-flow.png)
One column: analyzed-job bar (Re-analyze / Reset), three readiness tiles,
then competencies → questions → checklist, with "analyze another posting"
tucked at the end. Best reading order; closest to the current page's flow.

## JD Concept C — Study Binder
![JD C](./jd-concept-c-study-binder.png)
The guide as a binder: analyzed-job bar + pill tabs (Competencies /
Practice questions / Checklist with live count), progress and new-analysis
pinned in a right rail. Most compact per screen; matches the hub's pill
grammar most directly.
