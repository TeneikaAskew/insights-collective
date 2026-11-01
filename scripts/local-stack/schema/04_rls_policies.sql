alter table public.action_plan_progress enable row level security;
alter table public.admin_actions enable row level security;
alter table public.assesment_rubric enable row level security;
alter table public.assessment_areas enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.assignment_rubrics enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignments enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.availability_slots enable row level security;
alter table public.blog_analytics enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_media enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_post_versions enable row level security;
alter table public.blog_post_views enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_settings enable row level security;
alter table public.blog_tags enable row level security;
alter table public.bls_occupations enable row level security;
alter table public.career_pathway_answers enable row level security;
alter table public.career_pathway_results enable row level security;
alter table public.career_quiz_attempts enable row level security;
alter table public.career_roles enable row level security;
alter table public.certificate_verification_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.code_attempts enable row level security;
alter table public.code_challenges enable row level security;
alter table public.content_discussion_upvotes enable row level security;
alter table public.content_discussions enable row level security;
alter table public.content_item_progressions enable row level security;
alter table public.content_items enable row level security;
alter table public.content_progress enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversations enable row level security;
alter table public.course_announcements enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_feedback enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_material_files enable row level security;
alter table public.course_material_folders enable row level security;
alter table public.course_wishlists enable row level security;
alter table public.coursera_courses enable row level security;
alter table public.coursera_crawl_queue enable row level security;
alter table public.coursera_subject_keywords enable row level security;
alter table public.courses enable row level security;
alter table public.cron_job_logs enable row level security;
alter table public.debug_token_attempts enable row level security;
alter table public.enrollments enable row level security;
alter table public.event_registrations enable row level security;
alter table public.events enable row level security;
alter table public.form_submissions enable row level security;
alter table public.forms enable row level security;
alter table public.forums enable row level security;
alter table public.grade_change_notifications enable row level security;
alter table public.grade_history enable row level security;
alter table public.grades enable row level security;
alter table public.grading_sessions enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.lesson_completion_requirements enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lessons enable row level security;
alter table public.linkedin_posts enable row level security;
alter table public.messages enable row level security;
alter table public.mock_sessions enable row level security;
alter table public.module_content enable row level security;
alter table public.module_progress enable row level security;
alter table public.module_progressions enable row level security;
alter table public.modules enable row level security;
alter table public.no_show_reports enable row level security;
alter table public.notification_email_log enable row level security;
alter table public.notifications enable row level security;
alter table public.page_visibility enable row level security;
alter table public.peer_reviews enable row level security;
alter table public.portfolio enable row level security;
alter table public.portfolio_page_projects enable row level security;
alter table public.portfolio_pages enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.project_status enable row level security;
alter table public.question_bank_categories enable row level security;
alter table public.question_bank_questions enable row level security;
alter table public.question_banks enable row level security;
alter table public.question_category_links enable row level security;
alter table public.quiz_attempt_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_question_pools enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_submission_answers enable row level security;
alter table public.quiz_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.resources enable row level security;
alter table public.resumes enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.rubrics enable row level security;
alter table public.scrape_metadata enable row level security;
alter table public.security_events enable row level security;
alter table public.star_responses enable row level security;
alter table public.study_guides enable row level security;
alter table public.submission_attachments enable row level security;
alter table public.submission_audit_events enable row level security;
alter table public.submission_comments enable row level security;
alter table public.survey_drafts enable row level security;
alter table public.thread_read_status enable row level security;
alter table public.thread_subscriptions enable row level security;
alter table public.threads enable row level security;
alter table public.tweets enable row level security;
alter table public.user_assessments enable row level security;
alter table public.user_feedback enable row level security;
alter table public.user_roles enable row level security;
alter table public.video_analytics enable row level security;

create policy "Users can delete their own action plan progress" on public.action_plan_progress as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own action plan progress" on public.action_plan_progress as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own action plan progress" on public.action_plan_progress as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own action plan progress" on public.action_plan_progress as permissive for SELECT to public using ((auth.uid() = user_id));
create policy admin_actions_admin_only on public.admin_actions as permissive for ALL to authenticated using (has_admin_access(auth.uid()));
create policy "Authenticated users can view assessment rubric" on public.assesment_rubric as permissive for SELECT to authenticated using (true);
create policy "Authenticated users can view assessment areas" on public.assessment_areas as permissive for SELECT to authenticated using (true);
create policy "Authenticated users can view assessment questions" on public.assessment_questions as permissive for SELECT to authenticated using (true);
create policy "Users can insert their own assessment sessions" on public.assessment_sessions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own assessment sessions" on public.assessment_sessions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own assessment sessions" on public.assessment_sessions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can create their own assignment progress" on public.assignment_progress as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own assignment progress" on public.assignment_progress as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own assignment progress" on public.assignment_progress as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can manage assignment rubrics" on public.assignment_rubrics as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM (rubrics r
     JOIN courses c ON ((c.id = r.course_id)))
  WHERE ((r.id = assignment_rubrics.rubric_id) AND ((c.instructor_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))))))));
