-- Create grade_history table to track all grade changes
CREATE TABLE IF NOT EXISTS grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Previous grade values
  previous_points_earned DECIMAL(8,2),
  previous_points_possible DECIMAL(8,2),
  previous_percentage DECIMAL(5,2),
  previous_letter_grade TEXT,
  previous_comments TEXT,
  
  -- New grade values
  new_points_earned DECIMAL(8,2),
  new_points_possible DECIMAL(8,2),
  new_percentage DECIMAL(5,2),
  new_letter_grade TEXT,
  new_comments TEXT,
  
  -- Change metadata
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'excused', 'unexcused')),
  change_reason TEXT,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  
  -- Additional context
  grading_method TEXT, -- 'manual', 'rubric', 'auto_graded', 'imported'
  rubric_data JSONB, -- Store rubric scores if applicable
  submission_id UUID, -- Link to specific submission if relevant
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create submission_comments table for threaded comments
CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL, -- References either submission table
  submission_type TEXT NOT NULL CHECK (submission_type IN ('assignment', 'quiz')),
  
  -- Comment content
  comment_text TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('feedback', 'grade_justification', 'question', 'note', 'rubric_feedback')),
  
  -- Comment metadata
  author_id UUID NOT NULL REFERENCES profiles(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('instructor', 'student', 'ta', 'grader')),
  is_private BOOLEAN DEFAULT false, -- Private comments only visible to instructors
  
  -- Threading support
  parent_comment_id UUID REFERENCES submission_comments(id) ON DELETE CASCADE,
  thread_position INTEGER DEFAULT 0,
  
  -- Attachments and rich content
  attachments JSONB, -- Store file references
  rich_content JSONB, -- Store rich text formatting
  
  -- Status tracking
  is_draft BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edit_history JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Create grade_change_notifications table
CREATE TABLE IF NOT EXISTS grade_change_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_history_id UUID NOT NULL REFERENCES grade_history(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Notification content
  notification_type TEXT NOT NULL CHECK (notification_type IN ('grade_posted', 'grade_updated', 'grade_removed', 'feedback_added')),
  title TEXT NOT NULL,
  message TEXT,
  
  -- Delivery tracking
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  delivery_method TEXT[] DEFAULT ARRAY['in_app'], -- 'in_app', 'email', 'sms'
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create grading_sessions table to track grading workflows
CREATE TABLE IF NOT EXISTS grading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grader_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  assignment_id UUID REFERENCES assignments(id),
  quiz_id UUID REFERENCES quizzes(id),
  
  -- Session metadata
  session_type TEXT NOT NULL CHECK (session_type IN ('individual', 'bulk', 'rubric', 'speedgrader')),
  grading_method TEXT CHECK (grading_method IN ('manual', 'rubric', 'auto', 'imported')),
  
  -- Session stats
  submissions_graded INTEGER DEFAULT 0,
  total_submissions INTEGER,
  average_time_per_submission INTERVAL,
  
  -- Session timing
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration INTERVAL GENERATED ALWAYS AS (ended_at - started_at) STORED,
  
  -- Session data
  grading_criteria JSONB, -- Store rubric or grading criteria used
  batch_changes JSONB, -- Store bulk change information
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_grade_history_grade_id ON grade_history(grade_id);
CREATE INDEX idx_grade_history_student_course ON grade_history(student_id, course_id);
CREATE INDEX idx_grade_history_changed_at ON grade_history(changed_at);
CREATE INDEX idx_grade_history_changed_by ON grade_history(changed_by);

CREATE INDEX idx_submission_comments_submission ON submission_comments(submission_id, submission_type);
CREATE INDEX idx_submission_comments_author ON submission_comments(author_id);
CREATE INDEX idx_submission_comments_parent ON submission_comments(parent_comment_id);
CREATE INDEX idx_submission_comments_created ON submission_comments(created_at);

CREATE INDEX idx_grade_notifications_student ON grade_change_notifications(student_id);
CREATE INDEX idx_grade_notifications_unread ON grade_change_notifications(student_id, is_read) WHERE is_read = false;

CREATE INDEX idx_grading_sessions_grader ON grading_sessions(grader_id);
CREATE INDEX idx_grading_sessions_course ON grading_sessions(course_id);

-- RLS Policies
ALTER TABLE grade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_change_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_sessions ENABLE ROW LEVEL SECURITY;

-- Grade History Policies
CREATE POLICY "Instructors can view grade history for their courses" ON grade_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_assignments ca
      WHERE ca.course_id = grade_history.course_id
      AND ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
    )
  );

