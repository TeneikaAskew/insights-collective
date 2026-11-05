// Canvas-style content management service

import { supabase } from '@/integrations/supabase/client';
import type { 
  ContentItem, 
  ContentItemType, 
  CreateContentItemInput,
  CreateAssignmentInput,
  CreateQuizInput,
  Assignment,
  Quiz,
  QuizQuestion,
  AssignmentSubmission,
  Module
} from '@/types/canvas';

/** Columns the builder needs to confirm a lesson write. */
const LESSON_DRAFT_COLUMNS = 'id, title, content, type, published, updated_at';

export interface LessonDraftRow {
  id: string;
  title: string;
  content: string;
  type: ContentItemType;
  published: boolean | null;
  /** Nullable in the schema (DEFAULT now(), no NOT NULL): a NULL here is a known value, not "unavailable". */
  updated_at: string | null;
}

/** Raised when a conditional lesson write finds the row changed since it was read. */
export class LessonSaveConflictError extends Error {
  readonly current: LessonDraftRow;
  constructor(current: LessonDraftRow) {
    super('This lesson was changed somewhere else after you opened it.');
    this.name = 'LessonSaveConflictError';
    this.current = current;
  }
}

/** Raised when the server definitively did not apply a lesson write (zero rows, or refused locally). */
export class LessonSaveRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonSaveRejectedError';
  }
}

export class CanvasContentService {
  // Content Items
  static async getContentItems(moduleId: string | null, courseId?: string): Promise<ContentItem[]> {
    if (moduleId === null && !courseId) throw new Error('Course required for unassigned lessons.');
    let query = supabase
      .from('content_items')
      .select(`
        *,
        assignment:assignments(*),
        quiz:quizzes(*, questions:quiz_questions(id, quiz_id, question_text, question_type, points, position, created_at))
      `);
    query = moduleId === null ? query.eq('course_id', courseId!).is('module_id', null) : query.eq('module_id', moduleId);
    const { data, error } = await query.order('position');

    if (error) throw error;

    // Transform the data to ensure assignment and quiz are single objects, not arrays
    const transformedData = data?.map(item => ({
      ...item,
      assignment: Array.isArray(item.assignment) && item.assignment.length > 0 ? item.assignment[0] : item.assignment,
      quiz: Array.isArray(item.quiz) && item.quiz.length > 0 ? item.quiz[0] : item.quiz
    }));

    return (transformedData || []) as unknown as ContentItem[];
  }

