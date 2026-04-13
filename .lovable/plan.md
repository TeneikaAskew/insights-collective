

## Analysis

The page visibility system **is actually working correctly**. Here's what's happening:

### What the DB shows
The `/teneika-linkedin` page has `visible_to_users = false` and `visible_to_instructors = false` — your toggle settings are being saved properly.

### Why you don't see "Coming Soon"
You are logged in as **Nikki Askew, Administrator**. The visibility logic explicitly bypasses all checks for admin users (line 131 of `PageVisibilityContext.tsx`):
```ts
if (user?.roles?.includes('admin')) return true;
```

This is intentional — admins should always be able to access every page regardless of visibility settings. The "Admins: Always" column in your Page Visibility Manager screenshot confirms this design.

### What a non-admin user would see
- The page **would not appear** in their sidebar
- If they navigated directly to `/teneika-linkedin`, they'd see the **"Coming Soon" overlay** with a lock icon

### No code changes needed
The system is functioning as designed. To verify it works for non-admin users, you would need to:
1. Create or use a test account with a "student" role (no admin privileges)
2. Log in as that user
3. Confirm `/teneika-linkedin` is hidden from the sidebar and shows "Coming Soon" if accessed directly

### If you want admins to also see visibility restrictions
If the intent is that admins should *also* see the "Coming Soon" page when visibility is toggled off (so you can preview what users see), I can add a "Preview as user" toggle to the admin UI. This would let you temporarily view the page as a non-admin would see it, without changing the core security model.

### Regarding the LinkedIn scraping error
The posts aren't loading because the LinkedIn OAuth refresh token stored in Supabase secrets has expired (`invalid_grant` error). This requires manually generating a new token from LinkedIn's developer portal and updating the `LINKEDIN_REFRESH_TOKEN` secret in Supabase dashboard. No code change can fix this.

