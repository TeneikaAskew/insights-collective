CREATE OR REPLACE FUNCTION public.admin_user_role_counts()
 RETURNS TABLE(total bigint, students bigint, instructors bigint, admins bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.user_roles WHERE role = 'student'::app_role),
    (SELECT count(*) FROM public.user_roles WHERE role = 'instructor'::app_role),
    (SELECT count(*) FROM public.user_roles WHERE role = 'admin'::app_role)
  WHERE public.has_admin_access(auth.uid());  -- admin gate (DEFINER)
$function$
;

CREATE OR REPLACE FUNCTION public.audit_invariants()
 RETURNS TABLE(check_name text, violations bigint, why text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT public.has_admin_access(auth.uid()) THEN
    RAISE EXCEPTION 'audit_invariants() requires admin access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  -- 21 accounts created 2025-05-07 → 2025-07-03 had no profile row, and no
  -- user_roles row either, so get_user_roles returned nothing for them. The
  -- on_auth_user_created trigger covers signups now, but nothing proves it is
  -- still firing — and since profiles carries foreign keys, a user without one
  -- cannot write a certificate, submission or discussion at all.
  SELECT
    'auth_users_without_profile'::text,
    count(*)::bigint,
    'handle_new_user may have stopped firing; these users cannot write to any table with a profiles FK'::text
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)

  UNION ALL
  SELECT
    'auth_users_without_role'::text,
    count(*)::bigint,
    'the same trigger assigns the default student role; without it the user has no permissions anywhere'::text
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)

  UNION ALL
  -- A NOT VALID constraint applies to new rows but never checks existing ones.
  -- Shipping one unvalidated would silently accept the orphans it exists to stop.
  SELECT
    'unvalidated_profiles_fk'::text,
    count(*)::bigint,
    'a NOT VALID constraint does not check existing rows'::text
  FROM pg_constraint
  WHERE conname LIKE '%\_profiles\_fkey' AND NOT convalidated

  UNION ALL
  -- RLS on with no policy denies everything. The table does not error, it reads
  -- as permanently empty — the same silent-failure shape as every defect the
  -- audit found.
  SELECT
    'rls_enabled_without_policy'::text,
    count(*)::bigint,
    'RLS with no policy denies every row silently; the table just looks empty'::text
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.blog_post_authors()
 RETURNS TABLE(id uuid, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT
    p.id,
    NULLIF(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') AS display_name
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.blog_posts b
    WHERE b.author_id = p.id
      AND b.status = 'published'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_course_difficulty(course_id_param uuid)
 RETURNS course_difficulty
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module_count INTEGER;
  v_assignment_count INTEGER;
  v_quiz_count INTEGER;
  v_content_item_count INTEGER;
  v_total_complexity INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_module_count
  FROM modules
  WHERE course_id = course_id_param;

  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param;

  v_total_complexity :=
    (v_module_count * 5) +
    (v_assignment_count * 10) +
    (v_quiz_count * 8) +
    (v_content_item_count * 2);

  IF v_total_complexity < 50 THEN
    RETURN 'beginner';
  ELSIF v_total_complexity < 150 THEN
    RETURN 'intermediate';
  ELSE
    RETURN 'advanced';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_course_hours(course_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_minutes NUMERIC := 0;
  v_lesson_minutes NUMERIC := 0;
  v_assignment_count INTEGER := 0;
  v_quiz_count INTEGER := 0;
  v_content_item_count INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(estimated_duration, 30)), 0)
    INTO v_lesson_minutes
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param;

  v_total_minutes := v_total_minutes + v_lesson_minutes;

  SELECT COUNT(*) INTO v_assignment_count
  FROM assignments
  WHERE course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_assignment_count * 60);

  SELECT COUNT(DISTINCT q.id) INTO v_quiz_count
  FROM quizzes q
  JOIN content_items ci ON q.content_item_id = ci.id
  WHERE ci.course_id = course_id_param;

  v_total_minutes := v_total_minutes + (v_quiz_count * 30);

  SELECT COUNT(*) INTO v_content_item_count
  FROM content_items
  WHERE course_id = course_id_param
    AND type IN ('page', 'external_url', 'external_tool');

  v_total_minutes := v_total_minutes + (v_content_item_count * 15);

  IF v_total_minutes = 0 THEN
    RETURN 1.0;
  END IF;

  RETURN ROUND(v_total_minutes / 60.0, 2);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_lesson_completion(lesson_id_param uuid, user_id_param uuid)
 RETURNS TABLE(completed boolean, completion_percentage integer, total_blocks integer, completed_blocks integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_blocks_count integer;
  completed_blocks_count integer;
  completion_pct integer;
  is_completed boolean;
BEGIN
  -- Get total content blocks for this lesson
  SELECT COUNT(*) INTO total_blocks_count
  FROM content_blocks 
  WHERE lesson_id = lesson_id_param;
  
  -- Get completed blocks for this user/lesson
  SELECT COUNT(*) INTO completed_blocks_count
  FROM content_blocks cb
  JOIN content_progress cp ON cb.id = cp.content_block_id
  WHERE cb.lesson_id = lesson_id_param 
    AND cp.user_id = user_id_param 
    AND cp.completed = true;
  
  -- Calculate completion percentage
  IF total_blocks_count > 0 THEN
    completion_pct := ROUND((completed_blocks_count::decimal / total_blocks_count::decimal) * 100);
    is_completed := completion_pct >= 100;
  ELSE
    completion_pct := 0;
    is_completed := false;
  END IF;
  
  RETURN QUERY SELECT is_completed, completion_pct, total_blocks_count, completed_blocks_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_assignment(viewer_id uuid, assignment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    LEFT JOIN public.content_items ci ON a.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, a.course_id) = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE a.id = assignment_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access their course assignments
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can access assignments in enrolled courses (only if published or no content_item)
      (e.user_id IS NOT NULL AND (ci.id IS NULL OR ci.published = true))
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_content_item(viewer_id uuid, content_item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.content_items ci
    JOIN public.courses c ON ci.course_id = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE ci.id = content_item_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access all content in their courses
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can only access published content in enrolled courses
      (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_course_materials(_user uuid, _course uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = _course AND e.user_id = _user)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course AND c.instructor_id = _user)
    OR public.has_role(_user, 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_module(viewer_id uuid, module_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON m.course_id = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE m.id = module_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access modules in their courses
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can access modules in enrolled courses (only if published)
      (e.user_id IS NOT NULL AND m.published = true)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_quiz(viewer_id uuid, quiz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE q.id = quiz_id
    AND (
      -- Admins can access all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can access their course quizzes
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
      OR
      -- Students can access quizzes in enrolled courses (only if published)
      (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_quiz_question(viewer_id uuid, question_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_questions qq
    JOIN public.quizzes q ON qq.quiz_id = q.id
    JOIN public.content_items ci ON q.content_item_id = ci.id
    JOIN public.courses c ON ci.course_id = c.id
    LEFT JOIN public.enrollments e ON c.id = e.course_id AND e.user_id = viewer_id
    WHERE qq.id = question_id
    AND (
      public.has_role(viewer_id, 'admin')
      OR c.instructor_id = viewer_id
      OR public.is_course_instructor(viewer_id, c.id)
      OR (e.user_id IS NOT NULL AND ci.published = true)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_submission(viewer_id uuid, submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_submissions subs
    JOIN public.assignments a ON subs.assignment_id = a.id
    LEFT JOIN public.content_items ci ON a.content_item_id = ci.id
    LEFT JOIN public.courses c ON COALESCE(ci.course_id, a.course_id) = c.id
    WHERE subs.id = submission_id
    AND (
      -- Student can view own submissions
      subs.user_id = viewer_id
      OR
      -- Admins can view all
      public.has_role(viewer_id, 'admin')
      OR
      -- Instructors can view submissions in their courses
      c.instructor_id = viewer_id
      OR
      public.is_course_instructor(viewer_id, c.id)
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_content_item(viewer_id uuid, target_content_item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = target_content_item_id
      AND public.can_manage_course_content(viewer_id, ci.course_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_course_content(viewer_id uuid, target_course_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = target_course_id
      AND (
        public.has_role(viewer_id, 'admin')
        OR c.instructor_id = viewer_id
        OR public.is_course_instructor(viewer_id, c.id)
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_course_materials(_user uuid, _course uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course AND c.instructor_id = _user)
    OR public.has_role(_user, 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_quiz(viewer_id uuid, target_quiz_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = target_quiz_id
      AND public.can_manage_content_item(viewer_id, q.content_item_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Can view own profile
    viewer_id = profile_id
    OR
    -- Anyone on a course you are also on: enrolled, its instructor_id, or an
    -- instructor that is_course_instructor() recognises — which is
    -- courses.instructor_id or a course_assignments row with role 'instructor',
    -- NOT the course_instructors table. Same predicate as
    -- courses_shared_by_users, so "who I can see" and "who I may message" stay
    -- the same set.
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE (
              EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.course_id = c.id AND e.user_id = viewer_id
              )
              OR c.instructor_id = viewer_id
              OR public.is_course_instructor(viewer_id, c.id)
            )
        AND (
              EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.course_id = c.id AND e.user_id = profile_id
              )
              OR c.instructor_id = profile_id
              OR public.is_course_instructor(profile_id, c.id)
            )
    )
    OR
    -- Can view instructors of enrolled courses
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE e.user_id = viewer_id
        AND c.instructor_id = profile_id
    )
    OR
    -- Instructors can view enrolled students
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = viewer_id
        AND e.user_id = profile_id
    )
    OR
    -- Co-instructors can see each other
    EXISTS (
      SELECT 1 FROM public.course_assignments ca1
      JOIN public.course_assignments ca2 ON ca1.course_id = ca2.course_id
      WHERE ca1.user_id = viewer_id
        AND ca2.user_id = profile_id
    )
    OR
    -- Conversation participants can see each other
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = viewer_id
        AND cp2.user_id = profile_id
    )
    OR
    -- Admins can view all
    public.has_role(viewer_id, 'admin'::app_role);
$function$
;

CREATE OR REPLACE FUNCTION public.check_course_completion(p_course_id uuid, p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH total AS (
    SELECT COUNT(*) AS n
      FROM public.content_items ci
      JOIN public.modules m ON m.id = ci.module_id
     WHERE m.course_id = p_course_id
       AND m.published = true
       AND ci.published = true
  ),
  done AS (
    SELECT COUNT(DISTINCT p.content_item_id) AS n
      FROM public.content_item_progressions p
      JOIN public.content_items ci ON ci.id = p.content_item_id
      JOIN public.modules m ON m.id = ci.module_id
     WHERE p.user_id = p_student_id
       AND m.course_id = p_course_id
       AND m.published = true
       AND ci.published = true
       AND p.workflow_state IN ('read','completed')
  )
  SELECT total.n > 0 AND done.n >= total.n FROM total, done;
$function$
;

CREATE OR REPLACE FUNCTION public.clean_old_security_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM security_events 
  WHERE created_at < now() - interval '6 months'
  AND severity IN ('info', 'warning');
  
  DELETE FROM audit_logs 
  WHERE created_at < now() - interval '2 years';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.course_contacts(p_course_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, avatar_url text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH caller AS (SELECT auth.uid() AS id),
  course AS (
    SELECT c.id, c.instructor_id FROM public.courses c WHERE c.id = p_course_id
  ),
  -- Same rule as open_course_thread's v_caller_in_course, admin clause included.
  caller_belongs AS (
    SELECT EXISTS (
      SELECT 1 FROM course c, caller
      WHERE c.instructor_id = caller.id
         OR public.is_course_instructor(caller.id, p_course_id)
         OR public.has_role(caller.id, 'admin'::app_role)
         OR EXISTS (
              SELECT 1 FROM public.enrollments e
              WHERE e.course_id = p_course_id AND e.user_id = caller.id
            )
    ) AS ok
  ),
  -- Same rule as open_course_thread's v_other_in_course: no admin clause, so an
  -- admin is not silently addressable from a course they have nothing to do with.
  members AS (
    SELECT c.instructor_id AS user_id FROM course c WHERE c.instructor_id IS NOT NULL
    UNION
    SELECT e.user_id FROM public.enrollments e WHERE e.course_id = p_course_id
    UNION
    SELECT ca.user_id FROM public.course_assignments ca
     WHERE ca.course_id = p_course_id AND ca.role = 'instructor'
  )
  SELECT p.id,
         p.first_name,
         p.last_name,
         p.avatar_url,
         CASE
           WHEN (SELECT c.instructor_id FROM course c) = p.id
             OR public.is_course_instructor(p.id, p_course_id)
           THEN 'instructor'
           ELSE 'student'
         END AS role
  FROM members m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE (SELECT ok FROM caller_belongs)
    AND m.user_id IS DISTINCT FROM (SELECT id FROM caller)
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public.course_roster_stats()
 RETURNS TABLE(course_id uuid, enrolled bigint, avg_progress numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    e.course_id,
    count(*)::bigint,
    round(avg(coalesce(e.completion_status, 0)))::numeric
  FROM public.enrollments e
  WHERE e.course_id IS NOT NULL
  GROUP BY e.course_id;
$function$
;

CREATE OR REPLACE FUNCTION public.coursera_call_refresh(p_action text, p_batch integer DEFAULT 40)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  if p_action not in ('process', 'enqueue-discover', 'enqueue-refresh', 'status') then
    raise exception 'unsupported action: %', p_action;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'coursera_refresh_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'coursera_refresh_secret';

  if v_url is null or v_secret is null then
    raise notice 'coursera refresh not configured; skipping';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-refresh-secret', v_secret),
    body := jsonb_build_object('action', p_action, 'batch', p_batch),
    timeout_milliseconds := 150000
  ) into v_request_id;

  return v_request_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.coursera_kick_refresh()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pending integer;
begin
  select count(*) into v_pending from public.coursera_crawl_queue
    where state = 'pending' and attempts < 3;
  if v_pending = 0 then
    return null;
  end if;
  return public.coursera_call_refresh('process', 40);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.coursera_kw_pattern(p_keyword text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select '(^|[^a-z0-9])' || replace(replace(p_keyword, '.', '\.'), '+', '\+') || '([^a-z0-9]|$)';
$function$
;

CREATE OR REPLACE FUNCTION public.coursera_verify_refresh_secret(p_secret text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_expected text;
begin
  if p_secret is null or length(p_secret) = 0 then
    return false;
  end if;

  select decrypted_secret into v_expected
    from vault.decrypted_secrets
    where name = 'coursera_refresh_secret';

  if v_expected is null then
    return false;
  end if;

  return encode(extensions.digest(p_secret, 'sha256'), 'hex')
       = encode(extensions.digest(v_expected, 'sha256'), 'hex');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.courses_shared_by_users(p_user_ids uuid[])
 RETURNS TABLE(course_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id
  FROM public.courses c
  WHERE (
    SELECT count(*)
    FROM unnest(p_user_ids) AS u(user_id)
    WHERE EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id AND e.user_id = u.user_id
          )
       OR c.instructor_id = u.user_id
       OR public.is_course_instructor(u.user_id, c.id)
  ) = cardinality(p_user_ids)
  -- Oldest first, so the same set of people deterministically lands in the same
  -- course rather than drifting as courses are added.
  ORDER BY c.created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_all_user_resumes(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM resumes WHERE user_id = user_id_param;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_resume_records(user_id_param uuid, problem_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- First delete the specific problematic record if an ID was provided
  IF problem_id_param IS NOT NULL AND problem_id_param != '' THEN
    DELETE FROM resumes WHERE id = problem_id_param;
  END IF;
  
  -- Then delete all other records for this user
  DELETE FROM resumes WHERE user_id = user_id_param;
  
  -- Return success
  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_quiz_submission(p_submission_id uuid, p_score integer, p_time_spent integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_quiz uuid;
  v_state text;
  v_allowed integer;
  v_show boolean;
  v_completed integer;
  v_reveal boolean;
BEGIN
  SELECT user_id, quiz_id
    INTO v_user, v_quiz
  FROM public.quiz_submissions
  WHERE id = p_submission_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user::text), hashtext(v_quiz::text));

  SELECT workflow_state
    INTO v_state
  FROM public.quiz_submissions
  WHERE id = p_submission_id;

  IF v_state = 'complete' THEN
    RAISE EXCEPTION 'Attempt already submitted';
  END IF;

  SELECT allowed_attempts, COALESCE(show_correct_answers, true)
    INTO v_allowed, v_show
  FROM public.quizzes
  WHERE id = v_quiz;

  SELECT count(*) INTO v_completed
  FROM public.quiz_submissions
  WHERE quiz_id = v_quiz
    AND user_id = v_user
    AND workflow_state = 'complete';

  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_completed >= v_allowed THEN
    RAISE EXCEPTION 'Attempt limit reached';
  END IF;

  UPDATE public.quiz_submissions
  SET finished_at = now(),
      time_spent = p_time_spent,
      score = p_score,
      kept_score = p_score,
      workflow_state = 'complete'
  WHERE id = p_submission_id;

  v_reveal := v_show
    AND v_allowed IS NOT NULL
    AND v_allowed > 0
    AND (v_completed + 1) >= v_allowed;

  RETURN jsonb_build_object('reveal', v_reveal);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_available_peers(p_weekday integer, p_time_slot text)
 RETURNS TABLE(user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.user_id
  FROM public.availability_slots s
  WHERE s.weekday = p_weekday
    AND s.time_slot = p_time_slot
    AND s.is_available = true
    AND auth.uid() IS NOT NULL
    AND s.user_id <> auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.find_one_on_one_conversation(user1_id uuid, user2_id uuid)
 RETURNS TABLE(conversation_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM conversations c
  WHERE c.is_group = false
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp1 
      WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2 
      WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
    )
    AND (
      SELECT COUNT(*) FROM conversation_participants cp 
      WHERE cp.conversation_id = c.id
    ) = 2;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.form_submission_counts()
 RETURNS TABLE(form_id uuid, submission_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT fs.form_id, count(*)::bigint
  FROM public.form_submissions fs
  WHERE fs.form_id IS NOT NULL
  GROUP BY fs.form_id;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_initial_assistant_message(quiz_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  quiz_data public.career_quiz_attempts;
  message_text TEXT;
BEGIN
  -- Get quiz data
  SELECT * INTO quiz_data FROM public.career_quiz_attempts WHERE id = quiz_attempt_id;
  
  -- Generate personalized message
  message_text := 'Hello! I''m your Career Coach Assistant. Based on your quiz results, I can see that your top recommended career path is ' || 
                 quiz_data.top_recommended_path || ' with a score of ';
                 
  -- Add appropriate score based on top path
  CASE quiz_data.top_recommended_path
    WHEN 'AI/ML' THEN 
      message_text := message_text || quiz_data.result_ai_ml_score;
    WHEN 'Analytics' THEN 
      message_text := message_text || quiz_data.result_analytics_score;
    WHEN 'Data Engineering' THEN 
      message_text := message_text || quiz_data.result_data_engineering_score;
    WHEN 'Business Intelligence' THEN 
      message_text := message_text || quiz_data.result_business_intelligence_score;
    ELSE 
      message_text := message_text || 'a high score';
  END CASE;
  
  message_text := message_text || '. Your strengths include ';
  
  -- Add strengths based on highest question scores
  IF quiz_data.q_analytical_thinking >= 4 THEN
    message_text := message_text || 'analytical thinking, ';
  END IF;
  
  IF quiz_data.q_creative_problem_solving >= 4 THEN
    message_text := message_text || 'creative problem solving, ';
  END IF;
  
  IF quiz_data.q_technical_complexity >= 4 THEN
    message_text := message_text || 'handling technical complexity, ';
  END IF;
  
  IF quiz_data.q_business_value >= 4 THEN
    message_text := message_text || 'business value orientation, ';
  END IF;
  
  -- Remove trailing comma and space
  message_text := RTRIM(message_text, ', ');
  
  message_text := message_text || '. How can I help you explore this career path further?';
  
  RETURN message_text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_blog_post_with_tags(post_slug text)
 RETURNS TABLE(id uuid, title text, content text, excerpt text, slug text, author_id uuid, image_url text, status text, featured boolean, seo_title text, seo_description text, category_name text, view_count integer, read_time integer, published_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, tags text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.content,
    bp.excerpt,
    bp.slug,
    bp.author_id,
    bp.image_url,
    bp.status,
    bp.featured,
    bp.seo_title,
    bp.seo_description,
    bc.name as category_name,
    bp.view_count,
    bp.read_time,
    bp.published_at,
    bp.created_at,
    bp.updated_at,
    COALESCE(
      ARRAY(
        SELECT bpt.tag_name 
        FROM blog_post_tags bpt 
        WHERE bpt.blog_post_id = bp.id
      ), 
      ARRAY[]::text[]
    ) as tags
  FROM blog_posts bp
  LEFT JOIN blog_categories bc ON bp.category_id = bc.id
  WHERE bp.slug = post_slug;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_course_stats(course_id_param uuid)
 RETURNS TABLE(enrollment_count bigint, completion_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id) as enrollment_count,
    CASE 
      WHEN COUNT(e.id) > 0 THEN 
        ROUND(AVG(e.completion_status), 2)
      ELSE 0
    END as completion_rate
  FROM enrollments e
  WHERE e.course_id = course_id_param;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_courses_by_difficulty(diff_level course_difficulty)
 RETURNS TABLE(id uuid, title text, description text, difficulty_level course_difficulty, estimated_hours numeric, enrollment_count bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.difficulty_level,
    c.estimated_hours,
    COUNT(e.id)::BIGINT as enrollment_count
  FROM courses c
  LEFT JOIN enrollments e ON c.id = e.course_id
  WHERE c.difficulty_level = diff_level
    AND c.published = true
  GROUP BY c.id, c.title, c.description, c.difficulty_level, c.estimated_hours
  ORDER BY enrollment_count DESC, c.title;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_most_discussed_content(course_id_param uuid, limit_count integer DEFAULT 10)
 RETURNS TABLE(content_item_id uuid, content_title text, discussion_count bigint, unresolved_count bigint, endorsed_count bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ci.id as content_item_id,
    ci.title as content_title,
    COUNT(cd.id)::BIGINT as discussion_count,
    COUNT(CASE WHEN cd.is_resolved = false THEN 1 END)::BIGINT as unresolved_count,
    COUNT(CASE WHEN cd.instructor_endorsed THEN 1 END)::BIGINT as endorsed_count
  FROM content_items ci
  LEFT JOIN content_discussions cd ON ci.id = cd.content_item_id
  WHERE ci.course_id = course_id_param
  GROUP BY ci.id, ci.title
  HAVING COUNT(cd.id) > 0
  ORDER BY discussion_count DESC
  LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_calendar_feed_token(p_course_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.calendar_feed_token
  FROM public.enrollments e
  WHERE e.course_id = p_course_id
    AND e.user_id = auth.uid()
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_popular_posts(days_back integer DEFAULT 7, limit_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, title character varying, slug character varying, views_count integer, likes_count integer, published_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.views_count,
    bp.likes_count,
    bp.published_at
  FROM blog_posts bp
  WHERE 
    bp.status = 'published'
    AND bp.published_at >= NOW() - INTERVAL '1 day' * days_back
  ORDER BY bp.views_count DESC
  LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_authoring(p_quiz_id uuid)
 RETURNS SETOF quiz_questions
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_manage_quiz(auth.uid(), p_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized to read this quiz''s answer key';
  END IF;

  RETURN QUERY
    SELECT * FROM public.quiz_questions
    WHERE quiz_id = p_quiz_id
    ORDER BY "position" NULLS LAST, created_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_taking(p_quiz_id uuid)
 RETURNS TABLE(id uuid, quiz_id uuid, question_text text, question_type text, points integer, "position" integer, answers jsonb, explanation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed integer;
  v_show boolean;
  v_completed integer;
  v_reveal boolean;
BEGIN
  SELECT q.allowed_attempts, COALESCE(q.show_correct_answers, true)
    INTO v_allowed, v_show
  FROM public.quizzes q
  WHERE q.id = p_quiz_id;

  SELECT count(*) INTO v_completed
  FROM public.quiz_submissions s
  WHERE s.quiz_id = p_quiz_id
    AND s.user_id = auth.uid()
    AND s.workflow_state = 'complete';

  -- The key stays hidden until the student has no attempts left to game.
  v_reveal := v_show
    AND v_allowed IS NOT NULL
    AND v_allowed > 0
    AND v_completed >= v_allowed;

  RETURN QUERY
    SELECT
      q.id,
      q.quiz_id,
      q.question_text::text,
      q.question_type::text,
      q.points,
      q."position",
      CASE
        -- Preferred shape: answers = [{id, text, correct}, ...]
        WHEN jsonb_typeof(q.answers) = 'array' AND jsonb_array_length(q.answers) > 0 THEN
          (
            SELECT jsonb_agg(
                     CASE
                       WHEN v_reveal THEN jsonb_build_object(
                         'id', opt->>'id', 'text', opt->>'text',
                         'correct', COALESCE((opt->>'correct')::boolean, false))
                       ELSE jsonb_build_object('id', opt->>'id', 'text', opt->>'text')
                     END
                     ORDER BY ord)
            FROM jsonb_array_elements(q.answers) WITH ORDINALITY AS t(opt, ord)
          )
        -- Legacy shape: options = ["A", "B"] or [{id?, text}, ...], with the
        -- right choice named separately in correct_answer.
        WHEN jsonb_typeof(q.options) = 'array' AND jsonb_array_length(q.options) > 0 THEN
          (
            SELECT jsonb_agg(
                     CASE
                       WHEN jsonb_typeof(opt) = 'object' THEN
                         CASE
                           WHEN v_reveal THEN jsonb_build_object(
                             'id', COALESCE(opt->>'id', opt->>'text'),
                             'text', opt->>'text',
                             'correct', COALESCE(
                               (opt->>'correct')::boolean,
                               lower(trim(COALESCE(opt->>'text', ''))) =
                               lower(trim(COALESCE(q.correct_answer #>> '{}', '')))))
                           ELSE jsonb_build_object(
                             'id', COALESCE(opt->>'id', opt->>'text'),
                             'text', opt->>'text')
                         END
                       ELSE
                         CASE
                           WHEN v_reveal THEN jsonb_build_object(
                             'id', opt #>> '{}', 'text', opt #>> '{}',
                             'correct', lower(trim(COALESCE(opt #>> '{}', ''))) =
                                        lower(trim(COALESCE(q.correct_answer #>> '{}', ''))))
                           ELSE jsonb_build_object('id', opt #>> '{}', 'text', opt #>> '{}')
                         END
                     END
                     ORDER BY ord)
            FROM jsonb_array_elements(q.options) WITH ORDINALITY AS t(opt, ord)
          )
        ELSE '[]'::jsonb
      END AS answers,
      CASE WHEN v_reveal THEN q.explanation ELSE NULL END AS explanation
    FROM public.quiz_questions q
    WHERE q.quiz_id = p_quiz_id
      AND public.can_access_quiz_question(auth.uid(), q.id)
    ORDER BY q."position" NULLS LAST, q.created_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_related_posts(post_id uuid, limit_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, title character varying, slug character varying, excerpt text, featured_image character varying, published_at timestamp with time zone, similarity_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_category_id UUID;
  post_tag_ids UUID[];
BEGIN
  -- Get the category and tags of the current post
  SELECT category_id INTO post_category_id
  FROM blog_posts
  WHERE id = post_id;
  
  SELECT ARRAY_AGG(tag_id) INTO post_tag_ids
  FROM blog_post_tags
  WHERE blog_post_id = post_id;
  
  RETURN QUERY
  WITH scored_posts AS (
    SELECT DISTINCT
      bp.id,
      bp.title,
      bp.slug,
      bp.excerpt,
      bp.featured_image,
      bp.published_at,
      (
        -- Score based on same category
        CASE WHEN bp.category_id = post_category_id THEN 10 ELSE 0 END +
        -- Score based on shared tags
        (
          SELECT COUNT(*)::INTEGER * 5
          FROM blog_post_tags bpt
          WHERE bpt.blog_post_id = bp.id 
          AND bpt.tag_id = ANY(post_tag_ids)
        )
      ) as similarity_score
    FROM blog_posts bp
    WHERE 
      bp.id != post_id
      AND bp.status = 'published'
      AND (
        bp.category_id = post_category_id
        OR EXISTS (
          SELECT 1 
          FROM blog_post_tags bpt
          WHERE bpt.blog_post_id = bp.id 
          AND bpt.tag_id = ANY(post_tag_ids)
        )
      )
  )
  SELECT * FROM scored_posts
  WHERE similarity_score > 0
  ORDER BY similarity_score DESC, published_at DESC
  LIMIT limit_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_student_video_progress(student_id uuid, course_id_param uuid)
 RETURNS TABLE(total_videos bigint, completed_videos bigint, total_watch_time_minutes numeric, average_completion_percentage numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ci.id)::BIGINT as total_videos,
    COUNT(DISTINCT CASE WHEN va.completed THEN ci.id END)::BIGINT as completed_videos,
    COALESCE(SUM(va.watch_time) / 60.0, 0)::NUMERIC as total_watch_time_minutes,
    COALESCE(AVG(va.completion_percentage), 0)::NUMERIC as average_completion_percentage
  FROM content_items ci
  LEFT JOIN video_analytics va ON ci.id = va.content_item_id AND va.user_id = student_id
  WHERE ci.course_id = course_id_param
    AND ci.type IN ('page', 'external_url') -- Video content types
  GROUP BY student_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id_param uuid)
 RETURNS TABLE(id uuid, subject text, is_group boolean, archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, participants jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.subject,
    c.is_group,
    c.archived,
    c.created_at,
    c.updated_at,
    c.created_by,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', cp.user_id,
          'added_at', cp.added_at,
          'profile', (
            SELECT jsonb_build_object(
              'id', p.id,
              'first_name', p.first_name,
              'last_name', p.last_name,
              'avatar_url', p.avatar_url
            )
            FROM profiles p
            WHERE p.id = cp.user_id
          )
        )
      )
      FROM conversation_participants cp
      WHERE cp.conversation_id = c.id
    ) AS participants
  FROM conversations c
  JOIN conversation_participants cp ON c.id = cp.conversation_id
  WHERE cp.user_id = user_id_param
    AND c.deleted_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations_secure(user_id_param uuid)
 RETURNS TABLE(id uuid, subject text, is_group boolean, archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow users to query their own conversations
  IF auth.uid() != user_id_param THEN
    RAISE EXCEPTION 'Access denied: You can only view your own conversations';
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.subject,
    c.is_group,
    c.archived,
    c.created_at,
    c.updated_at,
    c.created_by,
    cp.user_id
  FROM conversations c
  JOIN conversation_participants cp ON c.id = cp.conversation_id
  WHERE cp.user_id = user_id_param
    AND c.deleted_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_id(email text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM auth.users WHERE email = email;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
 RETURNS app_role[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(role), ARRAY['student']::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.has_admin_access(user_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'admin' = ANY(public.get_user_roles(user_id_param));
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.increment_blog_post_view(p_post_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE public.blog_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id
    -- Only published posts accrue views. This also stops the function being
    -- used as an oracle to probe which draft ids exist.
    AND status = 'published';
$function$
;

CREATE OR REPLACE FUNCTION public.increment_blog_views(post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE blog_posts 
  SET views_count = views_count + 1
  WHERE id = post_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(user_id_param uuid, conversation_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversation_id_param 
    AND user_id = user_id_param
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_course_instructor(user_id_param uuid, course_id_param uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM courses 
    WHERE id = course_id_param 
    AND instructor_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM course_assignments 
    WHERE course_id = course_id_param 
    AND user_id = user_id_param 
    AND role = 'instructor'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_grading_staff()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('instructor'::app_role, 'admin'::app_role)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_audit_event(p_user_id uuid, p_action text, p_table_name text, p_record_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_security_event(p_user_id uuid, p_event_type text, p_severity text, p_description text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO security_events (user_id, event_type, severity, description, metadata)
  VALUES (
    CASE WHEN auth.uid() IS NULL THEN p_user_id ELSE auth.uid() END,
    p_event_type,
    p_severity,
    p_description,
    p_metadata
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_submission_file_access(p_submission_id uuid, p_action text, p_attachment_id uuid DEFAULT NULL::uuid, p_filename text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx record;
  v_id uuid;
BEGIN
  IF p_action NOT IN ('file_downloaded', 'file_previewed') THEN
    RAISE EXCEPTION 'log_submission_file_access only records file access, got %', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(p_submission_id);
  IF v_ctx.course_id IS NULL THEN
    RAISE EXCEPTION 'Unknown submission %', p_submission_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_manage_course_content(auth.uid(), v_ctx.course_id)
  ) THEN
    RAISE EXCEPTION 'Only course staff may record submission file access'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject an attachment that belongs to a different submission rather than
  -- filing it under this one.
  IF p_attachment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.submission_attachments
    WHERE id = p_attachment_id AND submission_id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'Attachment % does not belong to submission %',
      p_attachment_id, p_submission_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id,
    module_id, attachment_id, filename
  ) VALUES (
    auth.uid(), p_action, p_submission_id, v_ctx.student_id, v_ctx.assignment_id,
    v_ctx.course_id, v_ctx.module_id, p_attachment_id, p_filename
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The definer bypasses RLS, so membership is checked here or nowhere.
  IF NOT public.is_conversation_participant(v_caller, p_conversation_id) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  UPDATE public.messages
  SET read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id <> v_caller
    AND read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notification_digest_dispatch()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'notification_digest_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'notification digest not configured; skipping';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 150000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notification_email_probe()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
  v_result jsonb;
  v_tries int := 0;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'notification_email_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN jsonb_build_object('error', 'notification email not configured');
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('mode', 'diagnostics'),
    timeout_milliseconds := 20000
  ) INTO v_request_id;

  WHILE v_tries < 40 LOOP
    PERFORM pg_sleep(0.5);
    v_tries := v_tries + 1;
    SELECT jsonb_build_object('status_code', status_code, 'body', content)
      INTO v_result FROM net._http_response WHERE id = v_request_id;
    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('error', 'no response captured', 'request_id', v_request_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notification_email_secret()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'notification_email_secret'
$function$
;

CREATE OR REPLACE FUNCTION public.open_course_thread(p_course_id uuid, p_other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_course RECORD;
  v_caller_in_course boolean;
  v_other_in_course boolean;
  v_conv_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_caller THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;

  SELECT id, title, instructor_id INTO v_course
  FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Admins may open a thread about any course; everyone else has to be in it.
  v_caller_in_course :=
       (v_course.instructor_id = v_caller)
    OR public.is_course_instructor(v_caller, p_course_id)
    OR public.has_role(v_caller, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = p_course_id AND e.user_id = v_caller);

  -- The recipient must genuinely be in the course. Deliberately no admin clause
  -- here: that would make every admin addressable from every course.
  v_other_in_course :=
       (v_course.instructor_id = p_other_user_id)
    OR public.is_course_instructor(p_other_user_id, p_course_id)
    OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = p_course_id AND e.user_id = p_other_user_id);

  IF NOT v_caller_in_course THEN
    RAISE EXCEPTION 'You must be enrolled in this course to message about it';
  END IF;
  IF NOT v_other_in_course THEN
    RAISE EXCEPTION 'Recipient is not part of this course';
  END IF;

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.course_id = p_course_id
    AND c.deleted_at IS NULL
    AND COALESCE(c.is_group, false) = false
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = v_caller)
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = p_other_user_id)
    AND (SELECT COUNT(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id) = 2
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversations (subject, is_group, created_by, course_id)
  VALUES (COALESCE('Course: ' || v_course.title, 'Course conversation'), false, v_caller, p_course_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_caller), (v_conv_id, p_other_user_id);

  RETURN v_conv_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.platform_stats()
 RETURNS TABLE(published_courses integer, community_members integer, avg_completion integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    (select count(*) from public.courses where published)::integer,
    -- Every account, not just learners: the UI labels this "Community Members"
    -- for that reason.
    (select count(*) from public.profiles)::integer,
    -- Enrollments with no recorded progress count as 0% rather than dropping out
    -- of the average, which is what the client-side version did.
    (select coalesce(round(avg(coalesce(completion_status, 0))), 0)
       from public.enrollments)::integer
$function$
;

CREATE OR REPLACE FUNCTION public.rate_limit_certificate_verify(p_ip_hash text, p_code text, p_found boolean)
 RETURNS TABLE(rate_limited boolean, attempts_last_minute integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.certificate_verification_attempts
   WHERE ip_hash = p_ip_hash
     AND attempted_at > now() - interval '1 minute';

  INSERT INTO public.certificate_verification_attempts (ip_hash, code, found)
  VALUES (p_ip_hash, p_code, p_found);

  -- Prune old rows opportunistically (keep 24h of history)
  DELETE FROM public.certificate_verification_attempts
   WHERE attempted_at < now() - interval '24 hours';

  RETURN QUERY SELECT (v_count >= 20)::boolean, v_count + 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reorder_content_items(p_module_id uuid, p_item_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Defer the unique constraint until the end of this transaction so
  -- intermediate position values don't trigger a violation mid-loop.
  SET CONSTRAINTS unique_position_per_module DEFERRED;

  FOR i IN 1..array_length(p_item_ids, 1) LOOP
    UPDATE content_items
    SET position = i - 1   -- 0-indexed to match client convention
    WHERE id       = p_item_ids[i]
      AND module_id = p_module_id;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reorder_modules(p_course_id uuid, p_module_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  FOR i IN 1..array_length(p_module_ids, 1) LOOP
    UPDATE modules
    SET position = i - 1
    WHERE id        = p_module_ids[i]
      AND course_id = p_course_id;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_availability(p_slots jsonb)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  delete from public.availability_slots where user_id = auth.uid();
  insert into public.availability_slots (user_id, weekday, time_slot, is_available)
  select auth.uid(),
         (s ->> 'weekday')::int,
         s ->> 'time_slot',
         coalesce((s ->> 'is_available')::boolean, true)
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) as s;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_calendar_feed_token(p_course_id uuid, p_token uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.user_id
  FROM public.enrollments e
  WHERE e.course_id = p_course_id
    AND e.calendar_feed_token = p_token
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.rotate_my_calendar_feed_token(p_course_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token uuid;
BEGIN
  UPDATE public.enrollments
  SET calendar_feed_token = gen_random_uuid()
  WHERE course_id = p_course_id
    AND user_id = auth.uid()
  RETURNING calendar_feed_token INTO v_token;

  RETURN v_token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_admin_users(p_search text, p_role text, p_limit integer, p_offset integer)
 RETURNS TABLE(id uuid, first_name text, last_name text, avatar_url text, created_at timestamp with time zone, roles app_role[], total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.created_at,
      COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL),
               ARRAY[]::app_role[]) AS roles
    FROM public.profiles pr
    LEFT JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE public.has_admin_access(auth.uid())  -- admin gate (DEFINER)
    GROUP BY pr.id, pr.first_name, pr.last_name, pr.avatar_url, pr.created_at
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (
        p_search IS NULL OR btrim(p_search) = ''
        OR (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) ILIKE '%' || p_search || '%'
      )
      AND (
        p_role IS NULL OR p_role = 'all'
        -- Compare as text so an invalid p_role never errors on an enum cast.
        OR p_role = ANY(roles::text[])
        -- Users with no explicit rows are treated as students.
        OR (p_role = 'student' AND cardinality(roles) = 0)
      )
  )
  SELECT f.id, f.first_name, f.last_name, f.avatar_url, f.created_at, f.roles,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$
;

CREATE OR REPLACE FUNCTION public.search_form_submissions(p_form_id uuid, p_search text, p_limit integer, p_offset integer)
 RETURNS TABLE(id uuid, form_id uuid, user_id uuid, submission_data jsonb, created_at timestamp with time zone, first_name text, last_name text, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT s.id, s.form_id, s.user_id, s.submission_data, s.created_at,
           p.first_name, p.last_name
    FROM public.form_submissions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE s.form_id = p_form_id
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR s.submission_data::text ILIKE '%' || p_search || '%'
        OR coalesce(p.first_name, '') ILIKE '%' || p_search || '%'
        OR coalesce(p.last_name, '') ILIKE '%' || p_search || '%'
        OR s.user_id::text ILIKE '%' || p_search || '%'
      )
  )
  SELECT f.id, f.form_id, f.user_id, f.submission_data, f.created_at,
         f.first_name, f.last_name,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$
;

CREATE OR REPLACE FUNCTION public.snapshot_enrollment_progress()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO progress_snapshots (user_id, course_id, completion_percentage, snapshot_date)
  SELECT user_id, course_id, COALESCE(completion_status, 0), CURRENT_DATE
  FROM enrollments
  WHERE user_id IS NOT NULL AND course_id IS NOT NULL
  ON CONFLICT (user_id, course_id, snapshot_date) DO UPDATE
  SET completion_percentage = EXCLUDED.completion_percentage;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
 RETURNS quiz_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    uuid := auth.uid();
  v_allowed integer;
  v_last    integer;
  v_row     public.quiz_submissions;
BEGIN
  -- Definer runs as the owner, so this guard is load-bearing rather than
  -- decorative: without it an anonymous caller would insert with a null user.
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a quiz.'
      USING ERRCODE = '42501';
  END IF;

  SELECT allowed_attempts INTO v_allowed
    FROM public.quizzes
   WHERE id = p_quiz_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_quiz_id::text), hashtext(v_user::text));

  SELECT MAX(attempt) INTO v_last
    FROM public.quiz_submissions
   WHERE quiz_id = p_quiz_id
     AND user_id = v_user;

  v_last := COALESCE(v_last, 0);

  -- NULL or 0 both mean unlimited, matching finalize_quiz_submission and
  -- get_quiz_questions_for_taking.
  IF v_allowed IS NOT NULL AND v_allowed > 0 AND v_last >= v_allowed THEN
    RAISE EXCEPTION 'You have used all % attempts for this quiz.', v_allowed
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, attempt, workflow_state)
  VALUES (p_quiz_id, v_user, now(), v_last + 1, 'pending_review')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submission_audit_context(p_submission_id uuid)
 RETURNS TABLE(student_id uuid, assignment_id uuid, course_id uuid, module_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.user_id,
    a.id,
    COALESCE(ci.course_id, a.course_id),
    COALESCE(ci.module_id, a.module_id)
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  LEFT JOIN public.content_items ci ON ci.id = a.content_item_id
  WHERE s.id = p_submission_id;
$function$
;

CREATE OR REPLACE FUNCTION public.track_blog_view(post_id uuid, view_date date, referrer_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_record UUID;
BEGIN
  -- Check if analytics record exists for this post and date
  SELECT id INTO existing_record
  FROM blog_analytics
  WHERE blog_post_id = post_id AND date = view_date;
  
  IF existing_record IS NULL THEN
    -- Create new analytics record
    INSERT INTO blog_analytics (
      blog_post_id,
      date,
      views,
      unique_visitors,
      referrer_data
    ) VALUES (
      post_id,
      view_date,
      1,
      1,
      CASE 
        WHEN referrer_url IS NOT NULL 
        THEN jsonb_build_object(referrer_url, 1)
        ELSE '{}'::jsonb
      END
    );
  ELSE
    -- Update existing record
    UPDATE blog_analytics
    SET 
      views = views + 1,
      unique_visitors = unique_visitors + 1, -- This should be smarter with session tracking
      referrer_data = CASE
        WHEN referrer_url IS NOT NULL THEN
          CASE
            WHEN referrer_data ? referrer_url THEN
              jsonb_set(
                referrer_data,
                ARRAY[referrer_url],
                to_jsonb((referrer_data->>referrer_url)::int + 1)
              )
            ELSE
              referrer_data || jsonb_build_object(referrer_url, 1)
          END
        ELSE referrer_data
      END
    WHERE id = existing_record;
  END IF;
  
  -- Also increment the post's view count
  UPDATE blog_posts 
  SET views_count = views_count + 1
  WHERE id = post_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_roles(target_user_id uuid, new_roles text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin using direct query (not has_role to avoid dependency)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Delete existing roles for the target user
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id;

  -- Insert new roles
  INSERT INTO public.user_roles (user_id, role, granted_by)
  SELECT
    target_user_id,
    unnest(new_roles)::app_role,
    auth.uid()
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
 RETURNS TABLE(verification_code text, certificate_type text, issued_at timestamp with time zone, certificate_data jsonb, course_id uuid, course_title text, course_category text, course_level text, course_duration text, student_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.verification_code,
    c.certificate_type,
    c.issued_at,
    c.certificate_data,
    co.id AS course_id,
    co.title AS course_title,
    co.category AS course_category,
    co.level AS course_level,
    co.duration AS course_duration,
    COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Certified Student') AS student_name
  FROM public.certificates c
  LEFT JOIN public.courses co ON co.id = c.course_id
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.verification_code = p_code
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_submission_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx record;
BEGIN
  IF COALESCE(NEW.is_draft, false) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(NEW.submission_id);

  -- A comment on something other than an assignment submission has no context
  -- row; recording it with null course_id would make it unreadable under RLS.
  IF v_ctx.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id, module_id, details
  ) VALUES (
    COALESCE(NEW.author_id, auth.uid()), 'comment_posted', NEW.submission_id,
    v_ctx.student_id, v_ctx.assignment_id, v_ctx.course_id, v_ctx.module_id,
    jsonb_strip_nulls(jsonb_build_object(
      'comment_id', NEW.id,
      'author_type', NEW.author_type,
      'comment_type', NEW.comment_type,
      'is_private', NEW.is_private
    ))
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_submission_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx record;
  v_action text;
BEGIN
  IF NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.grader_comments IS NOT DISTINCT FROM OLD.grader_comments
     AND NEW.rubric_scores IS NOT DISTINCT FROM OLD.rubric_scores
     AND NEW.workflow_state IS NOT DISTINCT FROM OLD.workflow_state THEN
    RETURN NEW;
  END IF;

  IF NEW.workflow_state IS DISTINCT FROM 'graded'
     AND OLD.workflow_state = 'graded' THEN
    v_action := 'grade_removed';
  ELSIF OLD.workflow_state = 'graded' OR OLD.grade IS NOT NULL THEN
    v_action := 'grade_changed';
  ELSE
    v_action := 'grade_posted';
  END IF;

  SELECT * INTO v_ctx FROM public.submission_audit_context(NEW.id);

  INSERT INTO public.submission_audit_events (
    actor_id, action, submission_id, student_id, assignment_id, course_id, module_id, details
  ) VALUES (
    auth.uid(), v_action, NEW.id, v_ctx.student_id, v_ctx.assignment_id,
    v_ctx.course_id, v_ctx.module_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_grade', OLD.grade,
      'new_grade', NEW.grade,
      'old_workflow_state', OLD.workflow_state,
      'new_workflow_state', NEW.workflow_state,
      'grader_comments_changed',
        (NEW.grader_comments IS DISTINCT FROM OLD.grader_comments),
      'rubric_scores_changed',
        (NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores)
    ))
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_issue_certificate_on_progression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_total int;
  v_completed int;
  v_code text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT m.course_id
    INTO v_course_id
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE ci.id = NEW.content_item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if a certificate already exists for this user/course
  IF EXISTS (
    SELECT 1 FROM public.certificates
     WHERE user_id = NEW.user_id AND course_id = v_course_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.content_items ci
    JOIN public.modules m ON m.id = ci.module_id
   WHERE m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT p.content_item_id) INTO v_completed
    FROM public.content_item_progressions p
    JOIN public.content_items ci ON ci.id = p.content_item_id
    JOIN public.modules m ON m.id = ci.module_id
   WHERE p.user_id = NEW.user_id
     AND m.course_id = v_course_id
     AND m.published = true
     AND ci.published = true
     AND p.workflow_state IN ('read', 'completed');

  IF v_completed < v_total THEN
    RETURN NEW;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.certificates (
    user_id, course_id, certificate_type, certificate_data, verification_code, issued_at
  ) VALUES (
    NEW.user_id,
    v_course_id,
    'completion',
    jsonb_build_object(
      'completion_percentage', 100,
      'total_items', v_total,
      'auto_issued', true
    ),
    v_code,
    now()
  )
  ON CONFLICT (user_id, course_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_notifications_on_announcement_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from public.notifications
   where course_id = OLD.course_id
     and type = 'course_announcement'
     and title = 'New announcement: ' || coalesce(OLD.title, 'Untitled');
  return OLD;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_grade_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.change_type IN ('created', 'updated') THEN
    INSERT INTO public.grade_change_notifications (
      grade_history_id, student_id, course_id, notification_type, title, message
    ) VALUES (
      NEW.id, NEW.student_id, NEW.course_id,
      CASE WHEN NEW.change_type = 'created' THEN 'grade_posted' ELSE 'grade_updated' END,
      CASE WHEN NEW.change_type = 'created' THEN 'New Grade Posted' ELSE 'Grade Updated' END,
      CASE
        WHEN NEW.assignment_id IS NOT NULL THEN 'Your assignment grade has been ' || NEW.change_type
        WHEN NEW.quiz_id IS NOT NULL THEN 'Your quiz grade has been ' || NEW.change_type
        ELSE 'Your grade has been ' || NEW.change_type
      END
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.email_notification_fanout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'notification_email_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'notification_email_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'notification email not configured; skipping';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    body := jsonb_build_object('notification_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notification email dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_assessed_progression()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type text;
BEGIN
  IF NEW.workflow_state NOT IN ('read', 'completed', 'graded') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IN ('read', 'completed', 'graded') THEN
    RETURN NEW;
  END IF;

  SELECT type::text INTO v_type FROM public.content_items WHERE id = NEW.content_item_id;

  IF v_type = 'assignment' AND NOT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.assignment_submissions s ON s.assignment_id = a.id
    WHERE a.content_item_id = NEW.content_item_id
      AND s.user_id = NEW.user_id
      AND s.submitted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Assignment must be submitted before it can be marked complete'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_type = 'quiz' AND NOT EXISTS (
    SELECT 1 FROM public.quizzes z
    JOIN public.quiz_submissions q ON q.quiz_id = z.id
    WHERE z.content_item_id = NEW.content_item_id
      AND q.user_id = NEW.user_id
      AND q.workflow_state IN ('complete', 'pending_review')
  ) THEN
    RAISE EXCEPTION 'Quiz must be submitted before it can be marked complete'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_conversation_has_course()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.course_id IS NULL THEN
    RAISE EXCEPTION 'A conversation must belong to a course. Open it with open_course_thread().';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_conversation_participant_in_course()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course uuid;
  v_allowed boolean;
BEGIN
  SELECT course_id INTO v_course FROM public.conversations WHERE id = NEW.conversation_id;

  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Conversation % is not scoped to a course; participants cannot be added.', NEW.conversation_id;
  END IF;

  SELECT
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = v_course AND e.user_id = NEW.user_id)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = v_course AND c.instructor_id = NEW.user_id)
    OR public.is_course_instructor(NEW.user_id, v_course)
    -- open_course_thread lets an admin open a thread about a course they neither teach
    -- nor take, so the trigger has to let that admin into the room it just created.
    OR public.has_role(NEW.user_id, 'admin'::app_role)
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'User % is not part of course %', NEW.user_id, v_course;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_profiles_roles_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text;
  v_is_privileged boolean;
BEGIN
  jwt_role := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  v_is_privileged :=
    jwt_role = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'::app_role
    );

  IF TG_OP = 'INSERT' THEN
    -- No OLD row to fall back to. Privileged callers may set roles; everyone
    -- else is pinned to the column default so a profile can never be created
    -- already elevated.
    IF NOT v_is_privileged THEN
      NEW.roles := ARRAY['student']::text[];
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: unchanged behavior — revert unauthorized role changes.
  IF NEW.roles IS NOT DISTINCT FROM OLD.roles THEN
    RETURN NEW;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  NEW.roles := OLD.roles;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.freeze_finalized_quiz_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF OLD.workflow_state = 'complete' THEN
    NEW.score          := OLD.score;
    NEW.kept_score     := OLD.kept_score;
    NEW.workflow_state := OLD.workflow_state;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.freeze_quiz_attempt_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.score := OLD.score;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Assign default 'student' role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::app_role);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_enrolled_on_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_title TEXT;
BEGIN
  SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;
  INSERT INTO public.notifications (user_id, title, message, type, link, course_id)
  SELECT e.user_id,
         'New announcement: ' || COALESCE(NEW.title, 'Untitled'),
         LEFT(COALESCE(NEW.content, COALESCE(v_course_title, 'your course') || ' posted a new announcement.'), 240),
         'course_announcement',
         '/courses/' || NEW.course_id || '/announcements?announcement=' || NEW.id,
         NEW.course_id
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_on_assignment_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
  v_module_title text;
  v_student_name text;
  v_is_resubmit boolean;
  v_where text;
  v_link text;
BEGIN
  IF NEW.workflow_state IS DISTINCT FROM 'submitted' OR NEW.submitted_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT (
       NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.attempt IS DISTINCT FROM OLD.attempt
    OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
  ) THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title, m.title
    INTO v_course_id, v_assignment_title, v_module_title
  FROM public.assignments a
  LEFT JOIN public.content_items ci ON ci.id = a.content_item_id
  LEFT JOIN public.modules m ON m.id = ci.module_id
  WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), 'A student')
    INTO v_student_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  v_is_resubmit := COALESCE(NEW.attempt, 1) > 1;
  v_where := COALESCE(v_assignment_title, 'an assignment')
             || CASE WHEN v_module_title IS NOT NULL THEN ' (' || v_module_title || ')' ELSE '' END;
  v_link := '/courses/' || v_course_id || '/assignments';

  INSERT INTO public.notifications (user_id, type, title, message, link, course_id)
  SELECT staff.user_id,
         'assignment_submitted',
         CASE WHEN v_is_resubmit THEN 'Assignment resubmitted: ' ELSE 'New submission: ' END || COALESCE(v_assignment_title, 'Assignment'),
         COALESCE(v_student_name, 'A student')
           || CASE WHEN v_is_resubmit THEN ' resubmitted ' ELSE ' submitted ' END
           || v_where
           || CASE WHEN v_is_resubmit THEN ' (attempt ' || COALESCE(NEW.attempt, 1) || ').' ELSE '.' END,
         v_link,
         v_course_id
  FROM (
    SELECT ci.user_id AS user_id FROM public.course_instructors ci WHERE ci.course_id = v_course_id
    UNION
    SELECT c.instructor_id FROM public.courses c WHERE c.id = v_course_id AND c.instructor_id IS NOT NULL
  ) AS staff
  WHERE staff.user_id IS NOT NULL AND staff.user_id <> NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, course_id)
  VALUES (
    NEW.user_id,
    'assignment_submitted',
    CASE WHEN v_is_resubmit THEN 'Resubmission received: ' ELSE 'Submission received: ' END || COALESCE(v_assignment_title, 'Assignment'),
    'We received your work for ' || v_where || '. You will be notified when it is graded.',
    v_link,
    v_course_id
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_assignment_title text;
  v_module_id uuid;
  v_link text;
  v_rubric_changed boolean := false;
  v_has_feedback boolean;
BEGIN
  -- A rubric only counts as changed when there is still a rubric to read.
  IF NEW.rubric_scores IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_rubric_changed := true;
    ELSIF NEW.rubric_scores IS DISTINCT FROM OLD.rubric_scores THEN
      v_rubric_changed := true;
    END IF;
  END IF;

  IF NOT (
       (TG_OP = 'INSERT' AND (NEW.grade IS NOT NULL OR NEW.grader_comments IS NOT NULL OR NEW.score IS NOT NULL OR v_rubric_changed))
    OR (TG_OP = 'UPDATE' AND (
          NEW.grade IS DISTINCT FROM OLD.grade
          OR NEW.grader_comments IS DISTINCT FROM OLD.grader_comments
          OR NEW.score IS DISTINCT FROM OLD.score
          OR NEW.workflow_state IS DISTINCT FROM OLD.workflow_state
          OR v_rubric_changed
        ))
  ) THEN
    RETURN NEW;
  END IF;

  -- Nothing for the student to look at: the change cleared every
  -- feedback-bearing column. Silence beats a notification that lies.
  v_has_feedback := NEW.grade IS NOT NULL
    OR NEW.score IS NOT NULL
    OR NEW.grader_comments IS NOT NULL
    OR NEW.rubric_scores IS NOT NULL;
  IF NOT v_has_feedback THEN
    RETURN NEW;
  END IF;

  SELECT a.course_id, a.title, a.module_id INTO v_course_id, v_assignment_title, v_module_id
  FROM public.assignments a WHERE a.id = NEW.assignment_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  v_link := CASE
    WHEN v_module_id IS NOT NULL THEN
      '/courses/' || v_course_id::text || '/modules/' || v_module_id::text
        || '/assignments/' || NEW.assignment_id::text
    ELSE '/courses/' || v_course_id::text || '/grades'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, course_id, link)
  VALUES (
    NEW.user_id,
    CASE WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
         THEN 'submission_feedback' ELSE 'assignment_graded' END,
    CASE WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
         THEN 'Rubric feedback: ' || COALESCE(v_assignment_title, 'Assignment')
         ELSE 'Assignment graded: ' || COALESCE(v_assignment_title, 'Assignment') END,
    CASE
      WHEN v_rubric_changed AND NEW.score IS NULL AND NEW.grade IS NULL
        THEN 'Your instructor added rubric feedback on your submission.'
      WHEN NEW.score IS NOT NULL THEN 'Score: ' || NEW.score::text
      ELSE 'Your submission was graded.'
    END,
    v_course_id,
    v_link
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_student_on_submission_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_assignment_title text;
  v_course_id uuid;
  v_module_id uuid;
  v_assignment_id uuid;
  v_link text;
  v_is_update boolean := (TG_OP = 'UPDATE');
BEGIN
  IF COALESCE(NEW.is_draft, false) OR COALESCE(NEW.is_private, false) OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_update AND NOT (
       (COALESCE(OLD.is_draft, false) AND NOT COALESCE(NEW.is_draft, false))
    OR NEW.comment_text IS DISTINCT FROM OLD.comment_text
    OR NEW.rich_content IS DISTINCT FROM OLD.rich_content
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, a.title, a.course_id, a.module_id, a.id
    INTO v_student_id, v_assignment_title, v_course_id, v_module_id, v_assignment_id
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  WHERE s.id = NEW.submission_id;

  IF v_student_id IS NULL OR v_student_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  v_link := CASE
    WHEN v_module_id IS NOT NULL THEN
      '/courses/' || v_course_id::text || '/modules/' || v_module_id::text
        || '/assignments/' || v_assignment_id::text
    ELSE '/courses/' || v_course_id::text || '/grades'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, course_id, link)
  VALUES (
    v_student_id,
    'submission_feedback',
    CASE WHEN v_is_update THEN 'Feedback updated: ' ELSE 'New feedback: ' END
      || COALESCE(v_assignment_title, 'Assignment'),
    CASE WHEN v_is_update
      THEN 'Your instructor updated their feedback on your submission.'
      ELSE 'Your instructor left feedback on your submission.' END,
    v_course_id,
    v_link
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pin_assignment_grade_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.grade           := OLD.grade;
  NEW.score           := OLD.score;
  NEW.graded_at       := OLD.graded_at;
  NEW.grader_comments := OLD.grader_comments;
  NEW.rubric_scores   := OLD.rubric_scores;
  NEW.excused         := OLD.excused;
  NEW.late            := OLD.late;
  NEW.missing         := OLD.missing;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pin_assignment_grade_columns_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  NEW.grade           := NULL;
  NEW.score           := NULL;
  NEW.graded_at       := NULL;
  NEW.grader_comments := NULL;
  NEW.rubric_scores   := NULL;
  NEW.excused         := false;
  NEW.late            := false;
  NEW.missing         := false;

  IF NEW.workflow_state = 'graded' THEN
    NEW.workflow_state := 'submitted';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pin_quiz_answer_grading()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.correct := false;
    NEW.points := 0;
  ELSE
    NEW.correct := OLD.correct;
    NEW.points := OLD.points;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pin_quiz_submission_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_grading_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new attempt starts ungraded; only score-quiz may set a score.
    NEW.score := NULL;
    NEW.kept_score := NULL;
    IF NEW.workflow_state = 'complete' THEN
      NEW.workflow_state := 'pending_review';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: the score and the finalized state are the server's to set.
  NEW.score := OLD.score;
  NEW.kept_score := OLD.kept_score;
  IF OLD.workflow_state = 'complete' THEN
    NEW.workflow_state := OLD.workflow_state;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_discussion_upvote_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_discussions
    SET upvote_count = upvote_count + 1
    WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_discussions
    SET upvote_count = GREATEST(0, upvote_count - 1)
    WHERE id = OLD.discussion_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_coursera_courses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track_grade_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.grade_history (
      grade_id, assignment_id, quiz_id, student_id, course_id,
      new_points_earned, new_points_possible, new_percentage, new_letter_grade, new_comments,
      change_type, changed_by, grading_method
    ) VALUES (
      NEW.id, NEW.assignment_id, NEW.quiz_id, NEW.student_id, NEW.course_id,
      NEW.points_earned, NEW.points_possible, NEW.percentage, NEW.letter_grade, NEW.comments,
      'created', auth.uid(), 'manual'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.points_earned IS DISTINCT FROM NEW.points_earned) OR
       (OLD.points_possible IS DISTINCT FROM NEW.points_possible) OR
       (OLD.percentage IS DISTINCT FROM NEW.percentage) OR
       (OLD.letter_grade IS DISTINCT FROM NEW.letter_grade) OR
       (OLD.comments IS DISTINCT FROM NEW.comments) THEN
      INSERT INTO public.grade_history (
        grade_id, assignment_id, quiz_id, student_id, course_id,
        previous_points_earned, previous_points_possible, previous_percentage, previous_letter_grade, previous_comments,
        new_points_earned, new_points_possible, new_percentage, new_letter_grade, new_comments,
        change_type, changed_by, grading_method
      ) VALUES (
        NEW.id, NEW.assignment_id, NEW.quiz_id, NEW.student_id, NEW.course_id,
        OLD.points_earned, OLD.points_possible, OLD.percentage, OLD.letter_grade, OLD.comments,
        NEW.points_earned, NEW.points_possible, NEW.percentage, NEW.letter_grade, NEW.comments,
        'updated', auth.uid(), 'manual'
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_assignment_progress_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_blog_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_comment_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  NEW.edit_history = COALESCE(NEW.edit_history, '[]'::jsonb) ||
    jsonb_build_object('edited_at', now(), 'previous_text', OLD.comment_text);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_content_discussion_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();

  -- Mark as edited if comment_text changed (but not on insert)
  IF TG_OP = 'UPDATE' AND OLD.comment_text != NEW.comment_text THEN
    NEW.is_edited = true;
    NEW.edited_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_form_submission_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_forms_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_linkedin_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_page_visibility_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_portfolio_projects_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_survey_draft_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tweets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_video_analytics_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_watched_at = NOW();

  -- Auto-mark as completed if completion >= 90%
  IF NEW.completion_percentage >= 90 AND NEW.completed = false THEN
    NEW.completed = true;
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$
;
