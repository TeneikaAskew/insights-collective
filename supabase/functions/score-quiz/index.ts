// ABOUTME: Edge function that scores a quiz submission server-side against
// ABOUTME: the answer key, so the browser never decides its own grade.
//
// Closes the hole left open by 20260727001000_pin_grade_columns.sql: those
// triggers freeze a score after finalization, but the FIRST write was still
// whatever the browser computed. Here the caller sends only its answers; the
// function loads the questions with the service role, grades them, and writes
// score/kept_score itself.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders, handleError } from "../_shared/utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface AnswerOption {
  id: string;
  text?: string;
  correct?: boolean;
}

interface QuizQuestion {
  id: string;
  question_type: string;
  points: number | null;
  answers: AnswerOption[] | null;
  correct_answer?: string | null;
}

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

// Grades one question. Mirrors the question types the clients render.
// Essay/short_answer/matching stay manually graded and score 0 here, exactly
// as the previous client-side logic did.
function gradeQuestion(question: QuizQuestion, userAnswer: unknown): { correct: boolean; points: number } {
  const options = Array.isArray(question.answers) ? question.answers : [];
  const max = question.points ?? 0;

  switch (question.question_type) {
    case "multiple_choice":
    case "true_false": {
      const key = options.find((o) => o.correct);
      // Legacy rows store the answer as a string column instead of options.
      const correct = key
        ? userAnswer === key.id
        : question.correct_answer != null && norm(userAnswer) === norm(question.correct_answer);
      return { correct, points: correct ? max : 0 };
    }

    case "multiple_answers": {
      const keyIds = options.filter((o) => o.correct).map((o) => o.id);
      const given = Array.isArray(userAnswer) ? (userAnswer as string[]) : [];
      const correct =
        keyIds.length > 0 &&
        keyIds.length === given.length &&
        keyIds.every((id) => given.includes(id));
      return { correct, points: correct ? max : 0 };
    }

    case "fill_blank": {
      // Accept any option flagged correct, case/whitespace-insensitive.
      const accepted = options.filter((o) => o.correct).map((o) => norm(o.text));
      if (question.correct_answer != null) accepted.push(norm(question.correct_answer));
      const correct = accepted.length > 0 && accepted.includes(norm(userAnswer));
      return { correct, points: correct ? max : 0 };
    }

    // Manually graded.
    case "essay":
    case "short_answer":
    case "matching":
    default:
      return { correct: false, points: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Identity comes from the JWT, never the body.
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { submissionId, answers, timeSpent } = await req.json();
    if (!submissionId || typeof answers !== "object" || answers === null) {
      return new Response(JSON.stringify({ error: "submissionId and answers are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The submission must belong to the caller.
    const { data: submission, error: submissionError } = await supabase
      .from("quiz_submissions")
      .select("id, user_id, quiz_id, workflow_state, attempt")
      .eq("id", submissionId)
      .eq("user_id", userId)
      .single();
    if (submissionError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Finalized submissions are immutable — retakes INSERT a new attempt.
    if (submission.workflow_state === "complete") {
      return new Response(JSON.stringify({ error: "This attempt is already submitted" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: questionsError } = await supabase
      .from("quiz_questions")
      .select("id, question_type, points, answers, correct_answer")
      .eq("quiz_id", submission.quiz_id);
    if (questionsError) throw questionsError;

    const graded = (questions ?? []).map((question: QuizQuestion) => {
      const { correct, points } = gradeQuestion(question, (answers as Record<string, unknown>)[question.id]);
      return {
        quiz_submission_id: submission.id,
        quiz_question_id: question.id,
        answer_data: { answer: (answers as Record<string, unknown>)[question.id] ?? null },
        correct,
        points,
      };
    });

    const totalScore = graded.reduce((sum, row) => sum + row.points, 0);
    const pointsPossible = (questions ?? []).reduce(
      (sum: number, q: QuizQuestion) => sum + (q.points ?? 0),
      0,
    );

    if (graded.length > 0) {
      const { error: answersError } = await supabase
        .from("quiz_submission_answers")
        .upsert(graded, { onConflict: "quiz_submission_id,quiz_question_id" });
      if (answersError) throw answersError;
    }

    // Kept-score policy unchanged from the client implementation: latest
    // attempt. Written with the service role, so the freeze trigger from
    // 20260727001000 applies to everyone else but not to this authoritative
    // write.
    const { error: updateError } = await supabase
      .from("quiz_submissions")
      .update({
        finished_at: new Date().toISOString(),
        time_spent: typeof timeSpent === "number" ? timeSpent : null,
        score: totalScore,
        kept_score: totalScore,
        workflow_state: "complete",
      })
      .eq("id", submission.id);
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        score: totalScore,
        pointsPossible,
        // Per-question outcome for the results view. Safe post-submission:
        // it reports what the student got right, not the unattempted key.
        results: graded.map((row) => ({
          questionId: row.quiz_question_id,
          correct: row.correct,
          points: row.points,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    handleError(error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Failed to score quiz" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
