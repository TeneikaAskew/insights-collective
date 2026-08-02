// ABOUTME: Drives the New Conversation dialog all the way through submission,
// ABOUTME: which is the step no spec performed while the flow was broken.
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
// and exposes user search". It opens the dialog, checks the search box is
// there, asserts the submit button is disabled while nothing is selected, and
// clicks Cancel. Every one of those assertions is true of a completely broken
// feature. The single action that would have caught this — pressing the button
// — was the one action it did not take.
//
// So this spec presses the button.
//
// IT IS STUDENT-TO-STUDENT ON PURPOSE
//
// The first CI run failed this spec, and correctly: the user search returned
// nobody. `profiles` was guarded by a `can_view_profile` that let a student see
// themselves, the instructors of their courses, people they already had a
// conversation with — and no other student. So the dialog invited a search that
// could not return most of the people the server would have accepted, and a
// student could in practice only message an instructor.
//
// Migration 20260802140000 closes that: anyone sharing a course can now see
// anyone else on it, using the same predicate as `courses_shared_by_users` so
// visibility and messaging cannot drift apart again. This spec is the coverage
// for that decision, which is why it drives the student-to-student case rather
// than the instructor's — the path that was unreachable is the one worth
// asserting.
//
// The counterpart is the journeys student rather than the instructor for a
// second reason: journeys/messaging-notifications-hardening.spec.ts drives
// `open_course_thread` on the member/instructor pair, and the suite is
// fullyParallel. Sharing that pair would race — whichever ran first would leave
// a conversation behind and the other would silently take the find branch.
//
// WHAT KEEPS IT FROM GOING VACUOUS
//
// The dialog calls `getOrCreateOneOnOneConversation`, which asks the server for
// an existing one-on-one first and only creates when there is none. Both
// branches end on the same conversation screen, so a spec that only checked
// where it landed would exercise the create path exactly once — on the first
// run ever — and take the find path silently forever after.
//
// e2e/fixtures/seed.sql section 1c deletes the member <-> journeys conversation
// before every run, and the seed then asserts that the pair really is clear,
// really does share a course, and really is visible to one another. This spec
// re-checks what it can itself, so a run against an unseeded database fails
// here with a readable message instead of passing on the wrong branch.

import { test, expect } from '../fixtures/page-helpers';
import { E2E_BASE_URL } from '../fixtures/test-data';

const COUNTERPART_SEARCH = 'Journeys';
const COUNTERPART_NAME = 'E2E Journeys';

test.describe('Starting a conversation', () => {
  // One test rather than create-then-verify as a pair. The suite is
  // fullyParallel, which schedules tests within a file across workers, so a
  // second test could not rely on this one having run first — and ordering it
  // with a serial block would only make the dependency legal, not sound.
  test('creates a conversation, opens it, and lists it in the inbox', async ({ page }) => {
    await page.goto(`${E2E_BASE_URL}/messages`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

    const inboxRows = page.locator('a[href^="/messages/"]');

    // Let the inbox settle before reading it. Checking for the counterpart's
    // absence while the list is still fetching would report absence for the
    // wrong reason and turn a failed seed into a pass.
    await expect
      .poll(
        async () =>
          (await inboxRows.count()) > 0 ||
          (await page.getByText(/no conversations yet/i).isVisible().catch(() => false)),
        {
          timeout: 30_000,
          message: 'the inbox should settle on rows or the empty state before we read it',
        },
      )
      .toBe(true);

    // Precondition, asserted rather than assumed: with an existing
    // conversation the dialog finds instead of creating, and this test would
    // pass while covering none of the code it was written for.
    await expect(
      inboxRows.filter({ hasText: COUNTERPART_NAME }),
      `The inbox already contains a conversation with ${COUNTERPART_NAME}, so the ` +
        'dialog will find it rather than create one. Re-apply e2e/fixtures/seed.sql ' +
        '(section 1c clears exactly this pair).',
    ).toHaveCount(0);

    await page.getByRole('button', { name: /new conversation/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // useUsers debounces by 300ms and searches profiles by first/last name; an
    // empty query renders "Type to search for users" and no rows at all.
    await dialog.getByPlaceholder(/search by name/i).fill(COUNTERPART_SEARCH);

    const candidate = dialog.getByText(COUNTERPART_NAME, { exact: true });
    await expect(
      candidate,
      `No profile named "${COUNTERPART_NAME}" came back from the user search. ` +
        'Two things cause that: the seed did not give the account a name ' +
        '(seed.sql section 1b), or the acting account cannot see it. The second ' +
        'is the interesting one — profiles is guarded by can_view_profile, and ' +
        'if migration 20260802140000 has not been applied to this database, one ' +
        'student cannot read another student\'s row at all.',
    ).toBeVisible({ timeout: 15_000 });
    await candidate.click();

    const submit = dialog.getByRole('button', { name: /start conversation/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // The assertion this whole file is for. While the flow was broken this is
    // where it stopped: the dialog stayed open and an error toast appeared,
    // because the insert raised "A conversation must belong to a course."
    await expect(
      page,
      'Submitting the dialog did not open a conversation. If an error toast is ' +
        'visible, the create path failed server-side — read the messages-helper ' +
        'logs rather than relaxing this assertion.',
    ).toHaveURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: 30_000 });

    await expect(dialog).toBeHidden();

    // A conversation, not just a URL: the thread view renders its composer.
    // Deliberately not asserting the counterpart's name here — the header
    // reads the subject out of the already-fetched inbox list, which has not
    // been refetched yet, so it legitimately shows the generic fallback.
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible({
      timeout: 15_000,
    });

    // Let the create settle before navigating. Inserting the participant rows
    // fires a realtime event on conversation_participants, and
    // useConversationList responds by refetching the inbox through the
    // messages-helper Edge Function. Navigating while that invoke is in flight
    // aborts it, supabase-js surfaces the abort as
    // "FunctionsFetchError: Failed to send a request to the Edge Function",
    // and the console-error fixture fails the test — for a request this spec
    // cancelled itself, after every assertion had already passed.
    //
    // networkidle is the right wait here rather than a fixed pause: it is the
    // in-flight request that matters, not a duration.
    await page.waitForLoadState('networkidle');

    // And it was persisted. Navigating back refetches the inbox from the
    // server, so the row appearing here is the difference between a
    // conversation that was written and one that only existed in the client's
    // navigation.
    await page.goto(`${E2E_BASE_URL}/messages`, { waitUntil: 'domcontentloaded' });
    await expect(
      inboxRows.filter({ hasText: COUNTERPART_NAME }).first(),
      'The conversation is not in the inbox after a reload. It was either never ' +
        'persisted, or persisted without the conversation_participants rows that ' +
        'getConversations reads.',
    ).toBeVisible({ timeout: 30_000 });
  });
});