create policy "Students can submit their own assignments" on public.assignment_submissions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Students can update their own submissions" on public.assignment_submissions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Students can view their own submissions" on public.assignment_submissions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can access submissions" on public.assignment_submissions as permissive for ALL to authenticated using (can_access_submission(auth.uid(), id));
create policy "Instructors can delete assignments" on public.assignments as permissive for DELETE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = assignments.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can insert assignments" on public.assignments as permissive for INSERT to authenticated with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = assignments.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can select assignments" on public.assignments as permissive for SELECT to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = assignments.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can update assignments" on public.assignments as permissive for UPDATE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = assignments.course_id) AND (c.instructor_id = auth.uid())))))) with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = assignments.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Users can access assignments" on public.assignments as permissive for ALL to authenticated using (can_access_assignment(auth.uid(), id));
create policy assistant_conversations_insert on public.assistant_conversations as permissive for INSERT to public with check ((((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((user_id IS NULL) AND (session_id = ((current_setting('request.headers'::text, true))::json ->> 'session-id'::text)))));
create policy assistant_conversations_select on public.assistant_conversations as permissive for SELECT to public using ((((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((user_id IS NULL) AND (session_id = ((current_setting('request.headers'::text, true))::json ->> 'session-id'::text)))));
create policy assistant_messages_insert on public.assistant_messages as permissive for INSERT to public with check ((conversation_id IN ( SELECT assistant_conversations.id
   FROM assistant_conversations)));
create policy assistant_messages_select on public.assistant_messages as permissive for SELECT to public using ((conversation_id IN ( SELECT assistant_conversations.id
   FROM assistant_conversations)));
create policy "Admin can view all audit logs" on public.audit_logs as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))));
create policy audit_logs_admin_only on public.audit_logs as permissive for SELECT to authenticated using (has_admin_access(auth.uid()));
create policy "Users can delete their own availability slots" on public.availability_slots as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own availability slots" on public.availability_slots as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own availability slots" on public.availability_slots as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own availability slots" on public.availability_slots as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Authors can view their post analytics" on public.blog_analytics as permissive for SELECT to public using (((auth.uid() IN ( SELECT blog_posts.author_id
   FROM blog_posts
  WHERE (blog_posts.id = blog_analytics.blog_post_id))) OR (auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles))))));
create policy "Admins can manage categories" on public.blog_categories as permissive for ALL to authenticated using (has_admin_access(auth.uid())) with check (has_admin_access(auth.uid()));
create policy "Anyone can view categories" on public.blog_categories as permissive for SELECT to public using (true);
create policy "Categories are viewable by everyone" on public.blog_categories as permissive for SELECT to public using (true);
create policy "Only admins can delete categories" on public.blog_categories as permissive for DELETE to public using ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles)))));
create policy "Only admins can insert categories" on public.blog_categories as permissive for INSERT to public with check ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles)))));
create policy "Only admins can update categories" on public.blog_categories as permissive for UPDATE to public using ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles)))));
create policy blog_categories_admin_access on public.blog_categories as permissive for ALL to authenticated using (has_admin_access(auth.uid()));
create policy "Approved comments are viewable by everyone" on public.blog_comments as permissive for SELECT to public using (((is_approved = true) OR (author_id = auth.uid())));
create policy "Authenticated users can create comments" on public.blog_comments as permissive for INSERT to public with check ((auth.uid() = author_id));
create policy "Users can delete their own comments" on public.blog_comments as permissive for DELETE to public using (((auth.uid() = author_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles))))));
create policy "Users can update their own comments" on public.blog_comments as permissive for UPDATE to public using ((auth.uid() = author_id));
create policy "Media is viewable by everyone" on public.blog_media as permissive for SELECT to public using (true);
create policy "Users can delete their own media" on public.blog_media as permissive for DELETE to public using (((auth.uid() = author_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles))))));
create policy "Users can update their own media" on public.blog_media as permissive for UPDATE to public using (((auth.uid() = author_id) OR (auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles))))));
create policy "Users can upload media" on public.blog_media as permissive for INSERT to public with check ((auth.uid() = author_id));
create policy "Admins can manage all tags" on public.blog_post_tags as permissive for ALL to authenticated using (has_admin_access(auth.uid())) with check (has_admin_access(auth.uid()));
create policy "Anyone can view tags" on public.blog_post_tags as permissive for SELECT to public using (true);
create policy "Authors can manage tags for their posts" on public.blog_post_tags as permissive for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM blog_posts
  WHERE ((blog_posts.id = blog_post_tags.blog_post_id) AND (blog_posts.author_id = auth.uid())))));
create policy "Authors can manage their post tags" on public.blog_post_tags as permissive for ALL to public using ((auth.uid() IN ( SELECT blog_posts.author_id
   FROM blog_posts
  WHERE (blog_posts.id = blog_post_tags.blog_post_id))));
create policy "Post tags are viewable by everyone" on public.blog_post_tags as permissive for SELECT to public using (true);
create policy blog_post_tags_admin_access on public.blog_post_tags as permissive for ALL to authenticated using (has_admin_access(auth.uid()));
create policy "Authors can create post versions" on public.blog_post_versions as permissive for INSERT to public with check ((auth.uid() IN ( SELECT blog_posts.author_id
   FROM blog_posts
  WHERE (blog_posts.id = blog_post_versions.blog_post_id))));
create policy "Authors can view their post versions" on public.blog_post_versions as permissive for SELECT to public using (((auth.uid() IN ( SELECT blog_posts.author_id
   FROM blog_posts
  WHERE (blog_posts.id = blog_post_versions.blog_post_id))) OR (auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles))))));
create policy "Admins can view all analytics" on public.blog_post_views as permissive for SELECT to authenticated using (has_admin_access(auth.uid()));
create policy "Anyone can insert views" on public.blog_post_views as permissive for INSERT to public with check (true);
create policy "Authors can view stats for their posts" on public.blog_post_views as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM blog_posts
  WHERE ((blog_posts.id = blog_post_views.post_id) AND (blog_posts.author_id = auth.uid())))));
