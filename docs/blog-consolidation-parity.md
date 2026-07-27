# Blog consolidation — V1 → canonical parity checklist

This document gates deletion. **No V1 file is removed until every row below is
either covered in the surviving stack or explicitly recorded as intentionally
dropped, with the reason.**

Two generations of blog code shipped side by side. The surviving stack is the
one reachable from the sidebar (`/admin/blog/*`), currently named with a `V2`
suffix; the suffix is removed in the final phase once the V1 names are free.

## Surfaces

| Generation | Entry point | Reachable from UI |
|---|---|---|
| **Surviving** | `/admin/blog/*` → `BlogAdmin` → `BlogManagementV2` + `BlogPostFormV2` | Yes — sidebar + dashboard tile |
| V1 list | `/admin/blog-posts` → `AdminBlogPosts` | No — route registered, zero inbound links |
| V1 editor | `/create-blog-post`, `/edit-blog-post/:slug` → `BlogPostForm` | No — routes registered, zero inbound links |
| Orphans | `BlogPostEditor.tsx`, `BlogPostMetrics.tsx` | No — **zero importers at all** |

## Capability parity

Legend: ✅ covered · 🔧 built in Phase 1 · ⛔ intentionally dropped

| # | V1 capability | V1 source | Status in surviving stack |
|---|---|---|---|
| 1 | Sort by Title | `AdminBlogPosts.tsx:113-186` | 🔧 added to the posts list |
| 2 | Sort by Views | `AdminBlogPosts.tsx:179-182` | 🔧 added |
| 3 | Sort by Date | `AdminBlogPosts.tsx:184-186` | 🔧 added |
| 4 | "Featured" filter | `AdminBlogPosts.tsx:315` | 🔧 added to the status filter |
| 5 | Tags shown on list rows | `AdminBlogPosts.tsx:395-396` (2 badges + `+n`) | 🔧 added, batched — no N+1 |
| 6 | In-form post preview | `components/blog/form/PreviewTab.tsx` | 🔧 replaced with an in-form Preview tab. The surviving stack's Preview button pointed at `/blog/preview/:slug`, which is **not a registered route** — it was broken, not merely different |
| 7 | "Archived" status filter | `AdminBlogPosts.tsx:314` | ⛔ dropped — `archived` is not a value in the status model (`draft`/`published`/`scheduled`); the filter could never match a row |
| 8 | Search posts | `AdminBlogPosts.tsx` search | ✅ `BlogManagementV2` search input |
| 9 | Filter by category | `AdminBlogPosts.tsx` | ✅ category Select |
| 10 | Filter by status | `AdminBlogPosts.tsx` | ✅ status Select |
| 11 | Stat cards | `AdminBlogPosts.tsx:231-287` (4) | ✅ superset — 6 cards incl. Views and Likes |
| 12 | View post publicly | row menu → `/blog/{slug}` | ✅ row menu "View" |
| 13 | Edit post | row menu → `/admin/blog/edit/{id}` | ✅ row menu "Edit" — V1 already delegated to the surviving editor |
| 14 | Delete post + confirm | `AdminBlogPosts.tsx:468-485` | ✅ same dialog copy |
| 15 | Create post | `/create-blog-post` → `BlogPostForm` | ✅ `/admin/blog/new` → richer editor |
| 16 | Edit post form | `/edit-blog-post/:slug` | ✅ `/admin/blog/edit/:id` |
| 17 | SEO fields | `form/SeoTab.tsx` | ✅ superset — `SEOMetadataEditor` adds scoring + previews |
| 18 | Image upload | `form/ImageUploader.tsx` | ✅ superset — `MediaLibraryDialog` (library + upload) |
| 19 | Status dropdown | `form/StatusDropdown.tsx` | ✅ **shared file, not deleted** |
| 20 | Tag input | `form/TagInput.tsx` | ✅ **shared file, not deleted** |

