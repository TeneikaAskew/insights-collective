

## Problem Analysis

The LocalStorage Debug page is broken due to two cascading issues:

1. **Rate limit RPC fails on invalid `inet` type**: The `check_debug_token_rate_limit` function expects an `inet` parameter, but the edge function passes `"unknown"` (a string) when IP headers are missing. This causes an RPC error, which the code treats as rate-limit exceeded, returning 429.

2. **React StrictMode double-fires the effect**: The `useEffect` in `LocalStorageDebug.tsx` calls `autoAuthenticate` on mount, and StrictMode runs it twice — doubling requests and compounding the rate limit issue.

3. **Overly complex auth flow**: The page already checks `user.roles.includes('admin')` on the client, then calls an edge function to get a debug token, then auto-authenticates. For admin users, this token roundtrip is unnecessary overhead that creates fragility.

## Plan

### Step 1: Simplify the LocalStorageDebug page — remove edge function dependency

Since access is admin-only (confirmed by user), the page should rely on the existing client-side admin role check (`user.roles.includes('admin')`) which is already backed by the server-side `user_roles` table. The debug token edge function adds complexity without meaningful security benefit (the admin role is already verified server-side via RLS).

**Changes to `src/pages/admin/LocalStorageDebug.tsx`:**
- Remove the `autoAuthenticate` function and its `useEffect`
- Remove the `supabase.functions.invoke('get-debug-token')` calls
- Remove the passcode input/verification UI
- Set `isAuthenticated` based on `user?.roles?.includes('admin')` directly
- Remove `isLoading` and `isTokenLoading` states (no async auth needed)
- Keep all the localStorage inspection functionality intact

### Step 2: Wrap the route with ProtectedRoute (requireAdmin)

**Changes to `src/App.tsx`:**
- Wrap the `<LocalStorageDebug />` route element with `<ProtectedRoute requireAdmin>` to enforce server-side admin validation, matching the pattern used by other admin routes.

### Step 3: Keep the edge function and migration files unchanged

Per the project's coding instructions ("DO NOT DELETE ANY FILES"), the `get-debug-token` edge function and related migration will remain in place but will no longer be called by the debug page.

## Technical Details

- The `ProtectedRoute` component already performs server-side admin verification via `supabase.rpc('has_admin_access', ...)` — this provides the same security as the edge function without the rate limit fragility
- No database changes needed
- No edge function changes needed