create policy blog_post_views_admin_access on public.blog_post_views as permissive for SELECT to authenticated using (has_admin_access(auth.uid()));
create policy "Admins can manage all blog posts" on public.blog_posts as permissive for ALL to authenticated using (has_admin_access(auth.uid())) with check (has_admin_access(auth.uid()));
create policy "Authors admins instructors can view posts" on public.blog_posts as permissive for SELECT to authenticated using (((author_id = auth.uid()) OR has_admin_access(auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid())))));
create policy "Instructors and admins manage own posts" on public.blog_posts as permissive for ALL to authenticated using (((author_id = auth.uid()) AND (has_admin_access(auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid())))))) with check (((author_id = auth.uid()) AND (has_admin_access(auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid()))))));
create policy "Public can view published blog posts" on public.blog_posts as permissive for SELECT to public using ((status = 'published'::text));
create policy blog_posts_admin_access on public.blog_posts as permissive for ALL to authenticated using (has_admin_access(auth.uid()));
create policy "Admins can manage blog settings" on public.blog_settings as permissive for ALL to public using (has_admin_access(auth.uid()));
create policy "Anyone can view blog settings" on public.blog_settings as permissive for SELECT to public using (true);
create policy "Authenticated users can create tags" on public.blog_tags as permissive for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy "Only admins can delete tags" on public.blog_tags as permissive for DELETE to public using ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles)))));
create policy "Only admins can update tags" on public.blog_tags as permissive for UPDATE to public using ((auth.uid() IN ( SELECT profiles.id
   FROM profiles
  WHERE ('admin'::text = ANY (profiles.roles)))));
create policy "Tags are viewable by everyone" on public.blog_tags as permissive for SELECT to public using (true);
create policy "BLS occupations are publicly readable" on public.bls_occupations as permissive for SELECT to anon, authenticated using (true);
create policy "Users can insert their own answers" on public.career_pathway_answers as permissive for INSERT to public with check ((user_id = auth.uid()));
create policy "Users can insert their own career pathway answers" on public.career_pathway_answers as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can select their own answers" on public.career_pathway_answers as permissive for SELECT to public using ((user_id = auth.uid()));
create policy "Users can update their own answers" on public.career_pathway_answers as permissive for UPDATE to public using ((user_id = auth.uid()));
create policy "Users can view their own career pathway answers" on public.career_pathway_answers as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can delete their own career assessment responses" on public.career_pathway_results as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own career assessment responses" on public.career_pathway_results as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can insert their own career pathway results" on public.career_pathway_results as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own career assessment responses" on public.career_pathway_results as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own career assessment responses" on public.career_pathway_results as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can view their own career pathway results" on public.career_pathway_results as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can insert their own quiz attempts" on public.career_quiz_attempts as permissive for INSERT to public with check (((auth.uid() = user_id) OR (session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))));
create policy "Users can view their own quiz attempts" on public.career_quiz_attempts as permissive for SELECT to public using (((auth.uid() = user_id) OR (session_id = ((current_setting('request.headers'::text))::json ->> 'session-id'::text))));
create policy "Career roles are publicly readable" on public.career_roles as permissive for SELECT to anon, authenticated using (true);
create policy "service role manages verify attempts" on public.certificate_verification_attempts as permissive for ALL to service_role using (true) with check (true);
create policy "Admins and instructors can revoke certificates" on public.certificates as permissive for DELETE to authenticated using ((has_admin_access(auth.uid()) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = certificates.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Admins and instructors can view certificates" on public.certificates as permissive for SELECT to authenticated using ((has_admin_access(auth.uid()) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = certificates.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Course staff can issue certificates for their courses" on public.certificates as permissive for INSERT to authenticated with check ((has_admin_access(auth.uid()) OR can_manage_course_content(auth.uid(), course_id)));
create policy "Users can delete their own certificates" on public.certificates as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can view their own certificates" on public.certificates as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can insert their own code attempts" on public.code_attempts as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own code attempts" on public.code_attempts as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own code attempts" on public.code_attempts as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Anyone can view code challenges" on public.code_challenges as permissive for SELECT to public using (true);
create policy "Authenticated users can read code challenges" on public.code_challenges as permissive for SELECT to authenticated using (true);
create policy "Users can manage own upvotes" on public.content_discussion_upvotes as permissive for ALL to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view discussion upvotes" on public.content_discussion_upvotes as permissive for SELECT to public using (true);
create policy "Instructors can manage course discussions" on public.content_discussions as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM ((content_items ci
     JOIN courses c ON ((ci.course_id = c.id)))
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((ci.id = content_discussions.content_item_id) AND ((c.instructor_id = auth.uid()) OR (p.roles @> ARRAY['admin'::text, 'instructor'::text]))))));
create policy "Users can create content discussions" on public.content_discussions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can delete own content discussions" on public.content_discussions as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can update own content discussions" on public.content_discussions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view content discussions" on public.content_discussions as permissive for SELECT to public using (((is_hidden = false) AND (EXISTS ( SELECT 1
   FROM content_items ci
  WHERE (ci.id = content_discussions.content_item_id)))));
