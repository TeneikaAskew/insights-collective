# Unapplied migrations (archived 2026-07-25)

These migration files were **never applied** to the live database (verified by
probing the objects they create), and the features they back are dead code or
were superseded. They are kept here for reference so `supabase/migrations/`
only contains migrations that reflect (or are meant to reach) the live schema.

| File | Missing objects | Why archived |
|---|---|---|
| `20250621130059-…` | `content_blocks`, `content_progress` | Legacy content-block system, superseded by `content_items` (see the applied `migrate_legacy_content_to_content_items` migration). Its quiz tables exist via other migrations. |
| `20250715090000-canvas-style-course-enhancements.sql` | `grades`, `lesson_completions`, `lesson_completion_requirements`, `module_prerequisites` | Partially applied long ago (rubrics/announcements/submissions exist); the grade-book and lesson-completion tables never landed and the code that targeted them is dead (see `DEAD_CODE_CANDIDATES.md`). Re-split and re-apply deliberately if these features are ever built. |
| `20250723000001-add-grade-history-and-comments.sql` | `grade_history`, `grade_change_notifications`, `grading_sessions`, `submission_comments` | Grade-history feature was never enabled; its UI components are unmounted dead code. |

Note: `submission_attachments` (also from the canvas-style-content-system
migration) **was** needed by live code and was applied separately as the
`create_submission_attachments` migration on 2026-07-25.
