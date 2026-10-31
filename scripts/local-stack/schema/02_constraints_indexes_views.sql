alter table public.action_plan_progress add constraint action_plan_progress_pkey PRIMARY KEY (id);
alter table public.admin_actions add constraint admin_actions_pkey PRIMARY KEY (id);
alter table public.assesment_rubric add constraint rubric_pkey PRIMARY KEY (id);
alter table public.assessment_areas add constraint assessment_areas_pkey PRIMARY KEY (name);
alter table public.assessment_questions add constraint questions_pkey PRIMARY KEY (id);
alter table public.assessment_sessions add constraint assessment_sessions_pkey PRIMARY KEY (id);
alter table public.assignment_progress add constraint assignment_progress_pkey PRIMARY KEY (id);
alter table public.assignment_rubrics add constraint assignment_rubrics_pkey PRIMARY KEY (id);
alter table public.assignment_submissions add constraint assignment_submissions_pkey PRIMARY KEY (id);
alter table public.assignments add constraint assignments_pkey PRIMARY KEY (id);
alter table public.assistant_conversations add constraint assistant_conversations_pkey PRIMARY KEY (id);
alter table public.assistant_messages add constraint assistant_messages_pkey PRIMARY KEY (id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.availability_slots add constraint availability_slots_pkey PRIMARY KEY (id);
alter table public.blog_analytics add constraint blog_analytics_pkey PRIMARY KEY (id);
alter table public.blog_categories add constraint blog_categories_pkey PRIMARY KEY (id);
alter table public.blog_comments add constraint blog_comments_pkey PRIMARY KEY (id);
alter table public.blog_media add constraint blog_media_pkey PRIMARY KEY (id);
alter table public.blog_post_tags add constraint blog_post_tags_pkey PRIMARY KEY (id);
alter table public.blog_post_versions add constraint blog_post_versions_pkey PRIMARY KEY (id);
alter table public.blog_post_views add constraint blog_post_views_pkey PRIMARY KEY (id);
alter table public.blog_posts add constraint blog_posts_pkey PRIMARY KEY (id);
alter table public.blog_settings add constraint blog_settings_pkey PRIMARY KEY (id);
alter table public.blog_tags add constraint blog_tags_pkey PRIMARY KEY (id);
alter table public.bls_occupations add constraint bls_occupations_pkey PRIMARY KEY (soc_code);
alter table public.career_pathway_answers add constraint career_pathway_answers_pkey PRIMARY KEY (id);
alter table public.career_pathway_results add constraint career_assessments_pkey PRIMARY KEY (id);
alter table public.career_quiz_attempts add constraint career_quiz_attempts_pkey PRIMARY KEY (id);
alter table public.career_roles add constraint career_roles_pkey PRIMARY KEY (id);
alter table public.certificate_verification_attempts add constraint certificate_verification_attempts_pkey PRIMARY KEY (id);
alter table public.certificates add constraint certificates_pkey PRIMARY KEY (id);
alter table public.code_attempts add constraint code_attempts_pkey PRIMARY KEY (id);
alter table public.code_challenges add constraint code_challenges_pkey PRIMARY KEY (id);
alter table public.content_discussion_upvotes add constraint content_discussion_upvotes_pkey PRIMARY KEY (id);
alter table public.content_discussions add constraint content_discussions_pkey PRIMARY KEY (id);
alter table public.content_item_progressions add constraint content_item_progressions_pkey PRIMARY KEY (id);
alter table public.content_items add constraint content_items_pkey PRIMARY KEY (id);
alter table public.content_progress add constraint content_progress_pkey PRIMARY KEY (id);
alter table public.conversation_participants add constraint conversation_participants_pkey PRIMARY KEY (id);
alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table public.course_announcements add constraint course_announcements_pkey PRIMARY KEY (id);
alter table public.course_assignments add constraint course_assignments_pkey PRIMARY KEY (id);
alter table public.course_feedback add constraint course_feedback_pkey PRIMARY KEY (id);
alter table public.course_instructors add constraint course_instructors_pkey PRIMARY KEY (id);
alter table public.course_material_files add constraint course_material_files_pkey PRIMARY KEY (id);
alter table public.course_material_folders add constraint course_material_folders_pkey PRIMARY KEY (id);
alter table public.course_wishlists add constraint course_wishlists_pkey PRIMARY KEY (id);
alter table public.coursera_courses add constraint coursera_courses_url_key PRIMARY KEY (url);
alter table public.coursera_crawl_queue add constraint coursera_crawl_queue_pkey PRIMARY KEY (url);
alter table public.coursera_subject_keywords add constraint coursera_subject_keywords_pkey PRIMARY KEY (subject, keyword);
alter table public.courses add constraint courses_pkey PRIMARY KEY (id);
alter table public.cron_job_logs add constraint cron_job_logs_pkey PRIMARY KEY (id);
alter table public.debug_token_attempts add constraint debug_token_attempts_pkey PRIMARY KEY (id);
alter table public.enrollments add constraint enrollments_pkey PRIMARY KEY (id);
alter table public.event_registrations add constraint event_registrations_pkey PRIMARY KEY (id);
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.form_submissions add constraint form_submissions_pkey PRIMARY KEY (id);
alter table public.forms add constraint forms_pkey PRIMARY KEY (id);
alter table public.forums add constraint forums_pkey PRIMARY KEY (id);
alter table public.grade_change_notifications add constraint grade_change_notifications_pkey PRIMARY KEY (id);
alter table public.grade_history add constraint grade_history_pkey PRIMARY KEY (id);
alter table public.grades add constraint grades_pkey PRIMARY KEY (id);
alter table public.grading_sessions add constraint grading_sessions_pkey PRIMARY KEY (id);
alter table public.job_descriptions add constraint job_descriptions_pkey PRIMARY KEY (id);
alter table public.lesson_completion_requirements add constraint lesson_completion_requirements_pkey PRIMARY KEY (id);
alter table public.lesson_completions add constraint lesson_completions_pkey PRIMARY KEY (id);
alter table public.lesson_progress add constraint lesson_progress_pkey PRIMARY KEY (id);
alter table public.lessons add constraint lessons_pkey PRIMARY KEY (id);
alter table public.linkedin_posts add constraint linkedin_posts_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.mock_sessions add constraint mock_sessions_pkey PRIMARY KEY (id);
alter table public.module_content add constraint module_content_pkey PRIMARY KEY (id);
alter table public.module_progress add constraint module_progress_pkey PRIMARY KEY (id);
alter table public.module_progressions add constraint module_progressions_pkey PRIMARY KEY (id);
alter table public.modules add constraint modules_pkey PRIMARY KEY (id);
alter table public.no_show_reports add constraint no_show_reports_pkey PRIMARY KEY (id);
alter table public.notification_email_log add constraint notification_email_log_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.page_visibility add constraint page_visibility_pkey PRIMARY KEY (id);
alter table public.peer_reviews add constraint peer_reviews_pkey PRIMARY KEY (id);
alter table public.portfolio add constraint portfolio_pkey PRIMARY KEY (id);
alter table public.portfolio_page_projects add constraint portfolio_page_projects_pkey PRIMARY KEY (id);
alter table public.portfolio_pages add constraint portfolio_pages_pkey PRIMARY KEY (id);
alter table public.portfolio_projects add constraint portfolio_projects_pkey PRIMARY KEY (id);
alter table public.posts add constraint posts_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.progress add constraint progress_pkey PRIMARY KEY (id);
alter table public.progress_snapshots add constraint progress_snapshots_pkey PRIMARY KEY (id);
alter table public.project_status add constraint project_status_pkey PRIMARY KEY (project_id);
alter table public.question_bank_categories add constraint question_bank_categories_pkey PRIMARY KEY (id);
alter table public.question_bank_questions add constraint question_bank_questions_pkey PRIMARY KEY (id);
alter table public.question_banks add constraint question_banks_pkey PRIMARY KEY (id);
alter table public.question_category_links add constraint question_category_links_pkey PRIMARY KEY (question_id, category_id);
alter table public.quiz_attempt_questions add constraint quiz_attempt_questions_pkey PRIMARY KEY (id);
alter table public.quiz_attempts add constraint quiz_attempts_pkey PRIMARY KEY (id);
alter table public.quiz_question_pools add constraint quiz_question_pools_pkey PRIMARY KEY (id);
alter table public.quiz_questions add constraint quiz_questions_pkey PRIMARY KEY (id);
alter table public.quiz_submission_answers add constraint quiz_submission_answers_pkey PRIMARY KEY (id);
alter table public.quiz_submissions add constraint quiz_submissions_pkey PRIMARY KEY (id);
alter table public.quizzes add constraint quizzes_pkey PRIMARY KEY (id);
alter table public.resources add constraint resources_pkey PRIMARY KEY (id);
alter table public.resumes add constraint resumes_pkey PRIMARY KEY (id);
alter table public.rubric_criteria add constraint rubric_criteria_pkey PRIMARY KEY (id);
alter table public.rubrics add constraint rubrics_pkey PRIMARY KEY (id);
alter table public.scrape_metadata add constraint scrape_metadata_pkey PRIMARY KEY (id);
alter table public.security_events add constraint security_events_pkey PRIMARY KEY (id);
alter table public.star_responses add constraint star_responses_pkey PRIMARY KEY (id);
alter table public.study_guides add constraint study_guides_pkey PRIMARY KEY (id);
alter table public.submission_attachments add constraint submission_attachments_pkey PRIMARY KEY (id);
alter table public.submission_audit_events add constraint submission_audit_events_pkey PRIMARY KEY (id);
alter table public.submission_comments add constraint submission_comments_pkey PRIMARY KEY (id);
alter table public.survey_drafts add constraint survey_drafts_pkey PRIMARY KEY (id);
alter table public.thread_read_status add constraint thread_read_status_pkey PRIMARY KEY (id);
alter table public.thread_subscriptions add constraint thread_subscriptions_pkey PRIMARY KEY (id);
alter table public.threads add constraint threads_pkey PRIMARY KEY (id);
alter table public.tweets add constraint tweets_pkey PRIMARY KEY (id);
alter table public.user_assessments add constraint user_assessments_pkey PRIMARY KEY (id);
alter table public.user_feedback add constraint user_feedback_pkey PRIMARY KEY (id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (id);
alter table public.video_analytics add constraint video_analytics_pkey PRIMARY KEY (id);
alter table public.action_plan_progress add constraint action_plan_progress_user_id_timeframe_milestone_index_key UNIQUE (user_id, timeframe, milestone_index);
alter table public.assessment_questions add constraint questions_question_id_key UNIQUE (question_id);
alter table public.assignment_progress add constraint assignment_progress_user_id_content_block_id_key UNIQUE (user_id, content_block_id);
alter table public.assignment_rubrics add constraint assignment_rubrics_assignment_id_rubric_id_key UNIQUE (assignment_id, rubric_id);
alter table public.assignment_submissions add constraint unique_user_assignment_attempt UNIQUE (assignment_id, user_id, attempt);
alter table public.assignments add constraint assignments_content_item_id_unique UNIQUE (content_item_id);
alter table public.blog_analytics add constraint blog_analytics_blog_post_id_date_key UNIQUE (blog_post_id, date);
alter table public.blog_categories add constraint blog_categories_name_key UNIQUE (name);
alter table public.blog_categories add constraint blog_categories_slug_key UNIQUE (slug);
alter table public.blog_post_tags add constraint blog_post_tags_blog_post_id_tag_name_key UNIQUE (blog_post_id, tag_name);
alter table public.blog_post_versions add constraint blog_post_versions_blog_post_id_version_number_key UNIQUE (blog_post_id, version_number);
alter table public.blog_posts add constraint blog_posts_slug_key UNIQUE (slug);
alter table public.blog_tags add constraint blog_tags_slug_key UNIQUE (slug);
alter table public.career_roles add constraint career_roles_slug_key UNIQUE (slug);
alter table public.certificates add constraint certificates_verification_code_key UNIQUE (verification_code);
alter table public.content_discussion_upvotes add constraint content_discussion_upvotes_discussion_id_user_id_key UNIQUE (discussion_id, user_id);
alter table public.content_item_progressions add constraint unique_user_content_progression UNIQUE (user_id, content_item_id);
alter table public.content_items add constraint unique_position_per_module UNIQUE (module_id, "position") DEFERRABLE;
alter table public.content_progress add constraint content_progress_lesson_id_user_id_key UNIQUE (lesson_id, user_id);
alter table public.conversation_participants add constraint conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);
alter table public.course_assignments add constraint course_assignments_user_id_course_id_key UNIQUE (user_id, course_id);
alter table public.course_instructors add constraint course_instructors_course_id_user_id_key UNIQUE (course_id, user_id);
alter table public.course_wishlists add constraint course_wishlists_user_id_course_id_key UNIQUE (user_id, course_id);
alter table public.enrollments add constraint enrollments_user_id_course_id_key UNIQUE (user_id, course_id);
alter table public.event_registrations add constraint event_registrations_event_id_user_id_key UNIQUE (event_id, user_id);
alter table public.event_registrations add constraint unique_user_event_registration UNIQUE (user_id, event_id);
alter table public.forms add constraint forms_slug_key UNIQUE (slug);
alter table public.grades add constraint uq_grades_scope UNIQUE NULLS NOT DISTINCT (course_id, student_id, assignment_id, quiz_id);
alter table public.lesson_completion_requirements add constraint lesson_completion_requirements_lesson_id_requirement_type_key UNIQUE (lesson_id, requirement_type);
alter table public.lesson_completions add constraint lesson_completions_lesson_id_user_id_key UNIQUE (lesson_id, user_id);
alter table public.lesson_progress add constraint lesson_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id);
alter table public.linkedin_posts add constraint linkedin_posts_post_id_key UNIQUE (post_id);
alter table public.module_progress add constraint module_progress_user_id_module_id_key UNIQUE (user_id, module_id);
alter table public.module_progressions add constraint unique_user_module_progression UNIQUE (user_id, module_id);
alter table public.page_visibility add constraint page_visibility_page_path_key UNIQUE (page_path);
alter table public.portfolio_page_projects add constraint portfolio_page_projects_portfolio_page_id_project_id_key UNIQUE (portfolio_page_id, project_id);
alter table public.portfolio_pages add constraint portfolio_pages_custom_url_key UNIQUE (custom_url);
alter table public.portfolio_pages add constraint portfolio_pages_user_id_key UNIQUE (user_id);
alter table public.progress add constraint progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id);
alter table public.progress_snapshots add constraint progress_snapshots_user_id_course_id_snapshot_date_key UNIQUE (user_id, course_id, snapshot_date);
alter table public.question_bank_categories add constraint question_bank_categories_bank_id_name_key UNIQUE (bank_id, name);
alter table public.quiz_submissions add constraint quiz_submissions_submission_id_key UNIQUE (submission_id);
alter table public.quiz_submissions add constraint unique_user_quiz_attempt UNIQUE (quiz_id, user_id, attempt);
alter table public.quizzes add constraint quizzes_content_item_id_unique UNIQUE (content_item_id);
alter table public.scrape_metadata add constraint scrape_metadata_key_key UNIQUE (key);
alter table public.survey_drafts add constraint survey_drafts_user_id_form_id_key UNIQUE (user_id, form_id);
alter table public.thread_read_status add constraint thread_read_status_thread_id_user_id_key UNIQUE (thread_id, user_id);
alter table public.thread_subscriptions add constraint thread_subscriptions_user_id_forum_id_key UNIQUE (user_id, forum_id);
alter table public.thread_subscriptions add constraint thread_subscriptions_user_id_thread_id_key UNIQUE (user_id, thread_id);
alter table public.tweets add constraint tweets_tweet_id_key UNIQUE (tweet_id);
alter table public.user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role);
alter table public.video_analytics add constraint video_analytics_user_id_content_item_id_key UNIQUE (user_id, content_item_id);
alter table public.assessment_sessions add constraint assessment_sessions_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'paused'::text])));
alter table public.assistant_messages add constraint assistant_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['user'::text, 'assistant'::text])));
alter table public.availability_slots add constraint availability_slots_time_slot_check CHECK ((time_slot ~ '^slot_([0-9]|1[0-9]|2[0-3])_([0-9]|1[0-9]|2[0-3])$'::text));
alter table public.availability_slots add constraint availability_slots_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)));
alter table public.blog_posts add constraint blog_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
alter table public.blog_settings add constraint blog_settings_default_post_status_check CHECK ((default_post_status = ANY (ARRAY['draft'::text, 'published'::text])));
alter table public.blog_settings add constraint blog_settings_posts_per_page_check CHECK (((posts_per_page > 0) AND (posts_per_page <= 50)));
alter table public.bls_occupations add constraint bls_occupations_percentiles_ordered CHECK (((pct10 <= pct25) AND (pct25 <= median) AND (median <= pct75) AND (pct75 <= pct90)));
alter table public.bls_occupations add constraint bls_occupations_soc_code_format CHECK ((soc_code ~ '^[0-9]{2}-[0-9]{4}$'::text));
alter table public.bls_occupations add constraint bls_occupations_source_check CHECK ((source = ANY (ARRAY['seed'::text, 'discovered'::text])));
alter table public.career_quiz_attempts add constraint user_or_session_required CHECK (((user_id IS NOT NULL) OR (session_id IS NOT NULL)));
alter table public.career_roles add constraint career_roles_requested_title_only_when_discovered CHECK (((source = 'discovered'::text) OR (requested_title IS NULL)));
alter table public.career_roles add constraint career_roles_source_check CHECK ((source = ANY (ARRAY['curated'::text, 'discovered'::text])));
alter table public.code_challenges add constraint code_challenges_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])));
alter table public.content_discussions add constraint content_discussions_comment_type_check CHECK ((comment_type = ANY (ARRAY['question'::text, 'comment'::text, 'note'::text, 'suggestion'::text])));
alter table public.course_assignments add constraint course_assignments_role_check CHECK ((role = ANY (ARRAY['instructor'::text, 'admin'::text])));
alter table public.coursera_courses add constraint coursera_courses_enrolled_check CHECK (((enrolled IS NULL) OR (enrolled >= 0)));
alter table public.coursera_courses add constraint coursera_courses_estimated_hours_check CHECK (((estimated_hours IS NULL) OR (estimated_hours >= (0)::numeric)));
alter table public.coursera_courses add constraint coursera_courses_format_check CHECK ((format = ANY (ARRAY['Course'::text, 'Specialization'::text, 'Professional Certificate'::text])));
alter table public.coursera_courses add constraint coursera_courses_level_check CHECK ((level = ANY (ARRAY['Beginner'::text, 'Intermediate'::text, 'Advanced'::text])));
alter table public.coursera_courses add constraint coursera_courses_rating_check CHECK (((rating IS NULL) OR ((rating >= (0)::numeric) AND (rating <= (5)::numeric))));
alter table public.coursera_courses add constraint coursera_courses_reviews_check CHECK (((reviews IS NULL) OR (reviews >= 0)));
alter table public.coursera_courses add constraint coursera_courses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text, 'retired'::text])));
alter table public.coursera_crawl_queue add constraint coursera_crawl_queue_source_check CHECK ((source = ANY (ARRAY['refresh'::text, 'discover'::text])));
alter table public.coursera_crawl_queue add constraint coursera_crawl_queue_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text])));
alter table public.courses add constraint check_estimated_hours_positive CHECK ((estimated_hours > (0)::numeric));
alter table public.grade_change_notifications add constraint grade_change_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['grade_posted'::text, 'grade_updated'::text, 'grade_removed'::text, 'feedback_added'::text])));
alter table public.grade_history add constraint grade_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'excused'::text, 'unexcused'::text])));
alter table public.grades add constraint grades_grade_type_check CHECK ((grade_type = ANY (ARRAY['assignment'::text, 'quiz'::text, 'participation'::text, 'final'::text, 'midterm'::text, 'other'::text])));
alter table public.grading_sessions add constraint grading_sessions_grading_method_check CHECK ((grading_method = ANY (ARRAY['manual'::text, 'rubric'::text, 'auto'::text, 'imported'::text])));
alter table public.grading_sessions add constraint grading_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['individual'::text, 'bulk'::text, 'rubric'::text, 'speedgrader'::text])));
alter table public.job_descriptions add constraint job_descriptions_source_type_check CHECK ((source_type = ANY (ARRAY['manual'::text, 'url'::text])));
alter table public.lesson_completion_requirements add constraint lesson_completion_requirements_requirement_type_check CHECK ((requirement_type = ANY (ARRAY['view'::text, 'participate'::text, 'submit'::text, 'minimum_score'::text, 'mark_done'::text])));
alter table public.lesson_completions add constraint lesson_completions_completion_method_check CHECK ((completion_method = ANY (ARRAY['manual'::text, 'automatic'::text, 'requirement_met'::text])));
alter table public.mock_sessions add constraint mock_sessions_role1_check CHECK ((role1 = ANY (ARRAY['interviewer'::text, 'interviewee'::text])));
alter table public.mock_sessions add constraint mock_sessions_role2_check CHECK ((role2 = ANY (ARRAY['interviewer'::text, 'interviewee'::text])));
alter table public.mock_sessions add constraint mock_sessions_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'canceled'::text])));
alter table public.mock_sessions add constraint mock_sessions_type_check CHECK ((type = ANY (ARRAY['behavioral'::text, 'technical'::text])));
alter table public.project_status add constraint project_status_status_check CHECK ((status = ANY (ARRAY['Idea'::text, 'Planned'::text, 'In Progress'::text, 'Completed'::text])));
alter table public.question_bank_questions add constraint question_bank_questions_difficulty_level_check CHECK ((difficulty_level = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])));
alter table public.question_bank_questions add constraint question_bank_questions_question_type_check CHECK ((question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'short_answer'::text, 'essay'::text, 'matching'::text, 'fill_blank'::text, 'ordering'::text, 'multiple_answer'::text, 'calculated'::text])));
alter table public.quiz_question_pools add constraint quiz_question_pools_difficulty_filter_check CHECK ((difficulty_filter = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text, 'mixed'::text])));
alter table public.submission_audit_events add constraint submission_audit_events_action_check CHECK ((action = ANY (ARRAY['grade_posted'::text, 'grade_changed'::text, 'grade_removed'::text, 'comment_posted'::text, 'file_downloaded'::text, 'file_previewed'::text])));
alter table public.submission_comments add constraint submission_comments_author_type_check CHECK ((author_type = ANY (ARRAY['instructor'::text, 'student'::text, 'ta'::text, 'grader'::text])));
alter table public.submission_comments add constraint submission_comments_comment_type_check CHECK ((comment_type = ANY (ARRAY['feedback'::text, 'grade_justification'::text, 'question'::text, 'note'::text, 'rubric_feedback'::text])));
alter table public.submission_comments add constraint submission_comments_submission_type_check CHECK ((submission_type = ANY (ARRAY['assignment'::text, 'quiz'::text])));
alter table public.thread_subscriptions add constraint thread_subscriptions_check CHECK ((((thread_id IS NULL) AND (forum_id IS NOT NULL)) OR ((thread_id IS NOT NULL) AND (forum_id IS NULL))));
alter table public.video_analytics add constraint video_analytics_completion_percentage_check CHECK (((completion_percentage >= 0) AND (completion_percentage <= 100)));
alter table public.action_plan_progress add constraint action_plan_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.admin_actions add constraint admin_actions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id);
alter table public.admin_actions add constraint admin_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id);
alter table public.assesment_rubric add constraint fk_assessment_rubric_area FOREIGN KEY (assessment_area) REFERENCES assessment_areas(name);
alter table public.assessment_questions add constraint fk_assessment_area FOREIGN KEY (assessment_area) REFERENCES assessment_areas(name);
alter table public.assignment_rubrics add constraint assignment_rubrics_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
alter table public.assignment_rubrics add constraint assignment_rubrics_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE;
alter table public.assignment_submissions add constraint assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
alter table public.assignment_submissions add constraint assignment_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.assignment_submissions add constraint assignment_submissions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.assignments add constraint assignments_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
alter table public.assignments add constraint assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.assignments add constraint assignments_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.assistant_conversations add constraint assistant_conversations_quiz_attempt_id_fkey FOREIGN KEY (quiz_attempt_id) REFERENCES career_quiz_attempts(id);
alter table public.assistant_conversations add constraint assistant_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.assistant_messages add constraint assistant_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id);
alter table public.audit_logs add constraint audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.availability_slots add constraint availability_slots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.blog_analytics add constraint blog_analytics_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
alter table public.blog_comments add constraint blog_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.blog_comments add constraint blog_comments_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
alter table public.blog_comments add constraint blog_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE;
alter table public.blog_media add constraint blog_media_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.blog_post_tags add constraint blog_post_tags_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
alter table public.blog_post_tags add constraint blog_post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE;
alter table public.blog_post_versions add constraint blog_post_versions_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
alter table public.blog_post_versions add constraint blog_post_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.blog_post_views add constraint blog_post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE;
alter table public.blog_posts add constraint blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.blog_posts add constraint blog_posts_author_id_profiles_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.blog_posts add constraint fk_blog_posts_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL;
alter table public.career_pathway_answers add constraint career_pathway_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.career_quiz_attempts add constraint career_quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.career_roles add constraint career_roles_soc_code_fkey FOREIGN KEY (soc_code) REFERENCES bls_occupations(soc_code) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.certificates add constraint certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);
alter table public.certificates add constraint certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.certificates add constraint certificates_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.code_attempts add constraint code_attempts_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES code_challenges(id);
alter table public.code_attempts add constraint code_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.content_discussion_upvotes add constraint content_discussion_upvotes_discussion_id_fkey FOREIGN KEY (discussion_id) REFERENCES content_discussions(id) ON DELETE CASCADE;
alter table public.content_discussion_upvotes add constraint content_discussion_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.content_discussions add constraint content_discussions_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
alter table public.content_discussions add constraint content_discussions_endorsed_by_fkey FOREIGN KEY (endorsed_by) REFERENCES auth.users(id);
alter table public.content_discussions add constraint content_discussions_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES content_discussions(id) ON DELETE CASCADE;
alter table public.content_discussions add constraint content_discussions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.content_discussions add constraint content_discussions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.content_item_progressions add constraint content_item_progressions_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
alter table public.content_item_progressions add constraint content_item_progressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.content_items add constraint content_items_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.content_items add constraint content_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.content_items add constraint content_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.content_progress add constraint content_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public.content_progress add constraint content_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.conversation_participants add constraint conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.conversation_participants add constraint conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.conversation_participants add constraint fk_conversation_participant_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.course_announcements add constraint course_announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.course_announcements add constraint course_announcements_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_announcements add constraint course_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.course_assignments add constraint course_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_assignments add constraint course_assignments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.course_feedback add constraint course_feedback_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
alter table public.course_feedback add constraint course_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.course_instructors add constraint course_instructors_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_instructors add constraint course_instructors_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.course_material_files add constraint course_material_files_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_material_files add constraint course_material_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES course_material_folders(id) ON DELETE CASCADE;
alter table public.course_material_files add constraint course_material_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.course_material_folders add constraint course_material_folders_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_material_folders add constraint course_material_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.course_material_folders add constraint course_material_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES course_material_folders(id) ON DELETE CASCADE;
alter table public.course_wishlists add constraint course_wishlists_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.course_wishlists add constraint course_wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.courses add constraint courses_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES profiles(id);
alter table public.enrollments add constraint enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.enrollments add constraint enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.event_registrations add constraint event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_registrations add constraint event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.event_registrations add constraint fk_event_registrations_user_id FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.events add constraint events_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.form_submissions add constraint form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
alter table public.form_submissions add constraint form_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.forums add constraint forums_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.grade_change_notifications add constraint grade_change_notifications_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.grade_change_notifications add constraint grade_change_notifications_grade_history_id_fkey FOREIGN KEY (grade_history_id) REFERENCES grade_history(id) ON DELETE CASCADE;
alter table public.grade_change_notifications add constraint grade_change_notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.grade_history add constraint grade_history_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
alter table public.grade_history add constraint grade_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES profiles(id);
alter table public.grade_history add constraint grade_history_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.grade_history add constraint grade_history_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
alter table public.grade_history add constraint grade_history_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.grade_history add constraint grade_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.grades add constraint grades_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
alter table public.grades add constraint grades_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.grades add constraint grades_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES profiles(id);
alter table public.grades add constraint grades_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.grades add constraint grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.grading_sessions add constraint grading_sessions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id);
alter table public.grading_sessions add constraint grading_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);
alter table public.grading_sessions add constraint grading_sessions_grader_id_fkey FOREIGN KEY (grader_id) REFERENCES profiles(id);
alter table public.grading_sessions add constraint grading_sessions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id);
alter table public.job_descriptions add constraint job_descriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.lesson_completion_requirements add constraint lesson_completion_requirements_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public.lesson_completions add constraint lesson_completions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public.lesson_completions add constraint lesson_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.lesson_progress add constraint lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public.lessons add constraint lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.mock_sessions add constraint mock_sessions_study_guide_id_fkey FOREIGN KEY (study_guide_id) REFERENCES study_guides(id);
alter table public.mock_sessions add constraint mock_sessions_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES auth.users(id);
alter table public.mock_sessions add constraint mock_sessions_user1_id_profiles_fkey FOREIGN KEY (user1_id) REFERENCES profiles(id);
alter table public.mock_sessions add constraint mock_sessions_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES auth.users(id);
alter table public.mock_sessions add constraint mock_sessions_user2_id_profiles_fkey FOREIGN KEY (user2_id) REFERENCES profiles(id);
alter table public.module_content add constraint module_content_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.module_progressions add constraint module_progressions_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.module_progressions add constraint module_progressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.modules add constraint modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.no_show_reports add constraint no_show_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.no_show_reports add constraint no_show_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.no_show_reports add constraint no_show_reports_session_id_fkey FOREIGN KEY (session_id) REFERENCES mock_sessions(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.peer_reviews add constraint peer_reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES auth.users(id);
alter table public.peer_reviews add constraint peer_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id);
alter table public.peer_reviews add constraint peer_reviews_session_id_fkey FOREIGN KEY (session_id) REFERENCES mock_sessions(id);
alter table public.portfolio add constraint portfolio_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.portfolio_page_projects add constraint portfolio_page_projects_portfolio_page_id_fkey FOREIGN KEY (portfolio_page_id) REFERENCES portfolio_pages(id) ON DELETE CASCADE;
alter table public.portfolio_page_projects add constraint portfolio_page_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE;
alter table public.portfolio_pages add constraint portfolio_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.portfolio_projects add constraint portfolio_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.posts add constraint posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE CASCADE;
alter table public.posts add constraint posts_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;
alter table public.posts add constraint posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.progress add constraint progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
alter table public.progress add constraint progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.progress_snapshots add constraint progress_snapshots_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.progress_snapshots add constraint progress_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.project_status add constraint project_status_project_id_fkey FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE;
alter table public.question_bank_categories add constraint question_bank_categories_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE;
alter table public.question_bank_categories add constraint question_bank_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES question_bank_categories(id) ON DELETE CASCADE;
alter table public.question_bank_questions add constraint question_bank_questions_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE;
alter table public.question_banks add constraint question_banks_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.question_banks add constraint question_banks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public.question_category_links add constraint question_category_links_category_id_fkey FOREIGN KEY (category_id) REFERENCES question_bank_categories(id) ON DELETE CASCADE;
alter table public.question_category_links add constraint question_category_links_question_id_fkey FOREIGN KEY (question_id) REFERENCES question_bank_questions(id) ON DELETE CASCADE;
alter table public.quiz_attempt_questions add constraint quiz_attempt_questions_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE;
alter table public.quiz_attempt_questions add constraint quiz_attempt_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES question_bank_questions(id);
alter table public.quiz_attempts add constraint quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.quiz_attempts add constraint quiz_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.quiz_question_pools add constraint quiz_question_pools_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE;
alter table public.quiz_question_pools add constraint quiz_question_pools_category_id_fkey FOREIGN KEY (category_id) REFERENCES question_bank_categories(id);
alter table public.quiz_question_pools add constraint quiz_question_pools_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.quiz_questions add constraint quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.quiz_submission_answers add constraint quiz_submission_answers_quiz_question_id_fkey FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions(id);
alter table public.quiz_submission_answers add constraint quiz_submission_answers_quiz_submission_id_fkey FOREIGN KEY (quiz_submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE;
alter table public.quiz_submissions add constraint quiz_submissions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
alter table public.quiz_submissions add constraint quiz_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.quizzes add constraint quizzes_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
alter table public.quizzes add constraint quizzes_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
alter table public.resources add constraint resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.resumes add constraint resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.rubric_criteria add constraint rubric_criteria_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES rubrics(id) ON DELETE CASCADE;
alter table public.rubrics add constraint rubrics_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
alter table public.security_events add constraint security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.star_responses add constraint star_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.study_guides add constraint study_guides_job_description_id_fkey FOREIGN KEY (job_description_id) REFERENCES job_descriptions(id);
alter table public.study_guides add constraint study_guides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.submission_attachments add constraint submission_attachments_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE;
alter table public.submission_audit_events add constraint submission_audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.submission_audit_events add constraint submission_audit_events_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE;
alter table public.submission_comments add constraint submission_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id);
alter table public.submission_comments add constraint submission_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES submission_comments(id) ON DELETE CASCADE;
alter table public.survey_drafts add constraint survey_drafts_form_id_fkey FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
alter table public.survey_drafts add constraint survey_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.thread_read_status add constraint thread_read_status_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;
alter table public.thread_read_status add constraint thread_read_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.thread_subscriptions add constraint thread_subscriptions_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE;
alter table public.thread_subscriptions add constraint thread_subscriptions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;
alter table public.thread_subscriptions add constraint thread_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.threads add constraint threads_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE;
alter table public.threads add constraint threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_assessments add constraint user_assessments_question_id_fkey FOREIGN KEY (question_id) REFERENCES assessment_questions(question_id);
alter table public.user_feedback add constraint user_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table public.user_roles add constraint user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.video_analytics add constraint video_analytics_content_item_id_fkey FOREIGN KEY (content_item_id) REFERENCES content_items(id) ON DELETE CASCADE;
alter table public.video_analytics add constraint video_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.video_analytics add constraint video_analytics_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rubric_assessment_area ON public.assesment_rubric USING btree (assessment_area);
CREATE INDEX IF NOT EXISTS idx_assessment_areas_name ON public.assessment_areas USING btree (name);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_area ON public.assessment_questions USING btree (assessment_area);
CREATE INDEX IF NOT EXISTS idx_assignment_progress_user_block ON public.assignment_progress USING btree (user_id, content_block_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_assignment_id ON public.assignment_rubrics USING btree (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_rubric_id ON public.assignment_rubrics USING btree (rubric_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_user ON public.assignment_submissions USING btree (assignment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_content_item_id ON public.assignments USING btree (content_item_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON public.assignments USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_blog_analytics_post_date ON public.blog_analytics USING btree (blog_post_id, date);
CREATE INDEX IF NOT EXISTS idx_blog_comments_approved ON public.blog_comments USING btree (is_approved);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON public.blog_comments USING btree (blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post ON public.blog_post_tags USING btree (blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON public.blog_post_tags USING btree (tag_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON public.blog_posts USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts USING btree (published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled_at ON public.blog_posts USING btree (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts USING btree (status);
CREATE INDEX IF NOT EXISTS career_pathway_answers_session_id_idx ON public.career_pathway_answers USING btree (session_id);
CREATE INDEX IF NOT EXISTS career_pathway_answers_user_id_idx ON public.career_pathway_answers USING btree (user_id);
CREATE INDEX IF NOT EXISTS career_pathway_results_created_at_idx ON public.career_pathway_results USING btree (created_at);
CREATE INDEX IF NOT EXISTS career_pathway_results_user_id_idx ON public.career_pathway_results USING btree (user_id);
CREATE INDEX IF NOT EXISTS career_roles_category_idx ON public.career_roles USING btree (category);
CREATE INDEX IF NOT EXISTS career_roles_soc_code_idx ON public.career_roles USING btree (soc_code);
CREATE INDEX IF NOT EXISTS idx_cert_verify_ip_time ON public.certificate_verification_attempts USING btree (ip_hash, attempted_at DESC);
CREATE UNIQUE INDEX certificates_user_course_unique ON public.certificates USING btree (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON public.certificates USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_discussion_upvotes_discussion ON public.content_discussion_upvotes USING btree (discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_upvotes_user ON public.content_discussion_upvotes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_content_item ON public.content_discussions USING btree (content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_endorsed ON public.content_discussions USING btree (instructor_endorsed) WHERE (instructor_endorsed = true);
CREATE INDEX IF NOT EXISTS idx_content_discussions_parent ON public.content_discussions USING btree (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_content_discussions_resolved ON public.content_discussions USING btree (is_resolved);
CREATE INDEX IF NOT EXISTS idx_content_discussions_timestamp ON public.content_discussions USING btree (timestamp_seconds) WHERE (timestamp_seconds IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_content_discussions_user ON public.content_discussions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_content_item_progressions_content_item_id ON public.content_item_progressions USING btree (content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_progressions_user_content ON public.content_item_progressions USING btree (user_id, content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_items_course_id ON public.content_items USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_content_items_course_module ON public.content_items USING btree (course_id, module_id);
CREATE INDEX IF NOT EXISTS idx_content_items_module_id ON public.content_items USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON public.content_items USING btree (type);
CREATE INDEX IF NOT EXISTS idx_content_progress_user ON public.content_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_archived ON public.conversation_participants USING btree (user_id, archived);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_deleted ON public.conversation_participants USING btree (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS conversations_course_id_idx ON public.conversations USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON public.conversations USING btree (deleted_at);
CREATE INDEX IF NOT EXISTS idx_course_announcements_course_id ON public.course_announcements USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_course_announcements_created_at ON public.course_announcements USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS course_feedback_course_idx ON public.course_feedback USING btree (course_id);
CREATE INDEX IF NOT EXISTS course_feedback_user_idx ON public.course_feedback USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cmfile_course ON public.course_material_files USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_cmfile_folder ON public.course_material_files USING btree (folder_id);
CREATE INDEX IF NOT EXISTS idx_cmf_course ON public.course_material_folders USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_cmf_parent ON public.course_material_folders USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_course_wishlists_course_id ON public.course_wishlists USING btree (course_id);
CREATE INDEX IF NOT EXISTS coursera_courses_active_idx ON public.coursera_courses USING btree (status) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS coursera_courses_languages_idx ON public.coursera_courses USING gin (languages);
CREATE INDEX IF NOT EXISTS coursera_courses_last_fetched_idx ON public.coursera_courses USING btree (last_fetched_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS coursera_courses_slug_idx ON public.coursera_courses USING btree (slug);
CREATE INDEX IF NOT EXISTS coursera_courses_subjects_idx ON public.coursera_courses USING gin (subjects);
CREATE INDEX IF NOT EXISTS coursera_crawl_queue_pending_idx ON public.coursera_crawl_queue USING btree (state, enqueued_at) WHERE (state = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty_level ON public.courses USING btree (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_courses_estimated_hours ON public.courses USING btree (estimated_hours);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses USING btree (instructor_id);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name_created_at ON public.cron_job_logs USING btree (job_name, created_at DESC);
CREATE UNIQUE INDEX enrollments_calendar_feed_token_key ON public.enrollments USING btree (calendar_feed_token);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_events_course_id ON public.events USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_forms_featured_status ON public.forms USING btree (featured, status);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON public.forms USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_forums_course_id ON public.forums USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_student ON public.grade_change_notifications USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_unread ON public.grade_change_notifications USING btree (student_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_grade_history_changed_at ON public.grade_history USING btree (changed_at);
CREATE INDEX IF NOT EXISTS idx_grade_history_grade_id ON public.grade_history USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_student_course ON public.grade_history USING btree (student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_grades_course_student ON public.grades USING btree (course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_course ON public.grading_sessions USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_grader ON public.grading_sessions USING btree (grader_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_requirements_lesson ON public.lesson_completion_requirements USING btree (lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON public.lesson_completions USING btree (lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_user ON public.lesson_completions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON public.lesson_progress USING btree (user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_author ON public.linkedin_posts USING btree (author_username);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_content ON public.linkedin_posts USING gin (to_tsvector('english'::regconfig, content));
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON public.linkedin_posts USING btree (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_content_module_id ON public.module_content USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_module_progress_user_module ON public.module_progress USING btree (user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_module_progressions_module_id ON public.module_progressions USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_module_progressions_user_module ON public.module_progressions USING btree (user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_position ON public.modules USING btree (course_id, "position");
CREATE INDEX IF NOT EXISTS idx_no_show_reports_reported_user_id ON public.no_show_reports USING btree (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_no_show_reports_session_id ON public.no_show_reports USING btree (session_id);
CREATE INDEX IF NOT EXISTS notification_email_log_notification_idx ON public.notification_email_log USING btree (notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_course ON public.notifications USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending_digest_idx ON public.notifications USING btree (user_id) WHERE (email_digest_sent_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_progress_snapshots_user ON public.progress_snapshots USING btree (user_id, course_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_bank ON public.question_bank_questions USING btree (bank_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_difficulty ON public.question_bank_questions USING btree (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_tags ON public.question_bank_questions USING gin (topic_tags);
CREATE INDEX IF NOT EXISTS idx_question_bank_questions_type ON public.question_bank_questions USING btree (question_type);
CREATE INDEX IF NOT EXISTS idx_question_banks_course ON public.question_banks USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_attempt ON public.quiz_attempt_questions USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts USING btree (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON public.quiz_attempts USING btree (user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_pools_quiz ON public.quiz_question_pools USING btree (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions USING btree (quiz_id);
CREATE UNIQUE INDEX uq_quiz_submission_answers_sub_question ON public.quiz_submission_answers USING btree (quiz_submission_id, quiz_question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_user ON public.quiz_submissions USING btree (quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user_id ON public.quiz_submissions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_content_item_id ON public.quizzes USING btree (content_item_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_module_id ON public.quizzes USING btree (module_id);
CREATE UNIQUE INDEX resources_tweet_id_unique ON public.resources USING btree (tweet_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric_id ON public.rubric_criteria USING btree (rubric_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_course_id ON public.rubrics USING btree (course_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events USING btree (severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_star_responses_assessment ON public.star_responses USING btree (assessment_area, is_assessment_question);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id ON public.submission_attachments USING btree (submission_id);
CREATE INDEX IF NOT EXISTS submission_audit_events_course_idx ON public.submission_audit_events USING btree (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submission_audit_events_module_idx ON public.submission_audit_events USING btree (module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submission_audit_events_submission_idx ON public.submission_audit_events USING btree (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_comments_author ON public.submission_comments USING btree (author_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_parent ON public.submission_comments USING btree (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission ON public.submission_comments USING btree (submission_id, submission_type);
CREATE INDEX IF NOT EXISTS idx_tweets_content_search ON public.tweets USING gin (to_tsvector('english'::regconfig, content));
CREATE INDEX IF NOT EXISTS idx_tweets_scraped_at ON public.tweets USING btree (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON public.tweets USING btree (tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_tweeted_at ON public.tweets USING btree (tweeted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_page_path ON public.user_feedback USING btree (page_path);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_completed ON public.video_analytics USING btree (completed);
CREATE INDEX IF NOT EXISTS idx_video_analytics_completion_pct ON public.video_analytics USING btree (completion_percentage);
CREATE INDEX IF NOT EXISTS idx_video_analytics_content_item_id ON public.video_analytics USING btree (content_item_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_user_id ON public.video_analytics USING btree (user_id);

create or replace view public.audit_db_columns with (security_invoker=true) as  SELECT c.table_name::text AS table_name,
    c.column_name::text AS column_name
   FROM information_schema.columns c
     JOIN pg_class cl ON cl.relname = c.table_name::name
     JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = c.table_schema::name
  WHERE c.table_schema::name = 'public'::name AND (cl.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char"])) AND has_admin_access(auth.uid());
create or replace view public.audit_db_functions with (security_invoker=true) as  SELECT p.proname::text AS name,
    COALESCE(array_to_string(p.proargnames, ','::text), ''::text) AS args
   FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'::name AND has_admin_access(auth.uid());
create or replace view public.career_role_wages with (security_invoker=true) as  SELECT r.slug,
    r.title,
    r.category,
    r.mapping_note,
    r.source,
    o.soc_code,
    o.occupation_title,
    o.employment,
    o.annual_mean,
    o.pct10,
    o.pct25,
    o.median,
    o.pct75,
    o.pct90,
    o.reference_period,
    o.source_name,
    o.source_url
   FROM career_roles r
     JOIN bls_occupations o ON o.soc_code = r.soc_code;
create or replace view public.course_statistics with (security_invoker=on) as  SELECT c.id,
    c.title,
    c.difficulty_level,
    c.estimated_hours,
    c.published,
    c.status,
    c.enrollment_status,
    count(DISTINCT m.id) AS module_count,
    count(DISTINCT e.id) AS enrollment_count,
    count(DISTINCT a.id) AS assignment_count,
    count(DISTINCT l.id) AS lesson_count
   FROM courses c
     LEFT JOIN modules m ON c.id = m.course_id
     LEFT JOIN enrollments e ON c.id = e.course_id
     LEFT JOIN content_items ci ON c.id = ci.course_id AND ci.type = 'assignment'::content_item_type
     LEFT JOIN assignments a ON ci.id = a.content_item_id
     LEFT JOIN lessons l ON m.id = l.module_id
  GROUP BY c.id, c.title, c.difficulty_level, c.estimated_hours, c.published, c.status, c.enrollment_status;
create or replace view public.coursera_crawl_progress with (security_invoker=true) as  SELECT coursera_crawl_queue.state,
    coursera_crawl_queue.source,
    count(*) AS urls,
    min(coursera_crawl_queue.enqueued_at) AS oldest_enqueued_at,
    max(coursera_crawl_queue.processed_at) AS newest_processed_at
   FROM coursera_crawl_queue
  GROUP BY coursera_crawl_queue.state, coursera_crawl_queue.source;
create or replace view public.quiz_analytics with (security_invoker=on) as  SELECT quiz_analytics.day,
    quiz_analytics.total_attempts,
    quiz_analytics.unique_users,
    quiz_analytics.unique_sessions,
    quiz_analytics.ai_ml_recommendations,
    quiz_analytics.analytics_recommendations,
    quiz_analytics.data_engineering_recommendations,
    quiz_analytics.bi_recommendations
   FROM quiz_analytics;
create or replace view public.user_conversations with (security_invoker=on) as  SELECT c.id,
    c.subject,
    c.is_group,
    c.created_by,
    c.updated_at,
    c.created_at,
    c.archived,
    c.deleted_at
   FROM conversations c
     JOIN conversation_participants cp ON c.id = cp.conversation_id
  WHERE cp.user_id = auth.uid() AND c.deleted_at IS NULL;