create policy "Instructors can view course progressions" on public.content_item_progressions as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = content_item_progressions.content_item_id) AND ((c.instructor_id = auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid()))) OR ('admin'::app_role = ANY (get_user_roles(auth.uid()))))))));
create policy "Users can delete their own content item progressions" on public.content_item_progressions as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own content item progressions" on public.content_item_progressions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own content item progressions" on public.content_item_progressions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own content item progressions" on public.content_item_progressions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can delete content items" on public.content_items as permissive for DELETE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = content_items.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can insert content items" on public.content_items as permissive for INSERT to authenticated with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = content_items.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can read their content items" on public.content_items as permissive for SELECT to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = content_items.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can update content items" on public.content_items as permissive for UPDATE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = content_items.course_id) AND (c.instructor_id = auth.uid())))))) with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = content_items.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Users can read content items" on public.content_items as permissive for SELECT to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR can_manage_course_content(auth.uid(), course_id) OR ((published = true) AND (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.course_id = content_items.course_id) AND (e.user_id = auth.uid())))))));
create policy "Users manage own content progress" on public.content_progress as permissive for ALL to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "No participant updates allowed" on public.conversation_participants as permissive for UPDATE to public using (false);
create policy "Users can view their conversation participations" on public.conversation_participants as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy conversation_participants_leave on public.conversation_participants as permissive for DELETE to public using (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
create policy conversations_creator_delete on public.conversations as permissive for DELETE to public using ((created_by = auth.uid()));
create policy conversations_creator_select on public.conversations as permissive for SELECT to public using ((created_by = auth.uid()));
create policy conversations_creator_update on public.conversations as permissive for UPDATE to public using ((created_by = auth.uid())) with check ((created_by = auth.uid()));
create policy conversations_participant_access on public.conversations as permissive for SELECT to authenticated using (is_conversation_participant(auth.uid(), id));
create policy course_announcements_delete on public.course_announcements as permissive for DELETE to public using (((created_by = auth.uid()) OR (author_id = auth.uid()) OR has_admin_access(auth.uid())));
create policy course_announcements_insert on public.course_announcements as permissive for INSERT to public with check (can_manage_course_materials(auth.uid(), course_id));
create policy course_announcements_select on public.course_announcements as permissive for SELECT to public using ((can_access_course_materials(auth.uid(), course_id) OR has_role(auth.uid(), 'instructor'::app_role)));
create policy course_announcements_update on public.course_announcements as permissive for UPDATE to public using (((created_by = auth.uid()) OR (author_id = auth.uid()) OR has_admin_access(auth.uid()))) with check (((created_by = auth.uid()) OR (author_id = auth.uid()) OR has_admin_access(auth.uid())));
create policy "Admins can manage course assignments" on public.course_assignments as permissive for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))));
create policy "Users can view their own assignments" on public.course_assignments as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy "Admins delete feedback" on public.course_feedback as permissive for DELETE to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins update feedback" on public.course_feedback as permissive for UPDATE to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Users insert own feedback" on public.course_feedback as permissive for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users read own feedback" on public.course_feedback as permissive for SELECT to authenticated using (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
create policy "Admins can manage course instructors" on public.course_instructors as permissive for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))));
create policy "Users can view their instructor assignments" on public.course_instructors as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy materials_files_manage on public.course_material_files as permissive for ALL to authenticated using (can_manage_course_materials(auth.uid(), course_id)) with check (can_manage_course_materials(auth.uid(), course_id));
create policy materials_files_select on public.course_material_files as permissive for SELECT to authenticated using (can_access_course_materials(auth.uid(), course_id));
create policy materials_folders_manage on public.course_material_folders as permissive for ALL to authenticated using (can_manage_course_materials(auth.uid(), course_id)) with check (can_manage_course_materials(auth.uid(), course_id));
create policy materials_folders_select on public.course_material_folders as permissive for SELECT to authenticated using (can_access_course_materials(auth.uid(), course_id));
create policy "Users can add courses to their wishlist" on public.course_wishlists as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can manage their wishlists" on public.course_wishlists as permissive for ALL to public using ((auth.uid() = user_id));
create policy "Users can remove courses from their wishlist" on public.course_wishlists as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can view their own wishlisted courses" on public.course_wishlists as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can view their own wishlists" on public.course_wishlists as permissive for SELECT to public using ((auth.uid() = user_id));
create policy coursera_courses_admin_read_all on public.coursera_courses as permissive for SELECT to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy coursera_courses_admin_write on public.coursera_courses as permissive for UPDATE to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy coursera_courses_public_read on public.coursera_courses as permissive for SELECT to anon, authenticated using ((status = 'active'::text));
create policy coursera_crawl_queue_admin_read on public.coursera_crawl_queue as permissive for SELECT to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy coursera_subject_keywords_public_read on public.coursera_subject_keywords as permissive for SELECT to anon, authenticated using (true);
create policy "Anyone can view published courses" on public.courses as permissive for SELECT to public using (((published = true) OR (auth.uid() = instructor_id)));
create policy "Instructors can insert courses" on public.courses as permissive for INSERT to authenticated with check ((auth.uid() = instructor_id));
create policy "Instructors can update own courses" on public.courses as permissive for UPDATE to authenticated using ((auth.uid() = instructor_id));
create policy courses_admin_full_access on public.courses as permissive for ALL to authenticated using (has_admin_access(auth.uid()));
create policy courses_creator_access on public.courses as permissive for ALL to authenticated using ((instructor_id = auth.uid()));
create policy courses_instructor_assigned_access on public.courses as permissive for ALL to authenticated using (is_course_instructor(auth.uid(), id));
create policy courses_public_read_published on public.courses as permissive for SELECT to public using ((published = true));
create policy "Admins can view cron job logs" on public.cron_job_logs as permissive for SELECT to public using (('admin'::app_role = ANY (get_user_roles(auth.uid()))));
create policy debug_token_attempts_admin_only on public.debug_token_attempts as permissive for ALL to public using (has_admin_access(auth.uid()));
create policy "Users can enroll themselves" on public.enrollments as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can view their own enrollments" on public.enrollments as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy enrollments_staff_select on public.enrollments as permissive for SELECT to authenticated using ((has_admin_access(auth.uid()) OR is_course_instructor(auth.uid(), course_id)));
create policy "Users can register themselves" on public.event_registrations as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can view their own registrations" on public.event_registrations as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Admins can manage all events" on public.events as permissive for ALL to public using (has_admin_access(auth.uid()));
create policy "Events are viewable by everyone" on public.events as permissive for SELECT to public using (true);
create policy events_staff_insert on public.events as permissive for INSERT to authenticated with check ((has_admin_access(auth.uid()) OR ((course_id IS NOT NULL) AND is_course_instructor(auth.uid(), course_id))));
create policy "Users can create own submissions" on public.form_submissions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update own submissions" on public.form_submissions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view own submissions" on public.form_submissions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy form_submissions_admin_override on public.form_submissions as permissive for SELECT to authenticated using (has_admin_access(auth.uid()));
create policy "Admins can do everything with forms" on public.forms as permissive for ALL to authenticated using (('admin'::app_role = ANY (get_user_roles(auth.uid())))) with check (('admin'::app_role = ANY (get_user_roles(auth.uid()))));
create policy "All users can view active forms" on public.forms as permissive for SELECT to public using ((status = true));
create policy "Anyone can view forums" on public.forums as permissive for SELECT to public using (true);
create policy "Students manage own grade notifications" on public.grade_change_notifications as permissive for ALL to public using ((student_id = auth.uid()));
create policy "Course staff view grade history" on public.grade_history as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM course_assignments ca
  WHERE ((ca.course_id = grade_history.course_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Students view own grade history" on public.grade_history as permissive for SELECT to public using ((student_id = auth.uid()));
create policy "Course staff manage grades" on public.grades as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM course_assignments ca
  WHERE ((ca.course_id = grades.course_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Students view own grades" on public.grades as permissive for SELECT to public using ((student_id = auth.uid()));
create policy "Graders manage own sessions" on public.grading_sessions as permissive for ALL to public using ((grader_id = auth.uid()));
create policy "Users can delete their own job descriptions" on public.job_descriptions as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own job descriptions" on public.job_descriptions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own job descriptions" on public.job_descriptions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own job descriptions" on public.job_descriptions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Authenticated users read lesson requirements" on public.lesson_completion_requirements as permissive for SELECT to authenticated using (true);
create policy "Course instructors manage lesson requirements" on public.lesson_completion_requirements as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM ((lessons l
     JOIN modules m ON ((m.id = l.module_id)))
     JOIN course_assignments ca ON ((ca.course_id = m.course_id)))
  WHERE ((l.id = lesson_completion_requirements.lesson_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Course instructors view lesson completions" on public.lesson_completions as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM ((lessons l
     JOIN modules m ON ((m.id = l.module_id)))
     JOIN course_assignments ca ON ((ca.course_id = m.course_id)))
  WHERE ((l.id = lesson_completions.lesson_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Users manage own lesson completions" on public.lesson_completions as permissive for ALL to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can insert their own lesson progress" on public.lesson_progress as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own lesson progress" on public.lesson_progress as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own lesson progress" on public.lesson_progress as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Anyone can view lessons of published courses" on public.lessons as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM (modules m
     JOIN courses c ON ((m.course_id = c.id)))
  WHERE ((m.id = lessons.module_id) AND ((c.published = true) OR (c.instructor_id = auth.uid()))))));
create policy "Allow public read access to LinkedIn posts" on public.linkedin_posts as permissive for SELECT to public using (true);
create policy "Users can view their own messages" on public.messages as permissive for SELECT to authenticated using (((sender_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))));
create policy messages_conversation_participant_access on public.messages as permissive for SELECT to authenticated using (is_conversation_participant(auth.uid(), conversation_id));
create policy messages_delete_own on public.messages as permissive for DELETE to authenticated using ((sender_id = auth.uid()));
create policy messages_insert_participant on public.messages as permissive for INSERT to authenticated with check (((sender_id = auth.uid()) AND is_conversation_participant(auth.uid(), conversation_id)));
create policy messages_update_own on public.messages as permissive for UPDATE to authenticated using ((sender_id = auth.uid())) with check (((sender_id = auth.uid()) AND is_conversation_participant(auth.uid(), conversation_id)));
create policy "Users can delete mock sessions they're part of" on public.mock_sessions as permissive for DELETE to public using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));
create policy "Users can insert mock sessions they're part of" on public.mock_sessions as permissive for INSERT to public with check ((auth.uid() = user1_id));
create policy "Users can update mock sessions they're part of" on public.mock_sessions as permissive for UPDATE to public using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));
create policy "Users can view their own mock sessions" on public.mock_sessions as permissive for SELECT to public using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));
create policy "Anyone can view module content" on public.module_content as permissive for SELECT to public using (true);
create policy "Everyone can view module content" on public.module_content as permissive for SELECT to public using (true);
create policy "Only content creators can manage content" on public.module_content as permissive for ALL to public using ((uploaded_by = auth.uid()));
create policy "Users can create their own module progress" on public.module_progress as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own module progress" on public.module_progress as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own module progress" on public.module_progress as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can view module progressions" on public.module_progressions as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM (modules m
     JOIN courses c ON ((c.id = m.course_id)))
  WHERE ((m.id = module_progressions.module_id) AND ((c.instructor_id = auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid()))) OR ('admin'::app_role = ANY (get_user_roles(auth.uid()))))))));
