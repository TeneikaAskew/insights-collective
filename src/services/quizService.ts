
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { CareerTrack, experienceQuestion } from '@/data/careerQuizData';
import { assertStorableResult } from '@/lib/resultIntegrity';

// Interface for storing quiz attempt data
export interface QuizAttemptData {
  // Individual question answers - matching actual database columns
  q1_coding_comfort?: number;
  q2_stat_modeling_interest?: number;
  q3_systems_vs_trends?: number;
  q4_insight_generation?: number;
  q5_stakeholder_communication?: number;
  q6_business_vs_processing?: number;
  q7_system_optimization?: number;
  q8_modeling_patterns?: number;
  q9_business_question_focus?: number;
  q10_tool_choice?: string;
  q11_ai_product_interest?: number;
  q12_strategic_influence_interest?: number;
  q13_infrastructure_interest?: number;
  q14_kpi_reporting_interest?: number;
  
  // Results data
  result_ai_ml_score: number;
  result_analytics_score: number;
  result_data_engineering_score: number;
  result_business_intelligence_score: number;
  
  // Top recommended path
  top_recommended_path: string;

  // Option id from the experience question; see migration 20260811000000.
  self_reported_experience?: string;
}

// Store quiz attempt in Supabase
export const storeQuizAttempt = async (
  answers: Record<number, number | string>,
  scores: Record<CareerTrack, number>
): Promise<string> => {
  // Generate session ID for anonymous users
  const sessionId = localStorage.getItem('quiz_session_id') || uuidv4();
  localStorage.setItem('quiz_session_id', sessionId);

  // Get user ID if authenticated
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Refuse to persist a result nobody produced.
  //
  // Every affinity question carries a positive weight for at least one track, so
  // a real completed quiz cannot score zero across all four. An all-zero object
  // only arises when a caller had no scores to hand over, and storing it created
  // a row that outranked the user's genuine attempts by `created_at` — the
  // profile then reported a 0% match for every track. Failing here is loud and
  // local; the silent write was neither.
  // The scores are the result; the answers are provenance and can legitimately
  // be missing (an attempt reloaded from the database keeps its scores but not
  // the browser's copy of the answers). So the guard is on the scores alone.
  assertStorableResult('quiz attempt', scores, 'every track scored 0');

  // Determine top recommended path
  const sortedTracks = Object.entries(scores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
  const topPath = sortedTracks[0][0];

  // Map question IDs to database columns - matching actual database schema
  const questionMapping: Record<number, string> = {
    1: 'q1_coding_comfort',
    2: 'q2_stat_modeling_interest',
    3: 'q3_systems_vs_trends',
    4: 'q4_insight_generation',
    5: 'q5_stakeholder_communication',
    6: 'q6_business_vs_processing',
    7: 'q7_system_optimization',
    8: 'q8_modeling_patterns',
    9: 'q9_business_question_focus',
    10: 'q10_tool_choice',
    11: 'q11_ai_product_interest',
    12: 'q12_strategic_influence_interest',
    13: 'q13_infrastructure_interest',
    14: 'q14_kpi_reporting_interest'
  };

  // Prepare data for insertion
  const quizData: QuizAttemptData & {
    user_id?: string;
    session_id: string;
  } = {
    session_id: sessionId,
    result_ai_ml_score: Math.round(scores['AI/ML']),
    result_analytics_score: Math.round(scores['Analytics']),
    result_data_engineering_score: Math.round(scores['Data Engineering']),
    result_business_intelligence_score: Math.round(scores['Business Intelligence']),
    top_recommended_path: topPath
  };

  // Add user ID if authenticated
  if (userId) {
    quizData.user_id = userId;
  }

  // Map question answers to database columns
  Object.entries(answers).forEach(([questionId, answer]) => {
    const dbColumn = questionMapping[parseInt(questionId)];
    if (dbColumn) {
      // Handle both number and string answers (q10 is string, others are numbers)
      (quizData as any)[dbColumn] = answer;
    }
  });

  // The experience answer, stored as the chosen option id. Kept out of
  // questionMapping because the legacy q11–q14 columns are named for specific
  // interests from a retired fourteen-question version; reusing one of them for
  // an experience answer would put the value under a name that contradicts it.
  if (experienceQuestion) {
    const experienceAnswer = answers[experienceQuestion.id];
    if (typeof experienceAnswer === 'string' && experienceAnswer) {
      quizData.self_reported_experience = experienceAnswer;
    }
  }

  // Insert data into Supabase
  const { data, error } = await supabase
    .from('career_quiz_attempts')
    .insert(quizData)
    .select('id')
    .single();

  if (error) throw error;

  return data.id;
};

// Start a new conversation with the career coach assistant
export const startCareerCoachConversation = async (
  quizAttemptId: string
): Promise<string> => {
  // Generate session ID for anonymous users
  const sessionId = localStorage.getItem('quiz_session_id') || uuidv4();
  localStorage.setItem('quiz_session_id', sessionId);

  // Get user ID if authenticated
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Create new conversation
  const { data: conversationData, error: conversationError } = await supabase
    .from('assistant_conversations')
    .insert({
      user_id: userId || null,
      session_id: sessionId,
      quiz_attempt_id: quizAttemptId,
      is_active: true
    })
    .select('id')
    .single();

  if (conversationError) throw conversationError;

  // Get initial message from the database function. If the RPC fails or
  // returns nothing we fall back to a generic greeting — a legitimate
  // default, not an error condition.
  const { data: functionData, error: functionError } = await supabase
    .rpc('generate_initial_assistant_message', { quiz_attempt_id: quizAttemptId });

  let initialMessage = "Hello! I'm your Career Coach Assistant. Based on your quiz results, I can provide personalized guidance for your data career journey. How can I help you today?";

  if (!functionError && functionData) {
    initialMessage = functionData;
  }

  // Store initial assistant message
  const { error: messageError } = await supabase
    .from('assistant_messages')
    .insert({
      conversation_id: conversationData.id,
      sender_type: 'assistant',
      content: initialMessage
    });

  if (messageError) {
    throw new Error(
      `Conversation ${conversationData.id} was created, but storing the initial assistant message failed: ${messageError.message}`
    );
  }

  return conversationData.id;
};