### Capabilities only the surviving stack has

Duplicate post · Scheduled filter · Categories manager · Analytics dashboard ·
Blog settings · rich TipTap editor · media library · SEO scoring.

## Files retained despite living in the V1 folder

`components/blog/form/StatusDropdown.tsx` and `components/blog/form/TagInput.tsx`
are imported by **both** generations. They stay.

## Removal set (only once rows 1-6 above are ✅)

- `components/admin/blog/BlogPostEditor.tsx` — zero importers
- `components/blog/analytics/BlogPostMetrics.tsx` — zero importers
- `pages/AdminBlogPosts.tsx`, `pages/CreateBlogPost.tsx`, `pages/EditBlogPost.tsx`
- `components/blog/BlogPostForm.tsx`
- `components/blog/form/{FormTabs,BlogFormFields,PreviewTab,SeoTab,ImageUploader}.tsx`
- Routes `/admin/blog-posts`, `/create-blog-post`, `/edit-blog-post/:slug` + lazy imports
- Stale `PageVisibilityContext` seed rows for the removed routes
- `blogService` exports with zero callers: `getBlogPostsByCategory`,
  `getBlogPostsByTag`, `getFeaturedBlogPosts`

## Sign-off — COMPLETE

All rows are ✅ or ⛔. Verified before deletion:

- Rows 1-3 (sorting): `toggleSort` present in the posts list.
- Row 4 (Featured filter): `value="featured"` option present.
- Row 5 (tags on rows): `post.tags.slice(0, 2)` rendering present.
- Row 6 (preview): `value="preview"` tab present in the editor.
- `BlogPostEditor` / `BlogPostMetrics`: re-confirmed **0 importers**.
- `StatusDropdown` / `TagInput`: confirmed still imported by the surviving
  editor, therefore retained.
- No test or e2e spec referenced any file in the removal set.

Name collision worth recording: there were **two** `EditBlogPost` components —
`src/pages/EditBlogPost.tsx` (V1, removed) and
`src/pages/admin/blog/EditBlogPost.tsx` (the surviving route wrapper, kept).

Removal executed with `npm run lint` (0 errors), the full Vitest suite (877
passing) and `npm run build` all green afterwards.

---

## Known defect found after shipping: bylines read "Unknown Author"

Surfaced by reviewing the regenerated `blog-index` visual baseline rather than
by a failing test — no assertion covers the byline, so nothing went red.

`blogService` resolves author names by looking the `author_id` up in
`profiles` and falls back to the literal `'Unknown Author'` when the lookup
returns nothing (`src/services/blogService.ts:66`, and three more sites at
:121, :256, :375). RLS on `profiles` does not grant `anon` any read, so for a
signed-out visitor — the overwhelming majority of blog traffic — every lookup
returns nothing and every post is attributed to "Unknown Author".

Measured against the live project:

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT (SELECT count(DISTINCT author_id) FROM blog_posts WHERE status='published'),
       (SELECT count(*) FROM profiles
          WHERE id IN (SELECT author_id FROM blog_posts WHERE status='published'));
ROLLBACK;
-- distinct_authors_needed: 2   profiles_anon_can_read: 0
```

Not a regression from `20260731000000` — that migration touches `blog_posts`,
`blog_categories`, `blog_post_tags` and `blog_post_views`, never `profiles`.
The defect is pre-existing and became *visible* only when `/blog` was routed;
before that the page was an unreachable orphan.

**Deliberately not fixed here.** The obvious fix — granting `anon` read on
`profiles` — would publish every user's profile row to the internet to put a
name on a blog post. The proportionate fix is a narrow accessor that exposes
display names *only* for users who have authored a published post (a
`SECURITY DEFINER` function or a view over that set), which is a schema
decision with its own review, not something to slip into a consolidation PR.

Whoever picks this up: add a test asserting a real byline, so the next
regression fails a check instead of waiting to be noticed in a screenshot.
