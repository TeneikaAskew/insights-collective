# Coursera fallback catalog

Career role pages recommend courses from two sources. Courses published on Insights
Collective are always primary. Coursera fills only the subject areas our own
courses do not cover yet — so as the platform's catalog grows, the external
recommendations retreat on their own.

This document covers where the Coursera data comes from and how to refresh it.
For how recommendations are chosen, see `src/lib/roleCourseResolver.ts`.

## Why the catalog is a static file

There is no live source to query:

- Coursera's free public catalog API (`api.coursera.org/api/courses.v1`) was
  retired.
- The affiliate/partner API requires partner credentials.

So `src/data/courseraCatalog.generated.ts` is built from a dataset snapshot. It is
a **generated file** — do not edit it by hand.

## Current snapshot

| | |
|---|---|
| Source | [`azrai99/coursera-course-dataset`](https://huggingface.co/datasets/azrai99/coursera-course-dataset) on Hugging Face (`coursera_course_2024.csv`) |
| Dataset license | Apache 2.0 |
| Snapshot date | November 2024 |
| Rows in | 6,645 |
| Courses kept | 177 |
| Link check | 177/177 reachable (verified July 2026), after denylisting 2 retired slugs |

The first link check found 2 dead out of 144 — roughly a 1.4% rot rate over 20
months. Both were courses Coursera retired outright; no live course had moved. So
snapshot age costs coverage, not correctness, and the denylist absorbs it.

### Alternatives considered

| Dataset | Verdict |
|---|---|
| [Kaggle: Coursera Courses and Skills 2025](https://www.kaggle.com/datasets/yosefxx590/coursera-courses-and-skills-dataset-2025) (Mar 2025) | Four months fresher, but **has no URL column**. Without URLs the app cannot link anywhere, and slugs cannot be guessed — see below. |
| [`sg247/coursera-course-data`](https://huggingface.co/datasets/sg247/coursera-course-data) | 623 rows, title and skills only, no URLs, no stated license. |

Nothing newer than March 2025 was available. If a fresher export appears, prefer
whichever one still carries URLs; use the Kaggle set only to cross-check titles.

### Why URLs must come from the data

Coursera serves courses from three different path prefixes:

```
https://www.coursera.org/learn/<slug>                      # single courses
https://www.coursera.org/specializations/<slug>            # specializations
https://www.coursera.org/professional-certificates/<slug>  # professional certificates
```

Which prefix a course uses cannot be reliably derived from its format. An earlier
hand-written version of this catalog built URLs from a `format` field and mapped
professional certificates to `/specializations/` — 11 of 34 entries 404'd.
`CourseraCourse.url` is therefore stored verbatim, and a test asserts every row's
URL matches the prefix its format implies.

## Refreshing the catalog

```bash
# 1. Download a catalog CSV (see the table above for the expected columns).
# 2. Regenerate.
npm run build:coursera -- path/to/coursera.csv

# 3. Check every URL still resolves. Prints the dead ones.
npm run verify:coursera

# 4. Add any dead slugs to scripts/coursera-denylist.json with a reason, then
#    regenerate so they stop coming back.
npm run build:coursera -- path/to/coursera.csv

# 5. The drift and integrity tests must pass.
npm run test -- --run src/lib/__tests__/roleCourseResolver.test.ts
```

The generator expects these columns: `title`, `Organization`, `Skills`,
`Description`, `Level`, `URL`, `rating`, `num_reviews`, `enrolled`.

### Selection rules

Set at the top of `scripts/build-coursera-catalog.mjs`:

- Rating ≥ 4.3 from ≥ 50 reviews. The review floor stops a lone 5.0 from winning.
- Top 8 per subject, ranked by rating weighted by `log10` of the review count.
- Courses whose subject is named in the **title** rank above ones that only mention
  it in their skill tags. Without this, "Neural Networks and Deep Learning" — whose
  skills list Python programming, with enormous review counts — beat every real
  software-engineering course for that slot.

### Subjects

Subjects come from `src/data/subjectKeywords.json`, which is read by **both**
`src/data/learningSubjects.ts` (runtime) and the generator (a plain Node script
that cannot import TypeScript). Editing keywords therefore changes both at once.

`roleCourseResolver.test.ts` re-derives every generated row's subjects with
`inferSubjects()` and fails if they disagree, so the two implementations cannot
drift apart silently.

Catalog subjects are inferred from **title and Coursera's skill tags only, never the
description**. Descriptions are marketing prose that name-drop everything adjacent;
including them classified an Academic English writing course as `research` and AWS
Fundamentals as `data-analysis`.

## Known limitations

- **`mlops` coverage is thin** (~4 courses). MLOps was sparse on Coursera in a 2024
  snapshot. A fresher export should improve this.
- **`software-engineering` is a coarse subject.** It cannot distinguish "learn to
  program" from "learn full-stack", so a broad intro course can win the slot for a
  full-stack role. Splitting the subject would fix it if that matters.
- **Attribution.** Course titles, partner names, levels and ratings are Coursera's.
  The generated file is a filtered index kept only so the app can link out. Worth
  checking whether Coursera's affiliate program is a better fit before promoting
  these links heavily — it would also let the links earn revenue.
