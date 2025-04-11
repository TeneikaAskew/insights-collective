
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { CareerTrack } from '@/data/careerQuizData';

// Interface for storing quiz attempt data
export interface QuizAttemptData {
  // Individual question answers
  q_analytical_thinking?: number;
  q_creative_problem_solving?: number;
  q_technical_complexity?: number;
  q_business_value?: number;
  q_communication?: number;
  q_teamwork?: number;
  q_data_orientation?: number;
  q_math_stats_comfort?: number;
  q_coding_preference?: number;
  q_visualization_interest?: number;
  
  // Results data
  result_ai_ml_score: number;
  result_analytics_score: number;
  result_data_engineering_score: number;
  result_business_intelligence_score: number;
  
  // Top recommended path
  top_recommended_path: string;
}

// Store quiz attempt in Supabase
export const storeQuizAttempt = async (
  answers: Record<number, number | string>,
  scores: Record<CareerTrack, number>
): Promise<string | null> => {
  try {
    // Generate session ID for anonymous users
    const sessionId = localStorage.getItem('quiz_session_id') || uuidv4();
    localStorage.setItem('quiz_session_id', sessionId);
    
    // Get user ID if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    // Determine top recommended path
    const sortedTracks = Object.entries(scores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
    const topPath = sortedTracks[0][0];
    
    // Map question IDs to database columns
    const questionMapping: Record<number, string> = {
      1: 'q_analytical_thinking',
      2: 'q_creative_problem_solving',
      3: 'q_technical_complexity',
      4: 'q_business_value',
      5: 'q_communication',
      6: 'q_teamwork',
      7: 'q_data_orientation',
      8: 'q_math_stats_comfort',
      9: 'q_coding_preference',
      10: 'q_visualization_interest'
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
      if (dbColumn && typeof answer === 'number') {
        quizData[dbColumn as keyof typeof quizData] = answer;
      }
    });
    
    // Insert data into Supabase
    const { data, error } = await supabase
      .from('career_quiz_attempts')
      .insert(quizData)
      .select('id')
      .single();
      
    if (error) {
      console.error('Error storing quiz attempt:', error);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error storing quiz attempt:', error);
    return null;
  }
};

// Start a new conversation with the career coach assistant
export const startCareerCoachConversation = async (
  quizAttemptId: string
): Promise<string | null> => {
  try {
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
      
    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return null;
    }
    
    // Get initial message from the database function
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
      console.error('Error storing initial message:', messageError);
    }
    
    return conversationData.id;
  } catch (error) {
    console.error('Error starting conversation:', error);
    return null;
  }
};