create policy "Users can insert their own module progressions" on public.module_progressions as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own module progressions" on public.module_progressions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own module progressions" on public.module_progressions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can delete modules" on public.modules as permissive for DELETE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = modules.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can insert modules" on public.modules as permissive for INSERT to authenticated with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = modules.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can read their modules" on public.modules as permissive for SELECT to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = modules.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can update modules" on public.modules as permissive for UPDATE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = modules.course_id) AND (c.instructor_id = auth.uid())))))) with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = modules.course_id) AND (c.instructor_id = auth.uid()))))));
create policy "Public can view published modules in published courses" on public.modules as permissive for SELECT to public using (((published = true) AND (EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = modules.course_id) AND (courses.published = true))))));
create policy "Users can read modules they can access" on public.modules as permissive for SELECT to authenticated using (can_access_module(auth.uid(), id));
create policy "Admins can view and manage reports" on public.no_show_reports as permissive for ALL to public using (('admin'::app_role = ANY (get_user_roles(auth.uid()))));
create policy "Reporters can view their own reports" on public.no_show_reports as permissive for SELECT to public using ((reporter_id = auth.uid()));
create policy "Users can file reports about their own sessions" on public.no_show_reports as permissive for INSERT to public with check (((reporter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM mock_sessions s
  WHERE ((s.id = no_show_reports.session_id) AND ((s.user1_id = auth.uid()) OR (s.user2_id = auth.uid())))))));
