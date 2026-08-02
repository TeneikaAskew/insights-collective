// ABOUTME: Drives the course "New message" composer all the way through
// ABOUTME: submission — the step no spec performed while the flow was broken.
//
// WHY THIS FILE EXISTS
//
// Starting a conversation failed in production for everyone. `conversations`
// carries a BEFORE INSERT trigger, `conversations_require_course`, that raises
// when `course_id` is null, and the `messages-helper` Edge Function inserted
// `{ subject, is_group, created_by }` and nothing else. Every attempt raised a
// raw Postgres exception and the user got "Failed to start conversation."
//
// CI never noticed, and it is worth being precise about why. There WAS a spec
// for this flow — messaging-validation.spec.ts, "new conversation dialog opens
// and exposes user search". It opened the dialog, checked the search box was
// there, asserted the submit button was disabled while nothing was selected,
// and clicked Cancel. Every one of those assertions is true of a completely
// broken feature. The single action that would have caught it — pressing the
// button — was the one action it did not take.
//
// So this spec presses the button.
//
// IT IS STUDENT-TO-STUDENT ON PURPOSE
//
// An earlier version of this spec ran as the member against a fellow student
// and CI failed it: the picker came back empty. `profiles` was guarded by a
// `can_view_profile` under which one student could not read another's row at
// all, so the UI could not offer people the database would have accepted.
// Migration 20260802140000 closes that, using the same predicate as
// `courses_shared_by_users` so visibility and messaging cannot drift apart
// again — and `fetchCourseContacts` reads `profiles` directly, so without it
// this picker still shows a student nothing but teaching staff.
//
// This spec is the coverage for that decision, which is why it drives the
// student-to-student case: the path that was unreachable is the one worth
// asserting.
//
// The counterpart is the journeys student rather than the instructor because
// journeys/messaging-notifications-hardening.spec.ts drives `open_course_thread`
// on the member/instructor pair and the suite is fullyParallel — sharing that
// pair would race, and the loser would silently cover nothing.
//
// WHAT KEEPS IT FROM GOING VACUOUS
//
// `open_course_thread` finds before it creates, and both branches land on the
// same thread view. A spec that only checked where it ended up would exercise
// creation exactly once — on the first run ever — and take the find path
// silently forever after. e2e/fixtures/seed.sql section 1c deletes the member
// <-> journeys conversation before every run, and asserts afterwards that the
// pair really is clear, really does share a course, and really can see one
// another. This spec re-checks what it can itself, so a run against an
// unseeded database fails here with a readable message instead of passing on
// the wrong branch.

import { test, expect } from '../fixtures/page-helpers';
import { E2E_BASE_URL, FIXTURE_COURSES } from '../fixtures/test-data';

const COUNTERPART_SEARCH = 'Journeys';
const COUNTERPART_NAME = 'E2E Journeys';
const MESSAGES_URL = `${E2E_BASE_URL}/courses/${FIXTURE_COURSES.enrolled.id}/messages`;

test.describe('Starting a conversation', () => {
  // One test rather than create-then-verify as a pair: the suite is
  // fullyParallel, so a second test could not rely on this one having run
  // first, and a serial block would only make that dependency legal, not sound.
  test('creates a conversation, opens it, and lists it in the inbox', async ({ page }) => {
    // The suite's default is 30s per test, and this one is a journey rather than a
    // check: load a course-scoped page, open the composer, wait for a course_contacts
    // round trip, create through open_course_thread, then
    // reload and read the list back. The individual waits below already sum past 30s, so
    // one run failed on the budget rather than on anything it asserted —
    // "Test timeout of 30000ms exceeded" with the picker working fine.
    //
    // Raising the ceiling, not the individual waits: each of those still fails on its own
    // message, so a genuine hang is reported as the step that hung rather than as a flat
    // timeout with no cause. Precedent: interview-prep-design/code-evaluation.spec.ts.
    test.setTimeout(120_000);

    await page.goto(MESSAGES_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

    await page.getByRole('button', { name: /new message/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The picker loads the whole course and filters client-side, so this
    // narrows an already-fetched list rather than issuing a query.
    await dialog.getByLabel('Search this course').fill(COUNTERPART_SEARCH);

    const candidate = dialog.getByRole('button', { name: new RegExp(COUNTERPART_NAME, 'i') });
    await expect(
      candidate,
      `"${COUNTERPART_NAME}" is not in the course picker. Either the seed did not ` +
        'give that account a name (seed.sql section 1b), or the acting account ' +
        'cannot read its profile row — fetchCourseContacts selects from profiles, ' +
        'which is RLS-guarded by can_view_profile, and without migration ' +
        '20260802140000 one student cannot see another at all.',
    ).toBeVisible({ timeout: 20_000 });
    await candidate.click();

    const submit = dialog.getByRole('button', { name: /start conversation/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // The assertion this whole file is for. While the flow was broken this is
    // where it stopped: the dialog stayed open and an error toast appeared,
    // because the insert raised "A conversation must belong to a course."
    await expect(
      dialog,
      'The composer stayed open after submitting. If an error is visible in it, ' +
        'the create path failed server-side — read the open_course_thread ' +
        'definition and the messages-helper logs rather than relaxing this.',
    ).toBeHidden({ timeout: 30_000 });

    // A real thread, not just a closed dialog: the composer hands the new
    // conversation id to the panel, which renders the message composer for it.
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({
      timeout: 20_000,
    });

    // NOT asserting that the new thread appears in the list without a reload.
    //
    // An earlier version did, and CI disproved it: the thread view rendered, the
    // conversation existed, and the row still had not arrived after 30s. The cause is
    // structural rather than slow. MessagesPanel filters on `conv.course_id === courseId`
    // where that course id comes from `useConversationCourses`, a lookup keyed by
    // conversation and populated separately from the list itself. A newly created thread
    // therefore has to land in TWO independent async caches before it can pass the
    // filter, and the panel only refreshes the scope lookup for the conversation that is
    // currently open (MessagesPanel.tsx:101-112).
    //
    // Waiting on the convergence of two caches is a race, and it is not what this spec
    // exists to prove. Worth knowing as a small UX gap — after starting a conversation
    // the sidebar can lag behind the thread you are already reading — but it is a
    // separate finding, not something to hold this assertion hostage to.

    // And it was persisted. Reloading refetches from the server, so the
    // counterpart appearing again is the difference between a conversation that
    // was written and one that only lived in component state.
    await page.goto(MESSAGES_URL, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(COUNTERPART_NAME).filter({ visible: true }).first(),
      'The conversation is not listed after a reload. It was either never ' +
        'persisted, or persisted without the conversation_participants rows the ' +
        'inbox reads.',
    ).toBeVisible({ timeout: 30_000 });
  });
});