CREATE POLICY "Students can view their own grade history" ON grade_history
  FOR SELECT USING (student_id = auth.uid());

-- Submission Comments Policies
CREATE POLICY "Users can view comments on their submissions" ON submission_comments
  FOR SELECT USING (
    author_id = auth.uid() OR
    (submission_type = 'assignment' AND EXISTS (
      SELECT 1 FROM assignment_submissions asub
      WHERE asub.id::text = submission_comments.submission_id::text
      AND asub.student_id = auth.uid()
    )) OR
    (submission_type = 'quiz' AND EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.id::text = submission_comments.submission_id::text
      AND qa.user_id = auth.uid()
    )) OR
    EXISTS (
      SELECT 1 FROM course_assignments ca
      JOIN assignment_submissions asub ON ca.course_id = (
        SELECT a.course_id FROM assignments a WHERE a.id = asub.assignment_id
      )
      WHERE ca.user_id = auth.uid()
      AND ca.role IN ('instructor', 'assistant')
      AND asub.id::text = submission_comments.submission_id::text
    )
  );

CREATE POLICY "Users can create comments" ON submission_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can edit their own comments" ON submission_comments
  FOR UPDATE USING (author_id = auth.uid());

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON grade_change_notifications
  FOR ALL USING (student_id = auth.uid());

-- Grading Sessions Policies
CREATE POLICY "Graders can manage their own sessions" ON grading_sessions
  FOR ALL USING (grader_id = auth.uid());

-- Function to automatically create grade history when grades change
CREATE OR REPLACE FUNCTION track_grade_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track actual changes, not initial inserts without meaningful data
  IF TG_OP = 'INSERT' THEN
    -- Track grade creation
    INSERT INTO grade_history (
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
    -- Only log if there are actual changes to grade values
    IF (OLD.points_earned IS DISTINCT FROM NEW.points_earned) OR
       (OLD.points_possible IS DISTINCT FROM NEW.points_possible) OR
       (OLD.percentage IS DISTINCT FROM NEW.percentage) OR
       (OLD.letter_grade IS DISTINCT FROM NEW.letter_grade) OR
       (OLD.comments IS DISTINCT FROM NEW.comments) THEN
      
      INSERT INTO grade_history (
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
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO grade_history (
      grade_id, assignment_id, quiz_id, student_id, course_id,
      previous_points_earned, previous_points_possible, previous_percentage, previous_letter_grade, previous_comments,
      change_type, changed_by
    ) VALUES (
      OLD.id, OLD.assignment_id, OLD.quiz_id, OLD.student_id, OLD.course_id,
      OLD.points_earned, OLD.points_possible, OLD.percentage, OLD.letter_grade, OLD.comments,
      'deleted', auth.uid()
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for grade tracking
CREATE TRIGGER track_grade_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION track_grade_changes();

-- Function to create notifications for grade changes
CREATE OR REPLACE FUNCTION create_grade_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for grade changes
  IF NEW.change_type IN ('created', 'updated') THEN
    INSERT INTO grade_change_notifications (
      grade_history_id, student_id, course_id,
      notification_type, title, message
    ) VALUES (
      NEW.id, NEW.student_id, NEW.course_id,
      CASE 
        WHEN NEW.change_type = 'created' THEN 'grade_posted'
        ELSE 'grade_updated'
      END,
      CASE 
        WHEN NEW.change_type = 'created' THEN 'New Grade Posted'
        ELSE 'Grade Updated'
      END,
      CASE 
        WHEN NEW.assignment_id IS NOT NULL THEN 'Your assignment grade has been ' || NEW.change_type
        WHEN NEW.quiz_id IS NOT NULL THEN 'Your quiz grade has been ' || NEW.change_type
        ELSE 'Your grade has been ' || NEW.change_type
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for notifications
CREATE TRIGGER create_grade_notification_trigger
  AFTER INSERT ON grade_history
  FOR EACH ROW
  EXECUTE FUNCTION create_grade_notification();

-- Function to update comment timestamps
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.is_edited = true;
  
  -- Store edit history
  NEW.edit_history = COALESCE(NEW.edit_history, '[]'::jsonb) || 
    jsonb_build_object(
      'edited_at', now(),
      'previous_text', OLD.comment_text
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for comment updates
CREATE TRIGGER update_comment_updated_at_trigger
  BEFORE UPDATE ON submission_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();