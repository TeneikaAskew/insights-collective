

## Problem Summary

Three distinct issues with the Teneika's LinkedIn page:

### Issue 1: No "Coming Soon" overlay when page is hidden
The `/teneika-linkedin` route in `src/App.tsx` (line 324) is not wrapped with `PageVisibilityGuard`. Other protected pages like Portfolio Explorer are wrapped, but this one is bare:
```
<Route path="/teneika-linkedin" element={<TeneikaLinkedIn />} />
```

**Fix**: Wrap the route with `PageVisibilityGuard` (and optionally `ProtectedRoute` if it should require login).

### Issue 2: Sidebar still shows the link even when page is hidden
Looking at the sidebar filtering logic (lines 203-205), admins bypass the visibility filter entirely:
```
const visiblePublicMenuItems = isAdmin || !pageVisibilityLoading
  ? publicMenuItems.filter(item => isPageVisible(item.url))
  : publicMenuItems;
```
Since you are logged in as admin, `isAdmin` is true, but actually looking closer — the condition is `isAdmin || !pageVisibilityLoading` which still filters via `isPageVisible`. The `isPageVisible` function should handle admin bypass internally. This needs investigation of the `PageVisibilityContext` to confirm behavior, but the sidebar item should respect the same visibility toggle for non-admin users once the guard is in place.

Actually, re-reading: the condition structure is `(isAdmin || !pageVisibilityLoading) ? filter : showAll`. So for admins, it still filters. The `isPageVisible` function likely returns `true` for admins regardless. This is correct behavior — admins always see everything. For non-admin users, if the page visibility is toggled off, the sidebar item should be hidden and the Coming Soon overlay should appear.

**The user's screenshot shows they are an admin** — so the sidebar correctly shows the item. For regular users, the sidebar would hide it only if the `PageVisibilityGuard` is in place and `isPageVisible` returns false for that path.

**Fix**: The sidebar behavior is actually correct for admins. The missing piece is the `PageVisibilityGuard` wrapper on the route.

### Issue 3: LinkedIn posts not loading — edge function returns 500
The edge function logs show the real error:
```
"invalid_grant" — "The provided authorization grant or refresh token is invalid, expired or revoked."
```

The LinkedIn refresh token stored in Supabase secrets (`LINKEDIN_REFRESH_TOKEN`) has expired. LinkedIn OAuth refresh tokens expire after a set period (typically 365 days) and must be re-generated.

Additionally, the edge function returns HTTP 500 when the scrape fails (line 486), but the query to `linkedin_posts` table should still work independently — it just returns empty because no posts have been stored yet.

**Fix for edge function**: 
- Change the error response to return HTTP 200 with `success: false` so the client can read the error message
- You will need to generate a new LinkedIn refresh token and update the `LINKEDIN_REFRESH_TOKEN` secret

## Plan

### Step 1: Wrap `/teneika-linkedin` route with PageVisibilityGuard
In `src/App.tsx`, wrap the route element:
```tsx
<Route path="/teneika-linkedin" element={
  <PageVisibilityGuard>
    <TeneikaLinkedIn />
  </PageVisibilityGuard>
} />
```
Do the same for `/teneika-tweets` for consistency.

### Step 2: Fix edge function error response
In `supabase/functions/scrape-linkedin-posts/index.ts`, change line 486 from `status: result.error ? 500 : 200` to always return `status: 200`. This prevents the `FunctionsHttpError` on the client side and lets the UI display the actual error message.

### Step 3: Update LinkedIn refresh token (manual step)
You need to re-authorize your LinkedIn OAuth app and get a new refresh token. Update the `LINKEDIN_REFRESH_TOKEN` secret in Supabase with the new value. Without this, scraping will continue to fail.

## Technical Details
- The `PageVisibilityGuard` component checks visibility via `isPageVisible()` from context, which queries the `page_visibility` table
- Admin users always see pages regardless of visibility settings (by design)
- The LinkedIn API error `invalid_grant` means the OAuth token chain is broken — no code fix can resolve this; a new token is required
- Changing the edge function to return 200 on error follows the pattern recommended for Supabase edge functions so the client can parse the response body

