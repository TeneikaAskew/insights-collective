# Merge Upcoming Deadlines into the Calendar tab

Today the dashboard has two separate tabs — "Upcoming Deadlines" and "Calendar" — and the Calendar panel already contains its own inner "Selected Day" / "Upcoming" tabs. That is duplicated information in two places.

## What changes

1. **One tab, named "Calendar"**
   - Remove the standalone "Upcoming Deadlines" tab and its list from the dashboard tab bar.
   - The Calendar tab becomes the single home for the month view plus the Upcoming list (its existing inner tabs).

2. **The "Upcoming Deadlines" hero stat becomes a deep link**
   - Clicking the card opens the Calendar tab with the inner **Upcoming** tab already selected.
   - The URL reflects it (`/dashboard?tab=calendar&view=upcoming`), so the state is shareable and survives a refresh.
   - The number on the card is derived from the same upcoming calendar events the Upcoming list renders, so the count and the list can never disagree.

3. **Upcoming list keeps deadline detail**
   - Assignment and quiz entries in the Upcoming list keep their type badge and due date/time and continue to link straight to the assignment or quiz, so nothing that was only visible in the old deadlines tab is lost.

## Technical notes

- `src/pages/Dashboard.tsx`: drop the `deadlines` `TabsTrigger`/`TabsContent` block and the deadline list markup; keep the KPI card but point `handleMetricClick('deadlines')` at `tab=calendar` + `view=upcoming`. Existing `?tab=` search-param handling is reused; add a `view` param.
- `src/components/calendar/CalendarPanel.tsx`: change its inner `Tabs` from `defaultValue` to a controlled `value`/`onValueChange` driven by the `view` search param (default `selectedDay`), and expose the upcoming-event count to the dashboard (callback prop or shared hook call) for the KPI card.
- The existing `upcomingDeadlines` assignment query in `Dashboard.tsx` is removed if the calendar events fully cover it; the deadline-fetch error state and Retry surface move to the calendar panel's existing error message.
- Tests: update `src/pages/__tests__/Dashboard.test.tsx` (no more deadlines tab; KPI click asserts `tab=calendar&view=upcoming`) and add a Playwright assertion in `e2e/calendar/calendar.spec.ts` that the deep link lands on the Upcoming inner tab. `e2e/helpers/route-helpers.ts` gains an `upcoming` route entry.
- `ProfileMenu.tsx`'s `/dashboard?tab=calendar` link keeps working unchanged.
