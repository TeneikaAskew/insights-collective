-- Grades + grade-history + submission-comments system, corrected for the live
-- schema. Supersedes the never-applied 20250723000001 file:
--  * RLS that referenced assignment_submissions.student_id now uses user_id
--    (the live column).
--  * grades gains a UNIQUE NULLS NOT DISTINCT index so the frontend's
--    upsert onConflict (course_id,student_id,assignment_id,quiz_id) works.
--  * grades table itself comes from the also-unapplied 20250715090000 file.

CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  grade_type TEXT NOT NULL CHECK (grade_type IN ('assignment', 'quiz', 'participation', 'final', 'midterm', 'other')),
  points_earned DECIMAL(8,2),
  points_possible DECIMAL(8,2),
  percentage DECIMAL(5,2),
  letter_grade TEXT,
  weight DECIMAL(5,2) DEFAULT 1.0,
  comments TEXT,
  graded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_grades_scope UNIQUE NULLS NOT DISTINCT (course_id, student_id, assignment_id, quiz_id)
);

CREATE TABLE IF NOT EXISTS public.grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  previous_points_earned DECIMAL(8,2),
  previous_points_possible DECIMAL(8,2),
  previous_percentage DECIMAL(5,2),
  previous_letter_grade TEXT,
  previous_comments TEXT,
  new_points_earned DECIMAL(8,2),
  new_points_possible DECIMAL(8,2),
  new_percentage DECIMAL(5,2),
  new_letter_grade TEXT,
  new_comments TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'excused', 'unexcused')),
  change_reason TEXT,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  grading_method TEXT,
  rubric_data JSONB,
  submission_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('assignment', 'quiz')),
  comment_text TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('feedback', 'grade_justification', 'question', 'note', 'rubric_feedback')),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('instructor', 'student', 'ta', 'grader')),
  is_private BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES public.submission_comments(id) ON DELETE CASCADE,
  thread_position INTEGER DEFAULT 0,
  attachments JSONB,
  rich_content JSONB,
  is_draft BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edit_history JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.grade_change_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_history_id UUID NOT NULL REFERENCES public.grade_history(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('grade_posted', 'grade_updated', 'grade_removed', 'feedback_added')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  delivery_method TEXT[] DEFAULT ARRAY['in_app'],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grader_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  assignment_id UUID REFERENCES public.assignments(id),
  quiz_id UUID REFERENCES public.quizzes(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('individual', 'bulk', 'rubric', 'speedgrader')),
  grading_method TEXT CHECK (grading_method IN ('manual', 'rubric', 'auto', 'imported')),
  submissions_graded INTEGER DEFAULT 0,
  total_submissions INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  grading_criteria JSONB,
  batch_changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grades_course_student ON public.grades(course_id, student_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_grade_id ON public.grade_history(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_student_course ON public.grade_history(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_grade_history_changed_at ON public.grade_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission ON public.submission_comments(submission_id, submission_type);
CREATE INDEX IF NOT EXISTS idx_submission_comments_author ON public.submission_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_parent ON public.submission_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_student ON public.grade_change_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_notifications_unread ON public.grade_change_notifications(student_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_grading_sessions_grader ON public.grading_sessions(grader_id);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_course ON public.grading_sessions(course_id);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_change_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_sessions ENABLE ROW LEVEL SECURITY;

-- Grades
CREATE POLICY "Students view own grades" ON public.grades
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Course staff manage grades" ON public.grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = grades.course_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );

-- Grade history
CREATE POLICY "Course staff view grade history" ON public.grade_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.course_assignments ca
      WHERE ca.course_id = grade_history.course_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    )
  );
CREATE POLICY "Students view own grade history" ON public.grade_history
  FOR SELECT USING (student_id = auth.uid());

-- Submission comments (corrected: assignment_submissions is keyed by user_id)
CREATE POLICY "Users view comments on their submissions" ON public.submission_comments
  FOR SELECT USING (
    author_id = auth.uid() OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1 FROM public.assignment_submissions asub
      WHERE asub.id = submission_comments.submission_id
        AND asub.user_id = auth.uid()
    )) OR
    (submission_type = 'quiz' AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = submission_comments.submission_id
        AND qa.user_id = auth.uid()
    )) OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1
      FROM public.assignment_submissions asub
      JOIN public.assignments a ON a.id = asub.assignment_id
      JOIN public.course_assignments ca ON ca.course_id = a.course_id
      WHERE asub.id = submission_comments.submission_id
        AND ca.user_id = auth.uid()
        AND ca.role IN ('instructor', 'assistant')
    ))
  );
CREATE POLICY "Users create comments as themselves" ON public.submission_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users edit own comments" ON public.submission_comments
  FOR UPDATE USING (author_id = auth.uid());

-- Notifications
CREATE POLICY "Students manage own grade notifications" ON public.grade_change_notifications
  FOR ALL USING (student_id = auth.uid());

-- Grading sessions
CREATE POLICY "Graders manage own sessions" ON public.grading_sessions
  FOR ALL USING (grader_id = auth.uid());

-- Automatic grade-history tracking on grades changes.
CREATE OR REPLACE FUNCTION public.track_grade_changes()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- NOTE: no DELETE branch. grade_history.grade_id is NOT NULL with ON DELETE
-- CASCADE, so a delete-history row would either violate the FK (AFTER DELETE)
-- or be cascade-removed with its parent (BEFORE DELETE) — delete history is
-- unrecordable under this FK design. The 'deleted' change_type remains in the
-- CHECK constraint for manual entries written while the grade still exists.
DROP TRIGGER IF EXISTS track_grade_changes_trigger ON public.grades;
CREATE TRIGGER track_grade_changes_trigger
  AFTER INSERT OR UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.track_grade_changes();

-- Notify students when their grade history records a change.
CREATE OR REPLACE FUNCTION public.create_grade_notification()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_grade_notification_trigger ON public.grade_history;
CREATE TRIGGER create_grade_notification_trigger
  AFTER INSERT ON public.grade_history
  FOR EACH ROW EXECUTE FUNCTION public.create_grade_notification();

-- Stamp edits on submission comments.
CREATE OR REPLACE FUNCTION public.update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  NEW.edit_history = COALESCE(NEW.edit_history, '[]'::jsonb) ||
    jsonb_build_object('edited_at', now(), 'previous_text', OLD.comment_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_comment_updated_at_trigger ON public.submission_comments;
CREATE TRIGGER update_comment_updated_at_trigger
  BEFORE UPDATE ON public.submission_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_updated_at();
