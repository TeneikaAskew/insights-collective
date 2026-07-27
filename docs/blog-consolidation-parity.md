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

## Sign-off

Deletion proceeds only when every row is ✅ or ⛔ and the test suite is green.
