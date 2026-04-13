
Goal: make page visibility behave exactly as you described:
- All Users = visible to every signed-in non-admin user, including instructors
- Instructors = instructor-only access when All Users is off
- Admins always bypass visibility rules

What I found
1. `src/contexts/PageVisibilityContext.tsx` has the wrong rule today: instructors only get `visible_to_instructors`, so they are blocked even when “All Users” is on.
2. `src/components/PageVisibilityGuard.tsx` is fragile: it uses local async state and a 2-second timeout that can default hidden pages back to visible.
3. `src/components/layout/AppSidebar.tsx` intentionally shows all menu items while visibility is loading, so hidden pages leak into the sidebar.
4. The page visibility table covers many routes, but only a few routes in `src/App.tsx` are actually wrapped with `PageVisibilityGuard`, so many toggles do nothing.
5. Role detection is being read from `profiles.roles` in `src/hooks/useUserProfile.ts`, even though the real RBAC source is `user_roles` / `get_user_roles`. That can make instructor/admin visibility inconsistent.
6. The social archive pages call edge functions, but the frontend only reacts to HTTP errors. Both scrape flows need a consistent success/error payload, and LinkedIn may still need a refreshed token if Supabase logs keep showing `invalid_grant`.

Implementation plan

1. Fix the role source first
- Update `src/hooks/useUserProfile.ts` to load roles from `supabase.rpc('get_user_roles', { _user_id: user.id })`.
- Use that as the primary source for `enrichedUser.roles`, with legacy `profiles.roles` only as fallback.

2. Fix the visibility rules in `src/contexts/PageVisibilityContext.tsx`
- Change `isPageVisible` to:
  - admin => always true
  - instructor => `visible_to_users || visible_to_instructors`
  - regular signed-in user => `visible_to_users`
- Add a real “ready” state so visibility is not evaluated before auth + page visibility data are loaded.

3. Simplify `src/components/PageVisibilityGuard.tsx`
- Remove the timeout-based fallback and local visible/check state.
- While auth/visibility are loading, show a loader.
- Once ready, either render the page or render the Coming Soon overlay.

4. Apply the guard consistently in `src/App.tsx`
- Audit the user-facing routes listed in the visibility manager and wrap the ones that are meant to be controlled by page visibility.
- Keep admin routes behind `ProtectedRoute requireAdmin` so visibility settings never replace real authorization.

5. Stop sidebar leaks in `src/components/layout/AppSidebar.tsx`
- Do not show hidden menu items during loading for non-admin users.
- Use the same finalized visibility logic as the route guard.
- Keep admin behavior explicit: admins can still see all managed pages by design.

6. Make the admin UI match the actual behavior
- Update the explanatory copy in `src/pages/AdminPageVisibility.tsx` so “All Users” clearly means all signed-in users, including instructors.
- Keep the current two-switch UI, but explain that “Instructors” is for instructor-only access when All Users is off.

7. Fix the social scrape UX
- Update `src/pages/TeneikaLinkedIn.tsx` and `src/pages/TeneikaTweets.tsx` to handle returned payloads with `success: false` and show a real toast/message instead of relying only on thrown HTTP errors.
- Standardize `supabase/functions/scrape-linkedin-posts/index.ts` and `supabase/functions/scrape-teneika-tweets/index.ts` to always return structured JSON on success and failure.

8. Validate the LinkedIn credential issue separately
- After the code fixes, check the deployed `scrape-linkedin-posts` logs.
- If they still show expired/revoked OAuth credentials, refresh the `LINKEDIN_REFRESH_TOKEN` secret in Supabase. That part cannot be fixed by frontend code alone.

Validation
- Add unit coverage for the role rules in `isPageVisible`.
- Expand e2e coverage to verify:
  - student vs instructor vs admin behavior
  - sidebar hiding for non-admin users
  - Coming Soon overlay on hidden routes
  - scrape buttons showing readable failure messages

Expected outcome
- The page visibility manager will finally enforce the rules you described.
- Hidden pages will stop leaking in the sidebar and route content.
- Instructors will correctly inherit “All Users” access.
- Social scrape failures will become clear and diagnosable instead of looking like random broken pages.
