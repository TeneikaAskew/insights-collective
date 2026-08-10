
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { storeQuizAttempt, startCareerCoachConversation } from '@/services/quizService';
import { CareerTrack } from '@/data/careerQuizData';
import { emptyResultToast, isEmptyResult, isEmptyResultError } from '@/lib/resultIntegrity';
import { useAuth } from '@/contexts/AuthContext';

import { createLogger } from '@/utils/logger';

const logger = createLogger('useCareerCoach');

// Define typical salary ranges for each career path
const careerPathSalaries: Record<CareerTrack, number> = {
  'AI/ML': 160000,
  'Analytics': 110000,
  'Data Engineering': 140000,
  'Business Intelligence': 120000
};

export function useCareerCoach() {
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, storeRedirectPath } = useAuth();

  // Check for stored quiz results on authentication
  useEffect(() => {
    const syncQuizResultsToSupabase = async () => {
      if (isAuthenticated) {
        const storedScores = localStorage.getItem('quizScores');
        const storedAnswers = localStorage.getItem('quizAnswers');
        
        if (storedScores && storedAnswers) {
          try {
            const scores = JSON.parse(storedScores);
            const answers = JSON.parse(storedAnswers);
            
            // Only sync if we have valid data.
            //
            // `isEmptyResult` rather than a key count: the leftover object here
            // is usually well-formed and entirely zeros, which passes a key
            // count and is exactly what must not be written. Skipped silently
            // and on purpose — nothing was lost, because there was nothing.
            // A toast here would fire on page load, unprompted, about a
            // background sync the reader never asked for.
            if (!isEmptyResult(scores) && !isEmptyResult(answers)) {
              logger.log('Syncing stored quiz results to Supabase silently');
              const quizAttemptId = await storeQuizAttempt(answers, scores);
              
              if (quizAttemptId) {
                logger.log('Successfully synced quiz results to Supabase');
                
                // If the user was redirected to login from career coach, initialize conversation
                const redirectPath = localStorage.getItem('redirectAfterLogin');
                if (redirectPath === '/assistant/career-coach') {
                  // Store the quiz attempt ID for later use
                  localStorage.setItem('activeQuizAttemptId', quizAttemptId);
                  
                  // Only start conversation if redirected from career coach
                  const conversationId = await startCareerCoachConversation(quizAttemptId);
                  if (conversationId) {
                    localStorage.setItem('activeConversationId', conversationId);
                  }
                }
              }
            }
          } catch (error) {
            // Deliberately non-fatal, and worth stating why rather than leaving
            // a bare log: the coach still opens and still answers, it just does
            // so without the quiz context this sync would have attached. That is
            // a quieter, more personalized-looking degradation than an outright
            // failure, so the log says exactly what the user lost.
            logger.error(
              'Quiz results did not sync; the coach will run without quiz context for this session:',
              error,
            );
          }
        }
      }
    };
    
    syncQuizResultsToSupabase();
  }, [isAuthenticated]);

  const initiateCareerCoachChat = async (
    answers: Record<number, number | string>,
    scores: Record<CareerTrack, number>,
    /**
     * An attempt already in the database to attach this conversation to.
     *
     * Without it every click stored a fresh attempt, so opening the coach from
     * the profile three times left three rows describing one quiz — and each
     * new row became the account's newest attempt. Callers that already know
     * which attempt they are discussing should say so.
     */
    existingAttemptId?: string,
  ) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Store the career coach path for redirect after login
      storeRedirectPath('/assistant/career-coach');
      
      // Store quiz data for after login
      localStorage.setItem('quizScores', JSON.stringify(scores));
      localStorage.setItem('quizAnswers', JSON.stringify(answers));
      
      // Redirect to login
      toast({
        title: "Login Required",
        description: "Please log in to chat with our Career Coach.",
        variant: "default"
      });
      
      navigate('/login');
      return false;
    }
    
    setIsProcessing(true);
    
    try {
      // Step 1: Store the quiz attempt, unless we were handed one.
      const quizAttemptId = existingAttemptId || (await storeQuizAttempt(answers, scores));

      if (!quizAttemptId) {
        throw new Error('Failed to store quiz attempt');
      }
      
      // Step 2: Start conversation
      const conversationId = await startCareerCoachConversation(quizAttemptId);
      
      if (!conversationId) {
        throw new Error('Failed to start conversation');
      }
      
      // Step 3: Determine top career path from scores
      const sortedTracks = Object.entries(scores)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
      
      const topCareerPath = sortedTracks[0][0] as CareerTrack;
      const recommendedSalary = careerPathSalaries[topCareerPath];
      
      // Step 4: Store settings for the assistant interface to use
      localStorage.setItem('activeQuizAttemptId', quizAttemptId);
      localStorage.setItem('activeConversationId', conversationId);
      localStorage.setItem('recommendedCareerPath', topCareerPath);
      localStorage.setItem('recommendedSalary', recommendedSalary.toString());
      
      // Clear stored quiz data as it's now in Supabase
      localStorage.removeItem('quizScores');
      localStorage.removeItem('quizAnswers');
      
      // Navigate to the career coach assistant
      navigate('/assistant/career-coach');
      
      return true;
    } catch (error) {
      logger.error('Error initiating career coach chat:', error);

      // "There was an issue connecting, please try again" is the wrong thing to
      // say when the payload was empty: nothing was wrong with the connection
      // and trying again will be refused for the same reason. Name the actual
      // problem instead.
      toast(
        isEmptyResultError(error)
          ? emptyResultToast(error)
          : {
              title: 'Error starting chat',
              description: 'There was an issue connecting to the Career Coach. Please try again.',
              variant: 'destructive',
            },
      );

      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    initiateCareerCoachChat,
    isProcessing
  };
}
