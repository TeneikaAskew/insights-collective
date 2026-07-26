-- Reconstructed for repo/prod parity from schema_migrations.statements.
-- Applied directly to the hosted project (version 20260725100445); backfilled so a
-- fresh db build reproduces prod. Already recorded on prod, so db push skips it.

-- Pin search_path on functions flagged by the security advisor
-- (function_search_path_mutable): prevents search-path hijacking, which
-- matters most for functions invoked by triggers or SECURITY DEFINER paths.
ALTER FUNCTION public.calculate_course_difficulty(course_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.calculate_course_hours(course_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.calculate_lesson_completion(lesson_id_param uuid, user_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.get_courses_by_difficulty(diff_level course_difficulty) SET search_path = 'public';
ALTER FUNCTION public.get_most_discussed_content(course_id_param uuid, limit_count integer) SET search_path = 'public';
ALTER FUNCTION public.get_student_video_progress(student_id uuid, course_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.reorder_content_items(p_module_id uuid, p_item_ids uuid[]) SET search_path = 'public';
ALTER FUNCTION public.reorder_modules(p_course_id uuid, p_module_ids uuid[]) SET search_path = 'public';
ALTER FUNCTION public.set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.sync_discussion_upvote_count() SET search_path = 'public';
ALTER FUNCTION public.update_assignment_progress_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_blog_settings_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_content_discussion_timestamp() SET search_path = 'public';
ALTER FUNCTION public.update_page_visibility_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.update_video_analytics_timestamp() SET search_path = 'public';