create policy "Admins can read notification email log" on public.notification_email_log as permissive for SELECT to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can delete own notifications" on public.notifications as permissive for DELETE to authenticated using ((auth.uid() = user_id));
create policy "Users can update own notifications" on public.notifications as permissive for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "Users can view own notifications" on public.notifications as permissive for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Admins can manage page visibility" on public.page_visibility as permissive for ALL to public using (has_admin_access(auth.uid()));
create policy "Allow all authenticated users to read visibility settings" on public.page_visibility as permissive for SELECT to authenticated using (true);
create policy "Everyone can view page visibility" on public.page_visibility as permissive for SELECT to public using (true);
create policy "Users can insert their own peer reviews" on public.peer_reviews as permissive for INSERT to public with check ((auth.uid() = reviewer_id));
create policy "Users can update their own peer reviews" on public.peer_reviews as permissive for UPDATE to public using ((auth.uid() = reviewer_id));
create policy "Users can view peer reviews they're involved in" on public.peer_reviews as permissive for SELECT to public using (((auth.uid() = reviewer_id) OR (auth.uid() = reviewee_id)));
create policy "Users can delete their own portfolio responses" on public.portfolio as permissive for DELETE to public using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users can insert their own portfolio responses" on public.portfolio as permissive for INSERT to authenticated with check ((auth.uid() = user_id));
create policy "Users can update their own portfolio responses" on public.portfolio as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own portfolio responses" on public.portfolio as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Public read" on public.portfolio_page_projects as permissive for SELECT to public using (true);
create policy "Users can manage their own portfolio page projects" on public.portfolio_page_projects as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM portfolio_pages
  WHERE ((portfolio_pages.id = portfolio_page_projects.portfolio_page_id) AND (portfolio_pages.user_id = auth.uid())))));
create policy "Public can view published portfolio pages" on public.portfolio_pages as permissive for SELECT to public using ((is_public = true));
create policy "Users can delete their own portfolio pages" on public.portfolio_pages as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own portfolio pages" on public.portfolio_pages as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own portfolio pages" on public.portfolio_pages as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own portfolio pages" on public.portfolio_pages as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Public read" on public.portfolio_projects as permissive for SELECT to public using (true);
create policy "Users can delete their own portfolio projects" on public.portfolio_projects as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own portfolio projects" on public.portfolio_projects as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own portfolio projects" on public.portfolio_projects as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own portfolio projects" on public.portfolio_projects as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Anyone can view posts" on public.posts as permissive for SELECT to public using (true);
create policy "Users can create posts" on public.posts as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own posts" on public.posts as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can insert own profile" on public.profiles as permissive for INSERT to authenticated with check ((auth.uid() = id));
create policy "Users can update own profile" on public.profiles as permissive for UPDATE to authenticated using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can view allowed profiles" on public.profiles as permissive for SELECT to authenticated using (can_view_profile(auth.uid(), id));
create policy "Users can create their own progress" on public.progress as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can delete their own progress" on public.progress as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can update their own progress" on public.progress as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own progress" on public.progress as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can view own progress snapshots" on public.progress_snapshots as permissive for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Users can delete status of their own projects" on public.project_status as permissive for DELETE to public using ((( SELECT portfolio_projects.user_id
   FROM portfolio_projects
  WHERE (portfolio_projects.id = project_status.project_id)) = auth.uid()));
create policy "Users can insert status for their own projects" on public.project_status as permissive for INSERT to public with check ((( SELECT portfolio_projects.user_id
   FROM portfolio_projects
  WHERE (portfolio_projects.id = project_status.project_id)) = auth.uid()));
create policy "Users can update status of their own projects" on public.project_status as permissive for UPDATE to public using ((( SELECT portfolio_projects.user_id
   FROM portfolio_projects
  WHERE (portfolio_projects.id = project_status.project_id)) = auth.uid()));
create policy "Users can view status of their own projects" on public.project_status as permissive for SELECT to public using ((( SELECT portfolio_projects.user_id
   FROM portfolio_projects
  WHERE (portfolio_projects.id = project_status.project_id)) = auth.uid()));
create policy "Instructors can manage question bank categories" on public.question_bank_categories as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM (question_banks qb
     JOIN courses c ON ((c.id = qb.course_id)))
  WHERE ((qb.id = question_bank_categories.bank_id) AND ((c.instructor_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))))))));
create policy "Instructors can manage questions" on public.question_bank_questions as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM (question_banks qb
     JOIN courses c ON ((c.id = qb.course_id)))
  WHERE ((qb.id = question_bank_questions.bank_id) AND ((c.instructor_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))))))));
create policy "Instructors can manage question banks" on public.question_banks as permissive for ALL to public using (((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = question_banks.course_id) AND (courses.instructor_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles)))))));
create policy "Students can view question banks" on public.question_banks as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = question_banks.course_id) AND (enrollments.user_id = auth.uid())))));
create policy "Category links follow question access" on public.question_category_links as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM ((question_bank_questions qbq
     JOIN question_banks qb ON ((qb.id = qbq.bank_id)))
     JOIN course_assignments ca ON ((ca.course_id = qb.course_id)))
  WHERE ((qbq.id = question_category_links.question_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Users can view their own attempt questions" on public.quiz_attempt_questions as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM quiz_attempts qa
  WHERE ((qa.id = quiz_attempt_questions.attempt_id) AND (qa.user_id = auth.uid())))));