  static async getContentItem(id: string): Promise<ContentItem | null> {
    try {
      const { data, error } = await supabase
        .from('content_items')
        .select(`
          *,
          assignment:assignments(*),
          quiz:quizzes(*, questions:quiz_questions(id, quiz_id, question_text, question_type, points, position, created_at))
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching content item:', { id, error });
        throw new Error(`Failed to load content item: ${error.message}`);
      }

      if (!data) {
        console.warn('Content item not found:', id);
        return null;
      }

      // Transform the data to ensure assignment and quiz are single objects, not arrays
      const transformedItem = {
        ...data,
        assignment: Array.isArray(data.assignment) && data.assignment.length > 0 ? data.assignment[0] : data.assignment,
        quiz: Array.isArray(data.quiz) && data.quiz.length > 0 ? data.quiz[0] : data.quiz
      };

      // Validate assignment data if it's an assignment type
      if (transformedItem.type === 'assignment' && !transformedItem.assignment) {
        console.error('Assignment data missing for assignment content item:', id);
        throw new Error('Assignment details are missing. Please contact your instructor.');
      }

      // Validate quiz data if it's a quiz type
      if (transformedItem.type === 'quiz' && !transformedItem.quiz) {
        console.error('Quiz data missing for quiz content item:', id);
        throw new Error('Quiz details are missing. Please contact your instructor.');
      }

      console.log('Content item loaded successfully:', {
        id: transformedItem.id,
        type: transformedItem.type,
        hasAssignment: !!transformedItem.assignment,
        hasQuiz: !!transformedItem.quiz
      });

      return transformedItem as unknown as ContentItem;
    } catch (error) {
      console.error('Exception in getContentItem:', error);
      throw error;
    }
  }

  static async createContentItem(input: CreateContentItemInput): Promise<ContentItem> {
    // Get the next position. Throw on failure — defaulting to position 0
    // on error would silently reorder the module.
    let positionQuery = supabase.from('content_items').select('position').eq('course_id', input.course_id);
    positionQuery = input.module_id === null ? positionQuery.is('module_id', null) : positionQuery.eq('module_id', input.module_id);
    const { data: existingItems, error: positionError } = await positionQuery.order('position', { ascending: false }).limit(1);

    if (positionError) throw positionError;

    const nextPosition = existingItems && existingItems.length > 0
      ? existingItems[0].position + 1 
      : 0;

    // Create the content item
    const { data: contentItem, error: contentError } = await supabase
      .from('content_items')
      .insert({
        course_id: input.course_id,
        module_id: input.module_id,
        type: input.type,
        title: input.title,
        content: input.content,
        position: nextPosition,
        settings: input.settings || {},
        published: false
      })
      .select()
      .single();

    if (contentError) throw contentError;

    // Create type-specific records. NOTE: assignments and quizzes have several
    // NOT NULL columns (title on both; course_id + description on assignments)
    // that PostgREST will reject with a 400 if we omit them, so we always fall
    // back to the parent content_item's values.
    if (input.type === 'assignment') {
      const assignmentData = input.settings?.assignment || {
        points: (input as CreateAssignmentInput).points_possible,
        due_date: (input as CreateAssignmentInput).due_at,
        submission_types: (input as CreateAssignmentInput).submission_types,
        max_attempts: (input as CreateAssignmentInput).allowed_attempts,
        grading_type: (input as CreateAssignmentInput).grading_type,
      };

      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .insert({
          content_item_id: contentItem.id,
          course_id: input.course_id,
          module_id: input.module_id,
          title: input.title,
          description: (input.content ?? '') as string,
          points: assignmentData.points ?? 100,
          due_date: assignmentData.due_date ?? null,
          submission_types: assignmentData.submission_types || ['online_text_entry'],
          max_attempts: assignmentData.max_attempts ?? 1,
          grading_type: assignmentData.grading_type || 'points',
          is_published: false,
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      contentItem.settings = { ...(contentItem.settings as object), assignment_id: assignment.id };
    } else if (input.type === 'quiz') {
      const quizInput = input as CreateQuizInput;
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          content_item_id: contentItem.id,
          module_id: input.module_id,
          title: input.title,
          description: input.content ?? null,
          quiz_type: quizInput.quiz_type || 'assignment',
          time_limit: quizInput.time_limit ?? null,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      if (quizInput.questions && quizInput.questions.length > 0) {
        const { error: questionsError } = await supabase
          .from('quiz_questions')
          .insert(
            quizInput.questions.map((q, index) => ({
              quiz_id: quiz.id,
              question_type: q.question_type,
              question_text: q.question_text,
              points: q.points,
              position: index,
              answers: q.answers,
            })) as any
          );

        if (questionsError) throw questionsError;
      }
    }

    // Return the content item with assignment data attached
    return await this.getContentItem(contentItem.id);
  }

  static async updateContentItem(
    id: string, 
    updates: Partial<ContentItem>
  ): Promise<ContentItem> {
    const { data, error } = await supabase
      .from('content_items')
      .update({
        title: updates.title,
        content: updates.content,
        published: updates.published,
        settings: updates.settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as ContentItem;
  }

  /**
   * AUTHORING ONLY (course builder). Conditional write of a lesson row.
   *
   * - Only the columns in `patch` plus `updated_at` are written; `type` and `settings` never are, so
   *   quiz/assignment child rows cannot be detached by the builder.
   * - Conditional on `expectedUpdatedAt`: a string matches that exact version; `null` matches a row whose
   *   version IS NULL (null-safe). `undefined` (version unavailable) is refused: no unconditional writes.
   * - Returns the row the server stored. A zero-row write is re-read and reported precisely: deleted or
   *   no access, changed elsewhere (LessonSaveConflictError), or not applied.
   */
  private static async conditionalLessonWrite(
    id: string,
    patch: { title?: string; content?: string; published?: boolean },
    expectedUpdatedAt: string | null | undefined,
  ): Promise<LessonDraftRow> {
    if (expectedUpdatedAt === undefined) {
      throw new LessonSaveRejectedError(
        'This lesson was not saved: its version is unknown, and an unconditional write could overwrite someone else\u2019s change.',
      );
    }
    let query = supabase
      .from('content_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    query = expectedUpdatedAt === null ? query.is('updated_at', null) : query.eq('updated_at', expectedUpdatedAt);

    const { data, error } = await query.select(LESSON_DRAFT_COLUMNS).maybeSingle();
    if (error) throw error;
    if (data) return data as unknown as LessonDraftRow;

    const current = await this.getLessonDraftRow(id);
    if (!current) {
      throw new LessonSaveRejectedError(
        'This lesson was not saved: it no longer exists or you no longer have access to it.',
      );
    }
    if (current.updated_at !== expectedUpdatedAt) throw new LessonSaveConflictError(current);
    throw new LessonSaveRejectedError(
      'This lesson was not saved: the server changed no rows. You may not have permission to edit it.',
    );
  }

  /** AUTHORING ONLY: save a lesson's title and body (see conditionalLessonWrite). */
  static async saveLessonDraft(
    id: string,
    fields: { title: string; content: string },
    expectedUpdatedAt: string | null | undefined,
  ): Promise<LessonDraftRow> {
    return this.conditionalLessonWrite(id, { title: fields.title, content: fields.content }, expectedUpdatedAt);
  }

  /** AUTHORING ONLY: publish or unpublish one lesson, conditional on its confirmed version. */
  static async setLessonPublished(
    id: string,
    published: boolean,
    expectedUpdatedAt: string | null | undefined,
  ): Promise<LessonDraftRow> {
    return this.conditionalLessonWrite(id, { published }, expectedUpdatedAt);
  }

  /** AUTHORING ONLY: authoritative read of a lesson row; null when absent or not readable. */
  static async getLessonDraftRow(id: string): Promise<LessonDraftRow | null> {
    const { data, error } = await supabase
      .from('content_items')
      .select(LESSON_DRAFT_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as LessonDraftRow) ?? null;
  }

  static async deleteContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async reorderContentItems(
    moduleId: string,
    itemIds: string[]
  ): Promise<void> {
    // Uses the reorder_content_items RPC which defers the UNIQUE (module_id, position)
    // constraint within a single transaction, avoiding 409 Conflict errors that occurred
    // when sequential PATCHes temporarily violated the constraint mid-reorder.
    const { error } = await supabase.rpc('reorder_content_items', {
      p_module_id: moduleId,
      p_item_ids: itemIds,
    });
    if (error) throw error;
  }

  static async reorderUnassignedContentItems(_courseId: string, _itemIds: string[]): Promise<void> {
    // No atomic null-module reorder contract exists. Never send partial position updates.
    throw new Error('Unassigned lesson ordering is not available; the saved order has been kept.');
  }

  // Reorder modules within a course. Called from CourseBuilder (:409).
  //
  // The comment here used to name "the builder's CurriculumTree drag-drop".
  // CurriculumTree was deleted as dead code, so that sentence pointed at a file
  // which no longer exists — a reader checking it would have concluded this
  // method was orphaned too. It is not: CourseBuilder is the live caller.
  static async reorderModules(courseId: string, moduleIds: string[]): Promise<void> {
    const { error } = await supabase.rpc('reorder_modules', {
      p_course_id: courseId,
      p_module_ids: moduleIds,
    });
    if (error) throw error;
  }

  // Modules CRUD (used by the builder)
  static async getModules(courseId: string): Promise<Module[]> {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', courseId)
      .order('position');

    if (error) throw error;
    return (data as unknown as Module[]) || [];
  }

  static async createModule(courseId: string, title: string): Promise<Module> {
    // Find the next position at the end of the list. Throw on failure —
    // defaulting to position 0 on error would silently reorder the course.
    const { data: existing, error: positionError } = await supabase
      .from('modules')
      .select('position')
      .eq('course_id', courseId)
      .order('position', { ascending: false })
      .limit(1);

    if (positionError) throw positionError;

    const nextPosition =
      existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;

    const { data, error } = await supabase
      .from('modules')
      .insert({
        course_id: courseId,
        title,
        position: nextPosition,
        published: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Module;
  }

  static async updateModule(id: string, updates: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('modules')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Module;
  }

  static async deleteModule(id: string): Promise<void> {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw error;
  }

  // Assignments
  static async getAssignment(contentItemId: string): Promise<Assignment | null> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('content_item_id', contentItemId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as unknown as Assignment;
  }

  static async updateAssignment(
    contentItemId: string,
    updates: Partial<Assignment>
  ): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates as any)
      .eq('content_item_id', contentItemId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Assignment;
  }

  // Quizzes
  //
  // Questions come from get_quiz_questions_for_taking, which returns the
  // answer OPTIONS with the `correct` flag stripped server-side. The answer
  // key is not readable by `authenticated` (20260728000000) and grading runs
  // in the score-quiz edge function, so the browser never holds it.
  static async getQuiz(contentItemId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('content_item_id', contentItemId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    const { data: questions, error: questionsError } = await supabase
      .rpc('get_quiz_questions_for_taking', { p_quiz_id: data.id });
    if (questionsError) throw questionsError;

    return { ...data, questions: questions || [] } as unknown as Quiz;
  }

  /**
   * A quiz by its OWN id, for callers that hold a quiz_id rather than a
   * content-item id.
   *
   * Every other method on this service is keyed on content_item_id, which is
   * the right key when you are walking the course structure. It is the wrong
   * key when you are starting from a quiz_submissions row: CanvasQuizResults
   * held `submission.quiz_id` and passed it to getQuiz(contentItemId), so the
   * query became `WHERE content_item_id = <a quiz id>`, matched nothing, and
   * the page threw "Quiz not found" for EVERY submission.
   *
   * Resolved from the submission rather than from the :contentItemId route
   * param deliberately. The param is user-supplied, and the results page
   * renders per-question answers — pairing one quiz's questions with another
   * quiz's answers would be worse than the error it replaces.
   *
   * Returns the ROW ONLY, unlike getQuiz. Modeling it on getQuiz for symmetry
   * meant it ran get_quiz_questions_for_taking and then its one caller ran the
   * identical RPC again a line later: a redundant sequential round trip on
   * every results load, and a second chance for the request to fail and
   * replace data that had already arrived with the error screen. `questions`
   * is optional on Quiz, and getQuizQuestionsForTaking exists for exactly this
   * caller, so the two concerns stay separate.
   */
  static async getQuizById(quizId: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as unknown as Quiz) ?? null;
  }

  /**
   * Questions for a quiz id, through the same RPC getQuiz uses. Post
   * submission that RPC also reveals the correct answers, subject to the
   * quiz's show_correct_answers setting.
   *
   * CanvasQuizResults already called this; the method was never defined, so
   * the results page threw "is not a function" at runtime. Its unit test
   * mocked the name, which is why the suite stayed green.
   */
  static async getQuizQuestionsForTaking(quizId: string): Promise<QuizQuestion[]> {
    const { data, error } = await supabase
      .rpc('get_quiz_questions_for_taking', { p_quiz_id: quizId });

    if (error) throw error;
    return (data || []) as unknown as QuizQuestion[];
  }

  static async updateQuiz(
    contentItemId: string,
    updates: Partial<Quiz>
  ): Promise<Quiz> {
    const { data, error } = await supabase
      .from('quizzes')
      .update(updates as any)
      .eq('content_item_id', contentItemId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Quiz;
  }

  static async addQuizQuestion(
    quizId: string,
    question: Omit<QuizQuestion, 'id' | 'quiz_id' | 'created_at' | 'updated_at'>
  ): Promise<QuizQuestion> {
    // Get next position. Throw on failure — defaulting to position 0 on
    // error would silently reorder the quiz.
    const { data: existingQuestions, error: positionError } = await supabase
      .from('quiz_questions')
      .select('position')
      .eq('quiz_id', quizId)
      .order('position', { ascending: false })
      .limit(1);

    if (positionError) throw positionError;

    const nextPosition = existingQuestions && existingQuestions.length > 0
      ? existingQuestions[0].position + 1
      : 0;

    const { data, error } = await supabase
      .from('quiz_questions')
      .insert({
        quiz_id: quizId,
        ...question,
        position: nextPosition
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as QuizQuestion;
  }

  // Submissions
  static async submitAssignment(
    assignmentId: string,
    submission: {
      submission_type: string;
      body?: string;
      url?: string;
    }
  ): Promise<AssignmentSubmission> {
    // A failed attempt probe must throw — defaulting to attempt 1 on error
    // would insert a duplicate first attempt for the student.
    const { data: existingSubmission, error: attemptError } = await supabase
      .from('assignment_submissions')
      .select('attempt')
      .eq('assignment_id', assignmentId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .order('attempt', { ascending: false })
      .limit(1);

    if (attemptError) throw attemptError;

    const nextAttempt = existingSubmission && existingSubmission.length > 0
      ? existingSubmission[0].attempt + 1
      : 1;

    const { data, error } = await supabase
      .from('assignment_submissions')
      .insert({
        assignment_id: assignmentId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        submitted_at: new Date().toISOString(),
        submission_type: submission.submission_type,
        body: submission.body,
        url: submission.url,
        workflow_state: 'submitted',
        attempt: nextAttempt
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as AssignmentSubmission;
  }

  // Module Management
  static async updateModuleRequirements(
    moduleId: string,
    requirements: any[],
    completionRequirements: any[]
  ): Promise<void> {
    const { error } = await supabase
      .from('modules')
      .update({
        requirements,
        completion_requirements: completionRequirements,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId);

    if (error) throw error;
  }

  // Progress Tracking
  static async markContentItemAsRead(contentItemId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('content_item_progressions')
      .upsert({
        user_id: userId,
        content_item_id: contentItemId,
        workflow_state: 'read',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_item_id'
      });

    if (error) throw error;
  }

  static async markContentItemAsCompleted(contentItemId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('content_item_progressions')
      .upsert({
        user_id: userId,
        content_item_id: contentItemId,
        workflow_state: 'completed',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_item_id'
      });

    if (error) throw error;
  }

  // Publishing
  static async publishContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({
        published: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  static async unpublishContentItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('content_items')
      .update({
        published: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }
}

export default CanvasContentService;