create policy "Users can create their own quiz attempts" on public.quiz_attempts as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can manage their own quiz attempts" on public.quiz_attempts as permissive for ALL to public using ((auth.uid() = user_id));
create policy "Users can view their own quiz attempts" on public.quiz_attempts as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can manage question pools" on public.quiz_question_pools as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM (((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN modules m ON ((m.id = ci.module_id)))
     JOIN course_assignments ca ON ((ca.course_id = m.course_id)))
  WHERE ((q.id = quiz_question_pools.quiz_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))));
create policy "Instructors can delete quiz_questions" on public.quiz_questions as permissive for DELETE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can insert quiz_questions" on public.quiz_questions as permissive for INSERT to authenticated with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can select quiz_questions" on public.quiz_questions as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND ((c.instructor_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));
create policy "Instructors can update quiz_questions" on public.quiz_questions as permissive for UPDATE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND (c.instructor_id = auth.uid())))))) with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_questions.quiz_id) AND (c.instructor_id = auth.uid()))))));
create policy quiz_questions_student_select on public.quiz_questions as permissive for SELECT to authenticated using (can_access_quiz_question(auth.uid(), id));
create policy "Instructors can view quiz submission answers" on public.quiz_submission_answers as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM (((quiz_submissions qs
     JOIN quizzes q ON ((q.id = qs.quiz_id)))
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((qs.id = quiz_submission_answers.quiz_submission_id) AND ((c.instructor_id = auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid()))) OR ('admin'::app_role = ANY (get_user_roles(auth.uid()))))))));
create policy "Users can create their own quiz submission answers" on public.quiz_submission_answers as permissive for INSERT to public with check ((EXISTS ( SELECT 1
   FROM quiz_submissions qs
  WHERE ((qs.id = quiz_submission_answers.quiz_submission_id) AND (qs.user_id = auth.uid())))));
create policy "Users can delete their own quiz submission answers" on public.quiz_submission_answers as permissive for DELETE to public using ((EXISTS ( SELECT 1
   FROM quiz_submissions qs
  WHERE ((qs.id = quiz_submission_answers.quiz_submission_id) AND (qs.user_id = auth.uid())))));
create policy "Users can update their own quiz submission answers" on public.quiz_submission_answers as permissive for UPDATE to public using ((EXISTS ( SELECT 1
   FROM quiz_submissions qs
  WHERE ((qs.id = quiz_submission_answers.quiz_submission_id) AND (qs.user_id = auth.uid())))));
create policy "Users can view their own quiz submission answers" on public.quiz_submission_answers as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM quiz_submissions qs
  WHERE ((qs.id = quiz_submission_answers.quiz_submission_id) AND (qs.user_id = auth.uid())))));
create policy "Instructors can view quiz submissions" on public.quiz_submissions as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM ((quizzes q
     JOIN content_items ci ON ((ci.id = q.content_item_id)))
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((q.id = quiz_submissions.quiz_id) AND ((c.instructor_id = auth.uid()) OR ('instructor'::app_role = ANY (get_user_roles(auth.uid()))) OR ('admin'::app_role = ANY (get_user_roles(auth.uid()))))))));
create policy "Users can update their own quiz submissions" on public.quiz_submissions as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own quiz submissions" on public.quiz_submissions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Instructors can delete quizzes" on public.quizzes as permissive for DELETE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = quizzes.content_item_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can insert quizzes" on public.quizzes as permissive for INSERT to authenticated with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = quizzes.content_item_id) AND (c.instructor_id = auth.uid()))))));
create policy "Instructors can select quizzes" on public.quizzes as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = quizzes.content_item_id) AND ((c.instructor_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))))));
create policy "Instructors can update quizzes" on public.quizzes as permissive for UPDATE to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = quizzes.content_item_id) AND (c.instructor_id = auth.uid())))))) with check ((has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM (content_items ci
     JOIN courses c ON ((c.id = ci.course_id)))
  WHERE ((ci.id = quizzes.content_item_id) AND (c.instructor_id = auth.uid()))))));
create policy "Users can access quizzes" on public.quizzes as permissive for ALL to authenticated using (can_access_quiz(auth.uid(), id));
create policy "Authenticated users can create resources" on public.resources as permissive for INSERT to public with check ((auth.role() = 'authenticated'::text));
create policy "Resources are viewable by everyone" on public.resources as permissive for SELECT to public using (true);
create policy "Users can delete their own resources" on public.resources as permissive for DELETE to public using (((auth.uid() = created_by) OR (auth.role() = 'admin'::text)));
create policy "Users can update their own resources" on public.resources as permissive for UPDATE to public using (((auth.uid() = created_by) OR (auth.role() = 'admin'::text))) with check (((auth.uid() = created_by) OR (auth.role() = 'admin'::text)));
create policy "Users can delete their own resumes" on public.resumes as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can update their own resume" on public.resumes as permissive for UPDATE to authenticated using ((user_id = auth.uid()));
create policy "Users can upload their own resume" on public.resumes as permissive for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Users can view their own resume" on public.resumes as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy "Instructors can manage rubric criteria" on public.rubric_criteria as permissive for ALL to public using ((EXISTS ( SELECT 1
   FROM (rubrics r
     JOIN courses c ON ((c.id = r.course_id)))
  WHERE ((r.id = rubric_criteria.rubric_id) AND ((c.instructor_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles))))))))));
create policy "Students can view rubric criteria" on public.rubric_criteria as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM (rubrics r
     JOIN enrollments e ON ((e.course_id = r.course_id)))
  WHERE ((r.id = rubric_criteria.rubric_id) AND (e.user_id = auth.uid())))));
create policy "Instructors can manage rubrics" on public.rubrics as permissive for ALL to public using (((EXISTS ( SELECT 1
   FROM courses
  WHERE ((courses.id = rubrics.course_id) AND (courses.instructor_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ('admin'::text = ANY (profiles.roles)))))));
create policy "Students can view rubrics" on public.rubrics as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM enrollments
  WHERE ((enrollments.course_id = rubrics.course_id) AND (enrollments.user_id = auth.uid())))));
create policy "Public read access for scrape_metadata" on public.scrape_metadata as permissive for SELECT to public using (true);
create policy security_events_admin_only on public.security_events as permissive for SELECT to authenticated using (has_admin_access(auth.uid()));
create policy "Users can delete their own STAR responses" on public.star_responses as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own STAR responses" on public.star_responses as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own STAR responses" on public.star_responses as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own STAR responses" on public.star_responses as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can delete their own study guides" on public.study_guides as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own study guides" on public.study_guides as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own study guides" on public.study_guides as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own study guides" on public.study_guides as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Students can add attachments to their own submissions" on public.submission_attachments as permissive for INSERT to public with check ((EXISTS ( SELECT 1
   FROM assignment_submissions s
  WHERE ((s.id = submission_attachments.submission_id) AND (s.user_id = auth.uid())))));
create policy "Students can delete attachments on their own submissions" on public.submission_attachments as permissive for DELETE to public using ((EXISTS ( SELECT 1
   FROM assignment_submissions s
  WHERE ((s.id = submission_attachments.submission_id) AND (s.user_id = auth.uid())))));
create policy "Users can view attachments on accessible submissions" on public.submission_attachments as permissive for SELECT to public using (can_access_submission(auth.uid(), submission_id));
create policy "Course staff can read the submission audit trail" on public.submission_audit_events as permissive for SELECT to authenticated using ((has_role(auth.uid(), 'admin'::app_role) OR can_manage_course_content(auth.uid(), course_id)));
create policy "Users create comments as themselves" on public.submission_comments as permissive for INSERT to public with check ((author_id = auth.uid()));
create policy "Users edit own comments" on public.submission_comments as permissive for UPDATE to public using ((author_id = auth.uid()));
create policy "Users view comments on their submissions" on public.submission_comments as permissive for SELECT to public using (((author_id = auth.uid()) OR ((submission_type = 'assignment'::text) AND (is_private = false) AND (EXISTS ( SELECT 1
   FROM assignment_submissions asub
  WHERE ((asub.id = submission_comments.submission_id) AND (asub.user_id = auth.uid()))))) OR ((submission_type = 'quiz'::text) AND (is_private = false) AND (EXISTS ( SELECT 1
   FROM quiz_attempts qa
  WHERE ((qa.id = submission_comments.submission_id) AND (qa.user_id = auth.uid()))))) OR ((submission_type = 'assignment'::text) AND (EXISTS ( SELECT 1
   FROM ((assignment_submissions asub
     JOIN assignments a ON ((a.id = asub.assignment_id)))
     JOIN course_assignments ca ON ((ca.course_id = a.course_id)))
  WHERE ((asub.id = submission_comments.submission_id) AND (ca.user_id = auth.uid()) AND (ca.role = ANY (ARRAY['instructor'::text, 'assistant'::text]))))))));
create policy "Users can create own drafts" on public.survey_drafts as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can delete own drafts" on public.survey_drafts as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can update own drafts" on public.survey_drafts as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view own drafts" on public.survey_drafts as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can manage their own read status" on public.thread_read_status as permissive for ALL to public using ((auth.uid() = user_id));
create policy "Users can manage their own subscriptions" on public.thread_subscriptions as permissive for ALL to public using ((auth.uid() = user_id));
create policy "Anyone can view threads" on public.threads as permissive for SELECT to public using (true);
create policy "Users can create threads in forums that allow it" on public.threads as permissive for INSERT to public with check (((EXISTS ( SELECT 1
   FROM forums
  WHERE ((forums.id = threads.forum_id) AND (forums.allow_create_threads = true)))) AND (auth.uid() = user_id)));
create policy "Users can update their own threads" on public.threads as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Public read access for tweets" on public.tweets as permissive for SELECT to public using (true);
create policy "Users can insert their own assessments" on public.user_assessments as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own assessments" on public.user_assessments as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own assessments" on public.user_assessments as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Users can insert feedback" on public.user_feedback as permissive for INSERT to authenticated with check (((auth.uid() = user_id) OR (user_id IS NULL)));
create policy "Users can update their own feedback" on public.user_feedback as permissive for UPDATE to authenticated using ((auth.uid() = user_id));
create policy "Users can view feedback" on public.user_feedback as permissive for SELECT to authenticated using (true);
create policy "Admins can view all roles" on public.user_roles as permissive for SELECT to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view own roles" on public.user_roles as permissive for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Instructors can view course video analytics" on public.video_analytics as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM ((content_items ci
     JOIN courses c ON ((ci.course_id = c.id)))
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((ci.id = video_analytics.content_item_id) AND ((c.instructor_id = auth.uid()) OR (p.roles @> ARRAY['admin'::text, 'instructor'::text]))))));
create policy "Users can insert own video analytics" on public.video_analytics as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update own video analytics" on public.video_analytics as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view own video analytics" on public.video_analytics as permissive for SELECT to public using ((auth.uid() = user_id));
